# Cache layer (Upstash Redis)

Speeds up read-heavy Firestore queries by caching their results in Upstash
Redis. The cache is an **optimisation only**: when Redis is unconfigured,
unreachable, or erroring, every call falls through to the origin loader.
Latency changes; correctness never does.

## Enabling

Set both values in `apps/web/.env.local`, and in Netlify's Functions scope for
production (see `netlify-env.template`):

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Get them from <https://console.upstash.com> → your database → REST API.
Set `CACHE_ENABLED=false` to switch the cache off without unsetting them.

With either value blank the app behaves exactly as before — no errors, no
warnings, every read goes straight to Firestore.

## How it works

`cacheAside({ key, ttlSeconds, loader })` (`lib/cache/index.ts`) is read-through:

1. `GET` the key. A hit returns immediately.
2. A miss runs `loader()` (the original Firestore read), then writes the result
   with `EX ttlSeconds`. The write is best-effort — a failure is logged once
   and swallowed.
3. Concurrent misses for the same key share one loader call, so a dashboard
   firing five identical reads triggers one origin query, not five.

Keys are built by `buildCacheKey()` and are namespaced under `tuturai:v1:`.
Segments containing `:` or longer than 80 chars are hashed, so two different
inputs can never collapse onto one key and serve one user's rows to another.

## Correctness rules

These are the invariants that keep the cache safe. `lib/cache/coverage.test.ts`
fails if any of them is broken.

- **Authorization is never cached.** `listTeacherClassroomMembers`,
  `listClassroomLeaderboard`, and `listClassroomAssignments` check ownership or
  membership on *every* request, outside the cached loader. A cached hit can
  never outlive the check that granted access.
- **Writes invalidate.** Every mutation that can change a cached read calls
  `invalidateNamespaces(...)`. Creating a classroom, joining one, publishing an
  assignment, submitting or reviewing work, answering a question, and onboarding
  all drop the affected namespaces immediately. TTLs are a safety net, not the
  correctness mechanism.
- **Role-scoped keys.** Assignment lists are cached per role, so a student can
  never read a cached teacher's list containing unpublished work.
- **Session revocation stays live.** Only the user-profile *document* is cached
  (`readProfileDocument`). `verifySessionCookie` still runs every request, so
  disabling an account or revoking a session takes effect immediately.

## Cached reads

| Namespace | Function | TTL |
| --- | --- | --- |
| `profile` | `readProfileDocument` | 30s |
| `classrooms:teacher` / `classrooms:student` | `listTeacherClassrooms`, `listStudentClassrooms` | 20s |
| `members`, `members:leaderboard` | roster, leaderboard | 15s |
| `assignments` | `listClassroomAssignments` | 15s |
| `reviewQueue` | `listTeacherReviewQueue` | 10s |
| `analytics*` | teacher analytics/leaderboard, student dashboard, learning stats | 30s |
| `questionBank` | `listPublishedQuestions` | 120s |

To cache a new read: wrap the Firestore call in `cacheAside`, add a namespace
builder in `lib/cache/keys.ts`, and add the matching `invalidateNamespaces(...)`
call to every write that can change it.

## Measured impact

`pnpm cache:bench` measures real production Firestore latency for each read
(cold = cache miss, warm = cache hit) and confirms invalidation returns the
next read to the origin. Set `BENCH_TEACHER_ID`, `BENCH_STUDENT_ID`, and
`BENCH_CLASSROOM_ID` to include the per-user paths.

Honest summary of the current numbers: on a small dataset the read is already
only ~40–180ms, so a ~35ms Redis round trip is roughly **break-even** (1.0x).
The cache earns its keep on the paths that fan out into many queries — the
teacher analytics aggregate issues 2 queries per student, and the review queue
walks every classroom → assignment → submission → assessment chain. Those are
where it stays flat as the roster grows, and where cold starts and subsequent
loads differ most. It also removes a cold start from the common
navigate-away-and-back case, since the dashboard usually refetches several of
these aggregates at once.

Adding `CACHE_ENABLED=false` disables all of it instantly if a regression
appears in production.

## Before enabling in production: the `questionBank` window

`questionBank` is the one namespace **no runtime write invalidates**, because no
product route publishes or retires bank content — the bank is only changed by
`scripts/seed-question-bank.mjs`, `scripts/expand-question-bank.mjs`, and the
production E2E runner, all of which write straight through the Admin SDK.

That makes the 120s TTL the only bound, which is fine for normal operation but
breaks the production E2E suite the moment Redis is live: the runner creates
and deletes its `tuturai-e2e-*` fixtures directly in Firestore, so the app can
serve a pre-fixture bank for up to two minutes and the suite will fail
intermittently with "served N activities" mismatches.

Before the first production E2E run against an enabled cache, either flush the
keyspace (`SCAN` + `DEL` on `tuturai:v1:questionBank*`) after the fixtures are
written, or give the runner a way to call `invalidateNamespaces('questionBank')`.
Until then, keep `CACHE_ENABLED=false` for the E2E checkpoint.

## Note on `scan`

`@upstash/redis` resolves `SCAN` to a `[cursor, keys]` **tuple**, not a
`{ cursor, result }` object — verified against the library's own deserializer,
since the TypeScript declaration is misleading here. Getting this wrong fails
silently: invalidation would throw, get swallowed by the error handler, and
stale data would be served for the whole TTL.
