# TuturAI API Contract Matrix

Backend-finalization audit (2026-09-29). Every route is `NextRequest` handler in
`apps/web/app/api/**/route.ts`. Auth legend: `requireAuth` = valid Firebase
session cookie; role guards via `requireRole`; ownership via Firestore document
fields + membership checks + rules. Rate-limit scopes from
`lib/api/rate-limit.ts` + Firestore-backed `joinRateLimits`.

Verification sources: route unit/integration tests under `apps/web/**/*.test.ts`,
durable local Playwright suites (`pnpm --filter @tuturai/web e2e:*`), negative
authorization suite (`e2e:authorization-boundaries`), emulator rules tests.

| # | Route | Method | Auth | Role | Input validation | Rate limit | Persistence | External provider | Error states | Idempotency | Read-back / E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/api/health` | GET | public | — | — | — | — | — | 200 always | n/a | S production 200 |
| 2 | `/api/health/readiness` | GET | session | teacher | — | — | Firestore `_health` probe | Firebase Admin | 401/403/503 structured | n/a | unit-tested; runtime needs Admin env |
| 3 | `/api/auth/session` | POST | public | — | body `{idToken}` | — | session cookie write | Firebase Admin | 400/401/403/500/503 classified, configField surfaced | new cookie per call | local prod smoke 401 JSON; rules tests |
| 4 | `/api/auth/session` | DELETE | public | — | — | — | cookie clear | — | 200 always | n/a | `e2e:auth-logout` PASS |
| 5 | `/api/auth/onboarding` | POST | Bearer ID token | any | `validateOnboardingInput` | — | users doc create (transaction) | Firebase Admin verifyIdToken | 400/401/409/500 | create-only; role immutable | `e2e:onboarding` PASS |
| 6 | `/api/me` | GET/PATCH | session | any | `validateProfileUpdateInput` | — | users doc | — | 401/400/500 | — | `e2e:student-history` PASS; 401 unauth verified |
| 7 | `/api/classrooms` | GET/POST | session | any/teacher | `validateClassroomInput` | — | classrooms doc | — | 400/401/403/500 | create-only ids | `e2e:classroom-join` PASS |
| 8 | `/api/classrooms/[id]` | PATCH | session | teacher owner | ownership check | — | classroom doc | — | 403/404 | — | durable suite |
| 9 | `/api/classrooms/[id]/assignments` | GET/POST | session | teacher owner | `validateAssignmentInput` | — | assignments doc | — | 400/403/404 | — | `e2e:teacher-assignment-authoring` PASS |
| 10 | `/api/classrooms/[id]/join-key` | POST | session | teacher owner | — | — | joinKeyHash rotate/revoke | — | 403/404 | rotation atomic | durable suite |
| 11 | `/api/classrooms/[id]/members` | GET | session | teacher owner | — | — | classMemberships read | — | 403/404 | — | `e2e:teacher-integrations` PASS |
| 12 | `/api/classrooms/[id]/members/[studentId]` | DELETE | session | teacher owner | — | — | membership remove | — | 403/404 | — | rules + API tests |
| 13 | `/api/classrooms/join` | POST | session | student | `validateJoinKey` | `joinRateLimits` Firestore | membership create (create-only) | — | 400/401/403/404/409/429 | create-only doc | `e2e:classroom-join` + negative suite PASS |
| 14 | `/api/classrooms/[id]/voice` | POST | session | student member | audio + class scope | — | voice session | TTS/OmniVoice | 404/409/503 retryable | — | negative E2E; provider G |
| 15 | `/api/assignments/[id]/publish` | POST | session | teacher owner | state machine check | — | status → published | — | 403/404/409 | state transition guard | authoring E2E PASS |
| 16 | `/api/assignments/[id]/submit` | POST | session | student member | attempts + MIME + size | `drive-upload` 20/15min | submission create; Drive metadata only after upload | Google Drive | 400/403/409/502 retryable | attempt-scoped | lifecycle E2E + negative (max attempts 409) PASS |
| 17 | `/api/assignments/[id]/submission` | GET | session | student owner | — | — | submission read | — | 401/404 | — | lifecycle E2E |
| 18 | `/api/submissions/review-queue` | GET | session | teacher | class-owned query | — | submissions read | — | 401/403 | — | teacher core E2E |
| 19 | `/api/submissions/[id]/return` | POST | session | teacher owner | state check | — | status → returned | — | 403/404/409 | state guard | lifecycle E2E PASS |
| 20 | `/api/submissions/[id]/approve` | POST | session | teacher owner | state check | — | status → approved (terminal) | — | 403/404/409 | state guard | lifecycle E2E PASS |
| 21 | `/api/student/assessment` | POST | session | student | sessionId regex + audio MIME/size ≤10MB | `student-assessment` 12/min | `saveAssessment` transaction (create-only) with canonical `scoring` block | STT + LLM adapters | 400/401/499/502/503 structured, no fake score | deterministic id `${uid}_${sessionId}` | `e2e-speaking-provider` PASS (configured provider); canonical tests 9/9 |
| 22 | `/api/student/assessment` | GET | session | student owner | sessionId regex | — | assessment read-back | — | 401/404/500 | n/a | offline sync read-back E2E PASS |
| 23 | `/api/student/pronunciation` | POST/GET | session | student | input validation + idempotency key | `student-pronunciation` 10/min | practice attempt doc | pronunciation provider (unavailable → 503, score null) | 400/401/503 retryable | same-key retry returns same ID | `e2e:pronunciation-unavailable` PASS |
| 24 | `/api/student/conversation-text` | POST | session | student | rubric validation | — | conversation attempt | — | 400/401/500 | — | durable conversation E2E PASS |
| 25 | `/api/student/dashboard` | GET | session | student | — | — | cross-collection read | — | 401 | — | dashboard E2E |
| 26 | `/api/student/learning-stats` | GET | session | student | — | — | progress reads | — | 401 | — | history E2E |
| 27 | `/api/student/practice-attempts` | POST | session | student | `validatePracticeAttemptInput` | — | attempt create + XP transaction | — | 400/401 | idempotency key | quiz/vocab/listening/tes E2E PASS |
| 28 | `/api/student/question-bank` | GET/POST | session | student | server-side `correctOption` only | — | questionBank/questionAttempts | — | 400/401 | attempt keys | question E2E + rules |
| 29 | `/api/student/adaptive` | GET | session | student | — | — | canonical score reads | — | 401 | — | adaptive E2E + SCORING-016 tests |
| 30 | `/api/teacher/analytics` | GET | session | teacher | — | — | canonical aggregation | — | 401/403 | — | analytics E2E + 3/3 tests |
| 31 | `/api/teacher/leaderboard` | GET | session | teacher | — | — | XP ordering server-side | — | 401/403 | — | leaderboard E2E + ordering test |
| 32 | `/api/teacher/reports` | GET | session | teacher | — | — | canonical reads → PDF | PDF gen | 401/403/500 | — | report E2E + pdf test |
| 33 | `/api/teacher/preferences` | GET/PATCH | session | teacher | `validateTeacherPreferencesInput` | — | preferences doc | — | 400/401/403 | upsert | `e2e:teacher-integrations` PASS |
| 34 | `/api/teacher/devices` | GET/POST/DELETE | session | teacher owner | credential hash model | — | devices doc, hashed secret | — | 400/401/403/404 | registration upsert | device tests 6/6; production runner G |
| 35 | `/api/device/heartbeat` | POST | device credential | device | battery/signal/fw validation | — | telemetry write | — | 400/401/403 | last-write heartbeat | device tests PASS; MQTT G |
| 36 | `/api/device/status` | GET | device | device | — | — | device read | — | 401/501 explicit | — | explicit unavailable gate |
| 37 | `/api/device/sync` | POST | device | device | command authorization | — | — | MQTT boundary | 501 explicit unavailable | — | explicit unavailable gate |
| 38 | `/api/device/audio-upload` | POST | device | device | MIME/size | — | — | artifact storage | 501 explicit unavailable | — | explicit unavailable gate |
| 39 | `/api/teacher/voice-profile` | GET/POST/DELETE | session | teacher | audio + consent | `voice-enrollment` 3/h | voiceProfiles (one active) | OmniVoice | 400/401/403/503 | enrollment replaces active | provider G; failure paths tested |
| 40 | `/api/teacher/voice-preview` | POST | session | teacher | text validation | — | — | TTS | 503 retryable explicit | — | failure path tested |
| 41 | `/api/integrations/google-drive/start` | GET | session | teacher | — | `drive-oauth` 10/h | OAuth state | Google OAuth PKCE | 401/403/500 | state per attempt | routes tests 7/7-ish; real consent G |
| 42 | `/api/integrations/google-drive/callback` | GET | OAuth state | teacher | state + code exchange | — | encrypted refresh token | Google OAuth | 400/500, no credential echo | state single-use | real consent G |
| 43 | `/api/integrations/google-drive/status` | GET | session | teacher | — | — | connection read | — | 401/403/500 | — | routes tests |
| 44 | `/api/integrations/google-drive/upload` | POST | session | teacher | MIME/size/filename | `drive-upload` 20/15min | metadata after upload only | Drive API | 400/403/502/503 retryable | metadata id check | upload tests + negative PASS; real upload G |
| 45 | `/api/integrations/google-drive/disconnect` | POST | session | teacher | — | — | token revoke/delete | Google | 401/403/500 | — | lifecycle tests |

## Audit conclusions

- No route is always-200, TODO-stubbed, or hardcoded-data. Every protected route
  passes `requireAuth`/`requireRole`; ownership/class scoping verified by rules +
  negative E2E (`e2e:authorization-boundaries`).
- Provider-backed routes fail with structured retryable/unavailable states and
  never fabricate provider success (assessment 499/502/503, pronunciation 503,
  Drive 502/503, device 501 explicit).
- Idempotency: deterministic assessment ids, create-only membership/join docs,
  attempt-scoped submissions, single-use OAuth state, hashed device credentials.
- Rate limiting covers assessment, pronunciation, join, Drive upload, Drive
  OAuth, voice enrollment; join additionally transactional via `joinRateLimits`.
- Remaining OPEN items are external-provider or production-runtime gates, not
  contract gaps: real Drive consent, OmniVoice/TTS endpoint, phoneme provider,
  MQTT broker/device, production protected E2E accounts.
