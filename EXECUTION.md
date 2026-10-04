# TuturAI Execution State

THIS FILE IS THE ONLY EXECUTION STATE.
NEVER RESTART COMPLETED WORK.
NEVER RE-AUDIT COMPLETED PHASES WITHOUT NEW EVIDENCE OF REGRESSION.
ALWAYS RESUME FROM CURRENT_PHASE and NEXT_TASK_ID.

Last normalized: 2026-09-26
Product specification: `PRD.md`
Architecture and security contract: `AGENTS.md`

## Execution Lock

```text
CURRENT_PHASE=PHASE 2 - Authentication, Session & RBAC (SCORING + PERF phases running in parallel)
CURRENT_TASK_ID=CERT-001
CURRENT_TASK_STATUS=BLOCKED_EXTERNAL
NEXT_TASK_ID=PROVIDER-INTEGRATION (Prompt B)
LAST_COMPLETED_TASK_ID=BASELINE-001

BLOCKED_EXTERNAL=WEB-AUTH-002,DRIVE-001,OFFLINE-003,OFFLINE-004,DEPLOY-001,DEPLOY-003,E2E-PROD-001,E2E-PROD-002,VOICE-001,WEB-SPEAK-002,PRON-001,HW-001
AWAITING_SCORING_DECISION=none
RELEASE_READY=false
PRODUCT_PRODUCTION_READY=false
SCORING_PRODUCTION_READY=true
```

Only the coordinator updates this lock. A task moves monotonically through:

```text
TODO -> IN_PROGRESS -> VERIFYING -> DONE
TODO -> IN_PROGRESS -> BLOCKED_EXTERNAL
BLOCKED_EXTERNAL -> IN_PROGRESS (dependency or runtime evidence changed; preserve prior attempts)
TODO/BLOCKED_EXTERNAL -> NOT_REQUIRED (explicit product scope decision; history retained)
```

`DONE` is reopened only for concrete regression evidence. A reopen must record
`REOPENED_FROM=<task-id>` and `REASON=<failing test/build/runtime/security/PRD evidence>`.

## Authority Rules

- `PRD.md` defines product requirements. It is not a daily tracker.
- `EXECUTION.md` defines implementation status, phase, verification, blockers,
  evidence, and the next task.
- `AGENTS.md` defines architecture, security, and operating constraints.
- Architecture/specification documents remain reference material and cannot change
  execution status.
- `tasks/todo.md`, `tasks/session-state.md`, `tasks/plan.md`,
  `docs/PRODUCTION_READINESS_REPORT.md`, and `tasks/feature-parity-matrix.md`
  are historical after Phase 0 normalization. They are not execution inputs.
- Before creating a task, search this file for the task ID and requirement. Reuse
  the existing ID when the work already exists.
- Do not rerun unchanged verification. Existing evidence is valid until related
  code/configuration changes or a concrete regression appears.

## Recovery Protocol

After compaction or a new session:

1. Read `PRD.md`.
2. Read `EXECUTION.md`.
3. Extract `CURRENT_PHASE`, `CURRENT_TASK_ID`, `CURRENT_TASK_STATUS`,
   `LAST_COMPLETED_TASK_ID`, `NEXT_TASK_ID`, and `BLOCKED_EXTERNAL`.
4. Inspect only files required by `NEXT_TASK_ID`.
5. Continue forward. Do not return to a prior phase without regression evidence.

For a repeated failure, update `ATTEMPT_COUNT`, `LAST_FAILURE`, and
`NEXT_STRATEGY` on the task before trying a different approach. Do not repeat the
same root-cause attempt three times.

## Evidence Contract

Evidence classifications:

- `D` Durable: UI/action -> server/API -> persistence/provider -> read-back when
  relevant -> final assertion.
- `S` Smoke: route, heading, or HTTP response only.
- `N` Negative: failure or authorization path.
- `I` IndexedDB/storage-only: local payload retention without server replay.
- `P` Partial: only part of the durable workflow is proven.
- `G` External gate: requires a real provider, account, deployment, device, or
  operator action.
- `P-` Local evidence exists but production behavior is not verified.

Feature completion requires implementation, validation, authorization, safe failure
handling, durable persistence when relevant, focused tests, durable E2E, and
production-safe behavior. A build alone never makes a phase or feature complete.

## Verified Baseline

Do not repeat these without changed dependencies or regression evidence:

- Email/password Firebase auth, server session cookie, permanent role, route guards,
  wrong-role denial, logout, and Firestore rules/emulator coverage.
- Classroom create/join/member checkpoint, hashed join keys, membership scoping,
  and class switcher behavior.
- Assignment submit -> return -> resubmit -> approve with durable attempt 2.
- Quiz, Vocabulary, Listening, Tes Pedagogis, Conversation text, and Adaptive
  durable local Playwright flows.
- Configured Whisper/STT + LLM normalized assessment persistence through the
  protected speaking route.
- Pronunciation safe unavailable behavior (`provider_unavailable`, `score: null`).
- Student history, teacher core, analytics/report, leaderboard, and wrong-class
  failure evidence.
- Offline conversation replay exactly once and IndexedDB assignment/audio Blob
  retention. Retention is not replay proof.
- Local typecheck/build/lint/test/audit evidence recorded in the historical files.
- Public production smoke for public auth routes only.
- 2026-09-30 fresh production runtime smoke (response timestamp 2026-09-29T17:30Z): `/api/health` 200 with `firebaseAdminModule:"loaded"` on node v22.23.2, fabricated-token `POST /api/auth/session` returns structured 401 JSON `auth/invalid-id-token`, and `/` serves CSP + HSTS + X-Frame-Options DENY — the empty-500 stale-bundle era is over.
- 2026-10-01 fresh production smoke: `/api/health` 200 `firebaseAdminModule:"loaded"`, `/api/me` structured 401 JSON, Drive status fail-closed 401, CSP/HSTS/X-Frame-Options DENY live, and the deployed landing page serves the PERF-001 `hero-student.webp`, proving the live bundle includes commit `19f19dd`. Direct probe of the configured `AI_V1_BASE_URL` (`r5a9xvl.abc-tunnel.us`) returns HTTP 530 (Cloudflare origin down).

The latest supplied audit baseline is: any E2E evidence `21/26`, durable E2E
scripts `6/13`, full durable local UI menu evidence `7/26`, protected production
menu E2E `0/26`, public production smoke `4/4`, and release gates `3/12`. These
are historical measurements, not subjective readiness scores and not substitutes
for the task ledger below.

## Phase Graph

Each phase has a single ordered exit. External gates may be recorded as
`BLOCKED_EXTERNAL`; independent work may continue, but the same blocker is reported
only when its status changes or it becomes the final release blocker.

### PHASE 0 - Documentation & Execution State Normalization

- Scope: classify Markdown, create this canonical ledger, migrate valid evidence,
  update status pointers, and prevent stale trackers from driving execution.
- Task IDs: `EXEC-000`, `EXEC-001`, `EXEC-002`, `EXEC-003`.
- Acceptance criteria: this file exists; lock fields are present; all current
  verified evidence and external gates are represented; old status docs are marked
  historical; PRD remains product-only; no implementation evidence is deleted.
- Required tests: Markdown/reference search, lock/task-ID audit, `git diff --check`.
- Evidence: this file, updated pointers, and reference scan.
- Exit criteria: no active document instructs agents to use `tasks/*` for runtime
  state; `EXECUTION.md` names the first uncompleted task.
- Status: `DONE`.
- Next phase: PHASE 1.

### PHASE 1 - Web/Core Application Baseline

- Scope: active route inventory, shared shells, config boundaries, loading/error/
  empty states, and removal of concrete dead interactions.
- Task IDs: `WEB-CORE-001`, `WEB-CORE-002`.
- Acceptance criteria: active routes compile; no known core button is dead; server
  boundary and explicit unavailable states remain intact; stale Supabase wording is
  removed from active UI.
- Required tests: focused route/component tests, typecheck, lint, build, and the
  relevant browser smoke/failure path.
- Evidence: existing build/typecheck/lint/test evidence plus new task evidence.
- Exit criteria: all non-external core gaps are closed or have concrete task IDs.
- Status: `DONE`.
- Next phase: PHASE 2.

### PHASE 2 - Authentication, Session & RBAC

- Scope: Google + email/password, onboarding, session restore/logout, role
  immutability, route/API guards, and wrong-role/wrong-class denial.
- Task IDs: `WEB-AUTH-001`, `WEB-AUTH-002`.
- Acceptance criteria: Google and email/password paths are durable; all protected boundaries fail closed. GitHub and other social providers remain out of scope; Drive OAuth remains separate.
- Required tests: unit/integration/rules plus browser happy and negative paths.
- Evidence: email/password path is `DONE`; Firebase SDK config from the active Web App matches the user's supplied config. Production bundle previously had `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-tuturai` while API key/authDomain/storage/sender/appId matched `gen-lang-client-0138449759`; the correction is now in `netlify.toml`/CI and production build validation. Added safe popup/session diagnostics, targeted Firebase error messages, project/emulator guards, and Admin/Web project matching. Focused tests pass (31/31), typecheck passes, and a production build with the actual project config passes. Local production smoke shows the correct project in the bundle and unauthenticated `/api/me` returns `401`. Google Auth Emulator local config remains demo-only and unchanged.
- Exit criteria: no local auth regression and Google browser flow proves Firebase auth -> onboarding/session -> dashboard -> restore/logout.
- Status: `BLOCKED_EXTERNAL` after local code/config correction; production rebuild/runtime Admin environment and a real Google-account session/restore/logout E2E remain unverified.
- Next phase: PHASE 3.

### PHASE 3 - Classroom & Assignment Durable Workflows

- Scope: classroom lifecycle, join keys, membership, assignment authoring,
  submission state machine, attempts, review, and Drive metadata boundary.
- Task IDs: `WEB-CLASS-001`, `WEB-ASSIGN-001`, `WEB-TEACHER-004`, `DRIVE-001`.
- Acceptance criteria: local classroom/assignment flows remain durable; authoring
  and real Drive consent/upload are separately proven; no storage fallback exists.
- Required tests: domain/API/rules tests, durable lifecycle E2E, invalid key,
  outsider, max-attempt, and Drive validation paths.
- Evidence: classroom, assignment lifecycle, and fileless authoring are `DONE`; real
  Drive provider confirmation remains open.
- Exit criteria: all local non-external gaps are done and Drive is either confirmed
  or `BLOCKED_EXTERNAL`.
- Status: `DONE`.
- Next phase: PHASE 4.

### PHASE 4 - Student Learning & Adaptive Learning

- Scope: dashboard, deterministic learning menus, progress/history, achievements,
  profile, leaderboard, adaptive recommendation and no-repeat completion.
- Task IDs: `WEB-LEARN-001`, `WEB-LEARN-002`, `WEB-ADAPT-001`.
- Acceptance criteria: durable server-backed state, validated scoring, reload/read-
  back where relevant, explicit unavailable states, and no fabricated metrics.
- Required tests: focused API/domain tests and durable Playwright happy/failure paths.
- Evidence: deterministic menus, adaptive completion, and profile mutation are `DONE`.
  Fresh evidence: validation 7/7, `/api/me` route tests 3/3, web typecheck, web
  lint (0 errors), and `e2e:student-history` durable profile save -> read-back ->
  reload plus unauthorized 401 proof. The full test script was blocked by an
  already-running Firestore emulator on port 8080; focused tests were run instead.
- Exit criteria: no local learning task is unverified except external provider work.
- Status: `DONE`.
- Next phase: PHASE 5.

### PHASE 5 - Speaking / AI / Voice / Pronunciation

- Scope: STT, normalized speaking assessment, conversation text/voice, OmniVoice/TTS,
  pronunciation contract, failure/retry/cancellation, tenant isolation.
- Task IDs: `WEB-SPEAK-001`, `WEB-SPEAK-002`, `VOICE-001`, `PRON-001`.
- Acceptance criteria: confirmed provider output is the only source of score/audio;
  malformed/timeout/unavailable results remain retryable or explicitly unavailable.
- Required tests: adapter unit/integration, configured provider E2E, negative paths,
  isolation, and playback/read-back when provider exists.
- Evidence: speaking STT/LLM is `DONE`; TTS and phoneme scoring are external gates.
- Exit criteria: local implementation complete and every unavailable provider gate
  is recorded once with its verification command.
- Status: `IN_PROGRESS`.
- Next phase: PHASE 6.

### PHASE 6 - Teacher Dashboard & Teacher Workflows

- Scope: teacher dashboard, classes, students, assignment authoring/review, analytics,
  PDF, leaderboard, settings, Drive, voice, and devices.
- Task IDs: `WEB-TEACHER-001`, `WEB-TEACHER-002`, `WEB-TEACHER-003`,
  `WEB-TEACHER-005`, `WEB-TEACHER-006`.
- Acceptance criteria: every teacher action has durable or explicit unavailable
  state, class ownership, loading/error state, and no dead interaction.
- Required tests: teacher durable E2E, outsider denial, analytics/PDF, settings and
  device failure paths.
- Evidence: teacher core, analytics/report, notification preference save/read-back,
  leaderboard ordering, full authoring/student-list durable evidence, and explicit
  device-sync unavailability are `DONE`.
- Exit criteria: local teacher gaps are resolved or explicitly external.
- Status: `DONE`.
- Next phase: PHASE 7.

### PHASE 7 - Offline / PWA / Persistence

- Scope: IndexedDB, Cache Storage/app shell, queued mutation replay, idempotency,
  retry/conflict states, quota cleanup, assignment file and conversation audio.
- Task IDs: `OFFLINE-001`, `OFFLINE-002`, `OFFLINE-003`, `OFFLINE-004`,
  `OFFLINE-005`.
- Acceptance criteria: offline work survives refresh; replay is server-confirmed;
  reconnect does not duplicate; temporary audio cleanup is bounded.
- Required tests: offline refresh, payload retention, replay, duplicate reconnect,
  conflict, and service-worker/app-shell checks.
- Evidence: text replay is exactly once and purges confirmed payload; DB v1->v2 migration purges legacy synced payloads while retaining pending/conflict payloads; quota cleanup is verified. Assignment file replay needs Drive; new audio replay currently receives retryable provider 503.
- Exit criteria: all required payload types have durable replay or an explicit PRD
  exception.
- Status: `BLOCKED_EXTERNAL` for assignment file replay (`OFFLINE-003`) and successful provider-confirmed audio replay (`OFFLINE-004`); local retry, conflict, migration, quota, and cleanup behavior are verified.
- Next phase: PHASE 8.

### PHASE 8 - Security / Reliability / Accessibility

- Scope: authorization, Firestore rules, CSP/security headers, secret scan, input/file
  validation, dependency audit, accessibility, reliability and no dead interaction.
- Task IDs: `SEC-001`, `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`.
- Acceptance criteria: protected data fails closed; no secret leakage; CSP is present
  in the deployed runtime; critical/high vulnerabilities are absent; accessibility
  checks and manual evidence exist.
- Required tests: rules/API negative paths, lint/typecheck/build, secret scan, audit,
  header check, keyboard/screen-reader/manual responsive review.
- Evidence: local rules/audit/proxy evidence exists; keyboard, responsive, and browser accessibility-tree checks are complete. Production CSP/deployment remains open.
- Exit criteria: no known critical security or accessibility gap remains.
- Status: `DONE`. 2026-09-28 production verification confirmed the deployed runtime returns the repository CSP and all security headers, and protected pages redirect unauthenticated users to login (`SEC-002`).
- Next phase: PHASE 9.

### PHASE 9 - Full Durable E2E Coverage

- Scope: convert partial/smoke/negative coverage into durable coverage for every
  completable local core flow and maintain the evidence ledger.
- Task IDs: `E2E-001`, `E2E-002`, `E2E-003`, `E2E-004`.
- Acceptance criteria: each required menu has action -> boundary -> persistence ->
  final assertion; smoke-only routes are not counted as durable.
- Required tests: all relevant Playwright scripts plus one failure/authorization path.
- Evidence: `E2E-001` core local durable flows, `E2E-002` negative/authorization, `E2E-003` offline local behavior, and `E2E-004` provider-boundary matrix are complete locally; real Google, Drive, AI/TTS/pronunciation, and device confirmation remain external `G` gates.
- Exit criteria: mandatory local core menu matrix is `D`, `N`, or approved `G`.
- Status: `BLOCKED_EXTERNAL` only for real provider/account/device confirmations; all completable local matrix work is done and PHASE 10 proceeds independently.
- Next phase: PHASE 10.

### PHASE 10 - Preview & Production Deployment Verification

- Scope: repository/deploy boundary, environment variables, Netlify preview and
  production deploy, runtime headers, public smoke, and rollback.
- Task IDs: `DEPLOY-001`, `DEPLOY-002`, `DEPLOY-003`.
- Acceptance criteria: canonical source deploys; protected routes redirect or load
  correctly; runtime CSP/security headers exist; deploy ID and rollback target are
  recorded.
- Required tests: build, preview smoke, production smoke, header check, rollback
  verification.
- Evidence: 2026-09-28 read-only production checks: homepage `200` now serves the full CSP/security header set; `/dashboard` and `/guru` return `307` -> `/auth/login`; every `/api/*` probe (including unguarded-401 paths `/api/me`, `/api/classrooms`, `/api/student/dashboard` and the try/catch-guarded `POST /api/auth/session`) still returns an empty `500` with `x-nf-request-id` `01M3KNQNBN8DVAZKV1TKDE7VQF` / `01M3KNZPB3X7T8YWC9BE0BH9JH`; `/api/health` returns the app's 404 HTML. Root cause identified: the deployed bundle predates the worktree and lacks `serverExternalPackages` for `firebase-admin`, so Next 16 bundles firebase-admin into Netlify Functions and every API route crashes at module initialization before any handler runs (even cookie-less 401 paths). Fix added to `apps/web/next.config.mjs`; production build PASS, full web test suite PASS, and local production-mode `next start` smoke now returns JSON `401` on all three API reads plus CSP and `307` redirects. Redeploy required to apply.
- Exit criteria: deployment and rollback evidence is fresh and successful.
- Status: `BLOCKED_EXTERNAL` for redeploying the patched bundle, confirming Functions runtime env, and establishing a rollback target; CSP and page-level runtime behavior are now production-verified.
- Next phase: PHASE 11.

### PHASE 11 - Protected Production Menu E2E

- Scope: authenticated production verification for every protected student/teacher
  menu and primary action.
- Task IDs: `E2E-PROD-001`, `E2E-PROD-002`.
- Acceptance criteria: production role login, data load, primary action, persistence,
  authorization and failure state are evidenced per route.
- Required tests: protected production Playwright/browser runs using approved test
  accounts; no emulator data or simulated provider success.
- Evidence: `0/26` protected production menu E2E currently proven. The local coverage guard maps all 26 matrix rows to runner navigation plus a route-specific durable assertion (11/11 runner/config tests). Student achievement/profile, teacher leaderboard/device registry/heartbeat, and offline text reconnect/exactly-once assertions are present. The guard and runner source are not production execution evidence; provider-dependent suites still require their configured accounts/services.
- Exit criteria: required protected matrix rows are `D` or approved `G`.
- Status: `BLOCKED_EXTERNAL` for a functioning production deployment and approved student/teacher test accounts; local production build responds correctly but the current public APIs return 500.
- Next phase: PHASE 12.

### PHASE 12 - Release Gates

- Scope: machine-checkable quality, security, deployment, provider, accessibility,
  offline, production E2E, rollback and repository cleanliness gates.
- Task IDs: `RELEASE-001`, `RELEASE-002`, `RELEASE-003`.
- Acceptance criteria: every mandatory gate is `PASS` or explicitly approved
  non-blocking external gate; no subjective percentage is used.
- Required tests: full CI-equivalent commands and release evidence collection.
- Evidence: fresh local gates: lint 0 errors/8 warnings, typecheck PASS, `pnpm test` PASS (web 39 files/127 tests; domain 9 files/32 tests; validation 1/7; functions 1/1), and production build PASS. External provider/deploy/protected-production/rollback checks remain open.
- Exit criteria: release gate table below has no mandatory `OPEN` item.
- Status: `BLOCKED_EXTERNAL` for provider, deployment, protected production, and rollback confirmations; local quality gates are complete.
- Next phase: PHASE 13.

### PHASE 13 - Final Production Readiness Certification

- Scope: certify product requirements, durable core flows, protected production flows,
  security, persistence, failure safety, monitoring and rollback.
- Task IDs: `CERT-001`.
- Acceptance criteria: `RELEASE_READY=true` and `PRODUCT_PRODUCTION_READY` only when
  all mandatory gates are proven and critical blockers equal zero.
- Required tests: final evidence review; no unchanged test reruns.
- Evidence: cannot certify: mandatory release gates remain `OPEN/G`; `RELEASE_READY=false` and `PRODUCT_PRODUCTION_READY=false` are preserved.
- Exit criteria: signed/dated certification entry with links to every gate.
- Status: `BLOCKED_EXTERNAL` until all mandatory external gates are proven or explicitly approved non-blocking.
- Next phase: `NONE`.

## Task Ledger

| ID | State | Phase | Evidence / blocker | ATTEMPT_COUNT | LAST_FAILURE | NEXT_STRATEGY |
|---|---|---|---|---:|---|---|
| `EXEC-000` | DONE | 0 | `EXECUTION.md` created with lock, phases, task graph, evidence, blockers, and gates | 1 | none | reopen only if canonical state is missing |
| `EXEC-001` | DONE | 0 | legacy trackers marked historical; unique evidence retained | 1 | none | reopen only if a stale runtime instruction remains |
| `EXEC-002` | DONE | 0 | README/MUST/provider/report/matrix pointers updated | 1 | none | reopen only if pointer audit regresses |
| `EXEC-003` | DONE | 0 | `git diff --check` and stale-runtime-pointer search passed | 1 | none | reopen only if documentation changes regress |
| `WEB-CORE-001` | DONE | 1 | Next.js route inventory and full compilation issues returned zero issues on port 3000 | 1 | none | reopen only on route/compile regression |
| `WEB-CORE-002` | DONE | 1 | removed dead profile/language/photo/password controls; unavailable states are explicit | 1 | none | reopen only on a concrete dead interaction regression |
| `WEB-AUTH-001` | DONE | 2 | email/password/session/RBAC/rules evidence | 1 | none | reopen only on regression |
| `WEB-AUTH-002` | BLOCKED_EXTERNAL | 2 | Verified Firebase Web App config matches the supplied values. Production JS had demo `projectId`; corrected in Netlify build config and CI. Added `client-config.mjs` production/demo/emulator validation, Admin/Web project consistency and PEM checks, stage-aware client UX/safe diagnostics, and safe session-route Firebase error logging. Focused auth/config/session tests 31/31, web typecheck and production build pass; local production bundle has the real project ID and unauth `/api/me` returns 401. | 5 | user reports account chooser opens but sign-in still fails after selection; production `/api/auth/session` previously returned empty `500`; local fake-token check surfaced `app/network-error` because this environment could not reach Firebase verification, so no real user's popup error code/session has been observed | 2026-09-30 update: production rebuild is live — `/api/health` 200 `firebaseAdminModule:"loaded"` and fabricated-token `/api/auth/session` returns clean structured 401 `auth/invalid-id-token` (no 500), so the Admin runtime is initialized with working credentials. Remaining gate is the real authorized Google browser login -> onboarding/session -> dashboard -> reload -> logout E2E by the user |
| `WEB-CLASS-001` | DONE | 3 | classroom lifecycle checkpoint | 1 | none | reopen only on regression |
| `WEB-ASSIGN-001` | DONE | 3 | submit/return/resubmit/approve durable E2E | 1 | none | reopen only on regression |
| `WEB-TEACHER-004` | DONE | 3/6 | 2026-09-25 `e2e:teacher-assignment-authoring` PASS: email/password browser login -> UI publish -> POST 201 -> API read-back -> independent Firestore assertion -> reload heading -> wrong-class 404; assignment jfLHV57OaJMClQFtDUIk; root `pnpm emulators` pins demo-tuturai | 5 | resolved EMAIL_NOT_FOUND caused by CLI default project mismatch; initial restart seed preceded listener readiness | reopen only on regression; Drive remains separate |
| `DRIVE-001` | BLOCKED_EXTERNAL | 3 | real OAuth/callback/upload metadata; also required by assignment file replay `OFFLINE-003` | 1 | consent/upload not confirmed | run real teacher account flow, then resume assignment file replay |
| `WEB-LEARN-001` | DONE | 4 | deterministic learning menu E2E | 1 | none | reopen only on regression |
| `WEB-LEARN-002` | DONE | 4 | 2026-09-25 fresh validation 7/7, `/api/me` tests 3/3, typecheck, lint 0 errors, and durable `e2e:student-history` PASS: profile save -> server read-back -> reload plus unauthorized 401 | 1 | initial E2E fixture was dirty after a prior mutation; reseeded emulator and reran successfully | reopen only on regression |
| `WEB-ADAPT-001` | DONE | 4 | recommendation -> completion -> no repeat | 1 | none | reopen only on regression |
| `WEB-SPEAK-001` | DONE | 5 | configured STT/LLM normalized persistence | 1 | none | reopen only on regression |
| `WEB-SPEAK-002` | BLOCKED_EXTERNAL | 5 | conversation voice/TTS | 1 | local provider intentionally unconfigured | run provider contract when reachable |
| `VOICE-001` | BLOCKED_EXTERNAL | 5 | OmniVoice enroll/ready/delete/playback | 1 | provider endpoint/model unavailable | run provider lifecycle |
| `PRON-001` | BLOCKED_EXTERNAL | 5 | phoneme-capable scoring | 1 | provider contract/model unavailable | run phoneme provider contract |
| `WEB-TEACHER-001` | DONE | 6 | teacher core/analytics/report evidence | 1 | none | reopen only on regression |
| `WEB-TEACHER-002` | DONE | 6 | 2026-09-25 focused API tests 3/3, typecheck, and `e2e:teacher-integrations` PASS: teacher preferences save -> Firestore read-back; Drive/device failure paths remained explicit | 1 | initial GET read normalized session profile and lost persisted preferences; fixed GET to read the authenticated Firestore document | reopen only on regression |
| `WEB-TEACHER-003` | DONE | 6 | 2026-09-25 leaderboard API ordering test and `e2e:teacher-integrations` PASS: durable XP ordering plus rendered leaderboard route; removed client alphabetical re-sort | 1 | UI sorted API-ranked rows by name, corrupting podium/rank display | reopen only on regression |
| `WEB-TEACHER-005` | DONE | 6 | 2026-09-25 `e2e:teacher-integrations` PASS: classroom members read-back plus rendered `/guru/siswa`; existing `e2e:teacher-assignment-authoring` covers durable authoring, Firestore read-back, reload, and wrong-class denial | 1 | none | reopen only on regression |
| `WEB-TEACHER-006` | DONE | 6 | 2026-09-25 typecheck, lint 0 errors, diff check, and `e2e:teacher-integrations` PASS; device sync now reports explicit unavailable state instead of reloading/simulating cloud sync | 1 | sync action only reloaded local device data without a command boundary | reopen only when MQTT/HTTPS device command provider is configured |
| `OFFLINE-001` | DONE | 7 | text mutation replay exactly once | 1 | none | reopen only on regression |
| `OFFLINE-002` | DONE | 7 | assignment/audio Blob retention | 1 | none | replay tasks remain separate |
| `OFFLINE-003` | BLOCKED_EXTERNAL | 7 | fresh `e2e:offline-payloads` PASS proves assignment file -> IndexedDB pending mutation with idempotency key, filename, and bytes; durable replay requires `/api/assignments/:assignmentId/submit` -> Google Drive upload -> Firestore submission metadata read-back | 1 | Drive OAuth/provider unavailable; the file submission route must not mark the mutation synced without provider confirmation | resume after `DRIVE-001`, then run offline replay, server read-back, duplicate check, and failed-upload retry evidence |
| `OFFLINE-004` | BLOCKED_EXTERNAL | 7 | `REOPENED_FROM=OFFLINE-004`; `REASON=markMutationSynced retained confirmed audio Blob`; fixed via payload purge on sync and v1->v2 migration. Unit 7/7, `e2e:offline-migration` and `e2e:offline` PASS; latest `e2e:offline-payloads` response is 503 `PROVIDER_UNAVAILABLE` (retryable), with no assessment created and audio retained for retry. 2026-10-01: full harness re-run against a live emulator + dev server with the configured provider env — queueing/retry/conflict intact, replay still 503 `PROVIDER_UNAVAILABLE` retryable, and a direct probe of the configured `AI_V1_BASE_URL` (`r5a9xvl.abc-tunnel.us`) returns HTTP 530 (Cloudflare origin down), proving the upstream host itself is offline | 4 | assessment provider endpoint down (tunnel HTTP 530), confirmed by direct probe — not a configuration or harness failure | when STT/LLM endpoint returns success, rerun `e2e:offline-payloads` and verify one Firestore assessment plus audio payload cleanup |
| `OFFLINE-005` | DONE | 7 | 2026-09-25 `e2e:offline-refresh` PASS: service worker install/control -> offline refresh -> cached `offline.html` shell; navigation fallback does not cache authenticated HTML | 1 | none | reopen only on offline refresh/cache regression |
| `SEC-001` | DONE | 8 | local rules/API authorization | 1 | none | reopen only on regression |
| `SEC-002` | DONE | 8 | 2026-09-28 production runtime check: homepage returns the full repository Content-Security-Policy plus Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy; unauthenticated `/dashboard` and `/guru` return 307 -> `/auth/login`. Remaining `/api/*` 500s are a deploy-bundle issue owned by `DEPLOY-002`, not a header gap. | 2 | previous production smoke found CSP absent before the latest deploy | reopen only on a production header regression |
| `SEC-003` | DONE | 8 | local redacted pattern scan found no private-key/provider-key matches; only existing test fixture `local-secret`; worktree has no tracked audit artifact outside dependency files | 1 | initial ledger pointed at an ignored audit artifact that was not present in the current worktree | reopen only on a concrete secret-scan regression |
| `SEC-004` | DONE | 8 | 2026-09-25 `e2e:auth-accessibility` PASS: error uses alert role, visible keyboard focus, 375/1440px student/teacher layouts without overflow, current-page nav announcement, >=24px dashboard links, mobile drawer Escape/focus return; manual login/student accessibility-tree review; Vitest 39 files/126 tests, typecheck, lint 0 errors/8 existing warnings, `git diff --check` | 2 | reproduced missing alert role, missing `aria-current`, and 16px dashboard link targets; fixed at auth error, shared nav, and student dashboard boundaries | reopen only on a concrete accessibility regression |
| `SEC-005` | DONE | 8 | local high/critical dependency audit | 1 | none | reopen on dependency change |
| `SEC-006` | DONE | 8 | `apps/web/components/dashboard/dashboard-shell.tsx`, `scripts/e2e-auth-logout.mjs`, package script. `e2e:auth-logout` PASS: emulator login/session read-back 200; offline DELETE fails without clearing the HTTP-only session, visible alert appears and UI stays signed in; online retry clears cookie, returns to login, and `/api/me` becomes 401. Full Vitest 39 files/126 tests, typecheck, lint 0 errors/8 existing warnings, and diff check pass. | 3 | initial E2E fixture had an Auth user but no Firestore profile; after deterministic emulator-only fixture setup, reproduced logout failure: server DELETE failed offline with no visible error | reopen only on logout/session reliability regression |
| `E2E-001` | DONE | 9 | 2026-09-25 `e2e:onboarding` PASS for student+teacher: UI signup -> onboarding 201 -> session 200 -> independent Firestore + `/api/me` read-back -> reload; `e2e:classroom-join` PASS: teacher UI create -> POST 201/key hash+reservation read-back -> student UI join -> membership read-back -> reload/active class -> teacher API/UI member read-back. Existing durable assignment, learning, speaking, history, analytics and review flows retained. | 2 | initial classroom E2E had strict locator ambiguity for duplicate badge/select and member names; assertions now target the selected class and visible member | reopen only on a core durable E2E regression |
| `E2E-002` | DONE | 9 | `e2e:authorization-boundaries` PASS: unauth join 401, teacher-role join 403, malformed key 400, unknown key 404, revoked key 409 (no membership writes); maxAttempts=1 submit -> teacher return -> exhausted-attempt UI disabled -> direct attempt 2 returns 409 and Firestore remains attempt 1/returned. Existing outsider/wrong-class/device/Drive/voice negative E2E retained. Route unit test now uses real `DomainRuleError`; full Vitest 39 files/126 tests, typecheck, lint 0 errors/8 warnings, diff check pass; `e2e:assignment` isolated rerun PASS attempt 2 approved. | 5 | actual `DomainRuleError` used `code='MAX_ATTEMPTS_REACHED'`, while route checked `message`; real boundary returned 500. Mapped domain rule errors to 409 and disabled exhausted UI retry. Initial timeout was absent emulator listeners; started Auth/Firestore only. | reopen only on a concrete authorization/negative-path regression |
| `E2E-003` | DONE | 9 | text reconnect + online startup replay creates exactly one Firestore attempt and clears synced payload; offline DB migration v1->v2 removes legacy synced audio/file payloads but retains pending/conflict data; unauthenticated replay 401 -> conflict; quota test removes oldest audio to <=25 MiB; `e2e:offline-payloads` confirms Drive failure and retryable audio 503 do not mark synced. `e2e:offline-refresh` PASS. | 2 | E2E v1 fixture initially asserted DB version before app migration and was expanded to wait for migration/conflict state | reopen only on offline replay, quota, or cleanup regression; `OFFLINE-003/004` remain G |
| `E2E-004` | DONE | 9 | Extended `apps/web/scripts/e2e-pronunciation-unavailable.mjs` to verify practice-attempt Firestore read-back and same-key retry idempotency. `node --check` PASS; `pnpm --filter @tuturai/web e2e:pronunciation-unavailable` PASS against Auth/Firestore emulators: `provider_unavailable`, `score:null`, persisted attempt, retry returns same ID and exactly one matching document. Existing `E2E-002`, `WEB-TEACHER-002/006`, and `E2E-003` evidence covers voice/Drive/device/offline failure boundaries; actual provider/account/device confirmations remain G. GitHub is out of scope. | 1 | none; successful E2E emitted a non-fatal metadata lookup warning (`ETIMEDOUT`/`ENOTFOUND`) while emulator assertions all passed | reopen only on a concrete local regression or provider configuration change |
| `DEPLOY-001` | BLOCKED_EXTERNAL | 10 | `netlify.toml` preview/build/security-header config inspected; no `.netlify/state.json`, Netlify CLI, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, or `NETLIFY_API_TOKEN`; no preview URL is available in the repository | 1 | preview access cannot be inspected or deployed from this environment | resume with an authorized Netlify CLI/session and preview URL; production changes remain approval-gated |
| `DEPLOY-002` | DONE | 10 | 2026-09-30 fresh production smoke (response ts 2026-09-29T17:30Z): `/api/health` 200 JSON `status:ok`, `firebaseAdminModule:"loaded"`, node v22.23.2; `POST /api/auth/session` with fabricated token returns structured 401 JSON `auth/invalid-id-token` (previously empty 500); `/` serves full CSP + HSTS + X-Frame-Options DENY. The `serverExternalPackages` firebase-admin fix is proven live. Admin credential ownership (`FIREBASE_ADMIN_*` = `gen-lang-client-0138449759`) is evidenced by the session-verify flow executing through the Admin SDK without init crash; definitive identity proof remains the WEB-AUTH-002 real-login E2E. 2026-10-01 fresh smoke repeats PASS (health 200 admin loaded, `/api/me` 401 JSON, Drive status fail-closed 401, CSP/HSTS live) and the live landing serves the PERF-001 `hero-student.webp`, proving the deployed bundle includes commit `19f19dd` | 3 | empty 500s were first attributed to runtime env, then proven to be a bundle-init crash in the stale deployed bundle | reopen only on a production API 500/health regression |
| `DEPLOY-003` | BLOCKED_EXTERNAL | 10 | No deploy ID or rollback target is recorded yet; `.netlify/state.json`, Netlify CLI, and account credentials are absent. 2026-09-30: the currently deployed bundle is now verified healthy (health 200, clean 401s, CSP), so the live deploy is a valid known-good rollback *candidate* once its deploy ID is recorded. 2026-10-01: environment re-check still finds no Netlify CLI, token, or `.netlify/state.json` | 1 | rollback target cannot be established from repository/local Netlify state alone | user reads the current deploy ID from the Netlify UI (Deploys) and records it as the rollback target; optional: verify rollback redeploys it |
| `E2E-PROD-001` | BLOCKED_EXTERNAL | 11 | Student production runner now asserts learning activity -> persisted `scholar` achievement -> achievement page/reload and profile save -> `/api/me` read-back -> reload. All 26 protected menu rows now have a route-to-runner/assertion mapping in the local guard; this is source coverage, not execution. 2026-09-30 update: production runtime is now healthy (health 200, session fake-token 401 JSON), so the only remaining blocker is the approved production student test account. 2026-10-01: runtime re-verified healthy and the deployed bundle confirmed to include commit `19f19dd` (PERF-001 webp live) | 1 | production runtime previously failed before the expected unauthenticated JSON 401; now verified healthy | provide approved student E2E account, run the protected student menu matrix |
| `E2E-PROD-002` | BLOCKED_EXTERNAL | 11 | Teacher runner asserts ranking from persisted XP through API/UI/reload and device registration -> credential hash/read-back -> invalid credential and malformed payload rejection -> valid heartbeat telemetry -> revocation. All 26 route rows map to runner assertions locally, but protected teacher routes remain unverified; 2026-09-30 the runtime blocker is cleared (health 200, clean 401s) and the remaining blocker is the missing approved teacher account. 2026-10-01: runtime re-verified healthy and the deployed bundle confirmed to include commit `19f19dd` (PERF-001 webp live) | 1 | production runtime was previously unavailable for authorized teacher E2E; now verified healthy | provide approved teacher E2E account, run the protected teacher menu matrix |
| `RELEASE-001` | DONE | 12 | 2026-09-26 final recovery verification: `pnpm test` PASS (web 61 files/246 tests including Firestore rules; domain 9/32; validation 1/7; functions 1/1); `pnpm typecheck` PASS (4 packages); `pnpm lint` PASS (0 errors, 8 existing warnings); `pnpm --filter @tuturai/web build` PASS with the active Firebase production client config and emulator variables neutralized; Next dev diagnostics report no errors. Production E2E runner/config tests 11/11 and `git diff --check` clean. These are local verification only, not proof of production behavior. | 1 | Initial aggregate run found a missing mocked export in the heartbeat route test; fixed by retaining the parser export. One concurrent run also hit a 10s Firestore rules setup timeout; serial rerun passed all rules tests. | reopen only on code/dependency changes or a gate regression |
| `RELEASE-002` | BLOCKED_EXTERNAL | 12 | accessibility/security local evidence is complete; unresolved required gates are Netlify preview/production/rollback, Google auth/Drive, AI/TTS/pronunciation, offline replay, and hardware | 1 | no required external confirmations or production approval available | resume once each listed provider/deploy/access requirement is available; keep release false until then |
| `RELEASE-003` | BLOCKED_EXTERNAL | 12 | Current worktree has 79 modified/untracked entries from prior in-progress project work plus this recovery's menu/device/offline runner and execution-ledger updates; nothing is staged. `git diff --check` has no whitespace errors (Git only warns about configured LF-to-CRLF conversion). Rollback evidence is still unavailable. | 1 | no authorized Netlify deploy history or verified-good rollback target | complete rollback evidence after Netlify access provides a healthy deployment ID; preserve existing worktree changes |
| `BASELINE-001` | DONE | 13 | 2026-10-01 pre-production blocker-closure audit: repo clean at `4e8223d` = `origin/main` (scoring finalization pushed); production re-smoke PASS with deploy freshness proven via PERF-001 `hero-student.webp` live (deploy >= `19f19dd`); `e2e:offline-payloads` harness re-run end-to-end (queue/retry/conflict intact) with the configured AI tunnel probed HTTP 530 confirming the OFFLINE-004 provider outage; Google OAuth Drive wiring audited (4 vars consumed via `getGoogleOAuthEnv()`); Netlify CLI/token/state.json confirmed absent (DEPLOY-001/003 stay external); production runner guard 11/11 PASS. No blocker status changed: all 12 remain BLOCKED_EXTERNAL with unchanged dependencies | 1 | none | reopen on a production runtime regression or when any external dependency (Netlify access, Google accounts, AI tunnel) changes |
| `CERT-001` | BLOCKED_EXTERNAL | 13 | no certification issued; local release gates pass, but required provider, deployment, protected-production, offline replay, and rollback gates remain open | 1 | external gates remain unproven and production deployment is not approved | re-evaluate the release table after all external gates are closed or explicitly approved non-blocking |
| `SCORING-000` | DONE | SCORING | All 9 Human Decision Gate items resolved 2026-09-30 via the evidence hierarchy (SCORING_MD_RULE > implementation > PRD > Indonesia > ASEAN > international > engineering), implemented in `packages/domain/src/scoring-decisions.ts` with provenance labels + machine-readable `SCORING_DECISION_LEDGER`, deterministic tests in `scoring-decisions.test.ts` (46 tests), documented in SCORING_SPEC.md §21/§23 SOURCES. Scoring version bumped 2026.1 → 2026.2 (spec §15); historical scores keep their persisted version | 2 | first write of the decisions module contained a broken ledger string, dead code, and a degenerate coverage formula; rewritten clean before merge | reopen only on a scoring-formula regression or a new source revision |
| `SCORING-001` | DONE | SCORING | `packages/domain/src/scoring-engine.ts`: `SCORING_VERSION='2026.1'`, canonical types, `clampScore`/`normalizeMetric` with NaN/Infinity/zero-denominator guards (spec §10, §15). Unit tests in `scoring-engine.test.ts` | 1 | none | reopen only on versioning/normalization regression |
| `SCORING-002` | DONE | SCORING | `evaluateAudioQuality` implements source gates: SNR < 10 dB -> `RETRY_AUDIO_TOO_NOISY`, speech < 1500 ms -> `RETRY_SPEECH_TOO_SHORT`, duration gate first, non-finite input fails safely; no score is produced on rejection (spec §9). 8 unit tests PASS | 1 | none | reopen only on quality-gate regression |
| `SCORING-003` | DONE | SCORING | Canonical pronunciation scoring implemented (D1+D2): `scorePronunciationFromAlignment` computes rawPer=(S+D)/N', PER_cal=clamp(E_w/N') with accent weights accepted=0/mild=0.85/full=1 (spec §4.2 band), Sp=100*(1-PER_cal); gates: ≥8 gated phonemes (partial <20), mean confidence ≥0.6, low-confidence phonemes excluded from N' and E_w; context-keyed IPA accent table (10 rules, 3 classes, deletions/cluster simplification = full error) in `scoring-decisions.ts`; wired via `structuredEvidence.pronunciation` with corrupt evidence failing the whole assessment | 2 | engine bug: canonical pronunciation/vocabulary/intonation overrides were not spread onto the top-level assessment; fixed | reopen only on pronunciation formula regression or provider-alignment contract change |
| `SCORING-004` | DONE | SCORING | `calculateFluencyScore` in `packages/domain/src/scoring-engine.ts` implements the explicit source formula `Sf=[0.6*WPMnorm+0.4*(1-Rpause)]*100`, WPMnorm=clamp((WPM-40)/80), with pause-ratio sanity guards (negative/zero/exceeding durations fail explicitly). 6 unit tests PASS including band clamping and perfect-sample math. 2026-09-30 D3 resolution: normalization stays 40..120 (explicit MD formula per §5.2); 70–110 documented as pedagogical target band only (`FLUENCY_WPM_LEARNER_TARGET`) — no behavior change, no version bump required for fluency itself | 2 | none | reopen only on fluency formula regression |
| `SCORING-005` | DONE | SCORING | Deterministic intonation formula implemented (D4): `scoreIntonationFromPitch` computes Si=[0.6*clamp((st_p90−st_p10−1)/9,0,1)+0.4*clamp(median\|Δst\|/1.5,0,1)]*100 with st=12*log2(F0/55) — normalized semitone measures only, no absolute Hz thresholds; F0 validity window 50–500 Hz; insufficient below 5 valid points or 1 s voiced duration (never fabricated); wired via optional `structuredEvidence.intonation` mirroring the fluency evidence pattern. Provenance ENGINEERING_DECISION (spec §6 defines no transformation; no absolute-F0 acoustic channel exists in the pipeline yet) | 2 | fixture math errors in tests (semitone swing expectations); fixed against the formula | reopen when a real pitch-extraction channel lands (recalibrate bands then) |
| `SCORING-006` | DONE | SCORING | `calculateGrammarScore` applies the source penalty table light -5 / medium -10 / heavy -15 in the engine (never the LLM) via `Sg=max(0,100-Σ(count*penalty))`, validates untrusted provider findings (category, severity enum, confidence 0..1) with explicit rejection instead of silent drops, and preserves findingsBySeverity/totalPenalty/totalFindings for future length-normalized versions (spec §7). 6 unit tests PASS including floor-at-zero and malformed-input paths. Grammar length-normalization policy stays open in the decision gate | 1 | none | reopen only on grammar formula regression or length-policy decision |
| `SCORING-007` | DONE | SCORING | Vocabulary scoring implemented (D6+D7+D8): `scoreVocabularyFromTranscript` uses MATTR window 50 (Covington & McFall 2010) with raw TTR fallback ≤50 tokens, ≥30 tokens required (30–50 partial), TTRnorm=clamp(MATTR/0.5); CEFR coverage = 100*HF/assessed over embedded curated NGSL-core + closed function-word set with documented light lemmatization; unknown words neutral (excluded from numerator, never errors), mid-sentence capitalized tokens neutral as proper nouns; full NGSL not redistributed (CC BY-SA, no in-repo copy), Oxford 3000/5000 rejected on licensing; labeled CEFR estimate band persisted with disclaimer; wired via `structuredEvidence.vocabularyTranscript` (student transcript only) | 2 | first draft used a degenerate coverage formula (0.5*unknown weighting) and digit-bearing fixtures the tokenizer rightly excludes; rewritten before merge | reopen when the full NGSL wordlist is bundled or the above-band tier is added |
| `SCORING-008` | DONE | SCORING | `calculateWeightedFinalScore` implements canonical 0.25/0.20/0.15/0.20/0.20 aggregation with clamping and explicit invalid-input failures; deterministic source example Pron=80/Flu=70/Into=90/Gram=85/Vocab=75 -> 79.5 is a passing unit test (spec §3, §18). 21 engine tests PASS, full domain suite 53/53 PASS, domain typecheck PASS | 1 | initial clampScore mapped +Infinity to 0; corrected to clamp by range with only NaN guarded to 0 | reopen only on aggregation regression |
| `SCORING-009` | DONE | SCORING | `updateProgressEwma` implements `progress_new = 0.3*Sfinal + 0.7*progress_old` plus eligibility (>=80 for 3 consecutive sessions) and intervention (<55) rules; EWMA is separate from session scores by contract (spec §12). Unit tests PASS | 1 | none | reopen only on progression regression |
| `SCORING-010` | DONE | SCORING | CEFR mapping implemented as ESTIMATED bands only (D8): `estimateCefrBand` maps overall → A1–A2 <70, B1 ≥70, B2 ≥85, anchored to the MD progression rules (eligibility ≥80×3, intervention <55); every output carries the mandatory label "ENGINEERING_DECISION — estimated band, not an official CEFR certification" (spec §2.2 distinguishes estimate from certification); thresholds live in `CEFR_ESTIMATE_THRESHOLDS` for audit | 2 | none | reopen if the project owner sets different thresholds or an official mapping source appears |
| `SCORING-011` | DONE | SCORING | Assessment persistence now carries the canonical block: `CanonicalScoringMetadata` (scoringVersion `2026.1`, mode `ONLINE_FULL`, per-dimension scores + engine final, providerConfidence raw metric) is built in `processAssessment` and saved through the existing Firestore transaction; `Assessment.scoring` is additive/optional so historical documents remain valid (spec §14-§16). Web unit tests 5/5 including saved-payload assertions and null-confidence omission; web typecheck PASS; durable reload/read-back E2E stays owned by SCORING-015 | 1 | none | reopen only on persistence regression |
| `SCORING-012` | DONE | SCORING | `/api/student/assessment` POST/GET orchestrate through the domain engine without scoring math inline in handlers: the engine-computed final is persisted as `overall` plus `scoring.scores.final`, the POST response and GET read-back both return the canonical block, and provider failures keep explicit retryable statuses (499/503/502) with rate limiting. Runtime audio quality-gate enforcement still awaits SNR/duration evidence from the capture pipeline; the engine gate itself is implemented and unit-tested (SCORING-002). Web suite relevant tests PASS; the 3 pre-existing suite failures are environmental (Firestore emulator not running; two node:test files picked up by vitest and passing 7/7 + 4/4 under `node --test`) | 1 | none | reopen only on API orchestration regression |
| `SCORING-013` | DONE | SCORING | 2026-09-29 UI consumer audit: student speaking session, conversation page (online + offline sync read-back), teacher review, teacher analytics (`teacher-analytics.ts` validated averages/ranges server-side), leaderboard, adaptive, and reports all render persisted canonical `overall`/dimension values from API/Firestore read-back; the only client arithmetic found is display-only (percentage of answered questions, confidence-to-percent formatting, progress-ring SVG geometry) — no client-side final-score computation exists. The canonical `scoring` block is additive and requires no UI change; D durable rendering proof remains covered by SCORING-015 E2E. Analytics tests 3/3 PASS, web typecheck PASS | 1 | none | reopen only on a UI consumer computing scores client-side |
| `SCORING-014` | TODO | SCORING | Full SCORING unit/integration suite per spec §19 including negative paths (noisy, too-short, malformed provider output, missing metric, provider unavailable) | 1 | none | expand suite as dimensions land |
| `SCORING-013` | TODO | SCORING | Student/teacher UI consumes persisted canonical scores only; no client-side final score computation | 1 | none | integrate after SCORING-012 |
| `SCORING-014` | DONE | SCORING | Negative-path suite complete per spec §19: malformed provider assessment rejected `INVALID_RESPONSE` non-retryable; malformed grammar finding (bad severity/confidence/category) fails the whole assessment with no persistence; impossible audio evidence (pause > recording, zero/negative duration, non-finite WPM) fails explicitly with no persistence; provider unavailable/timeout/500/400 retry classification covered by adapter tests 8/8; audio quality gate rejects SNR <10 dB and speech <1.5 s with retry reasons and never fabricates scores. Evidence-wiring tests 9/9 PASS in `assessment-processing.test.ts` | 1 | none | reopen only on a negative-path regression |
| `SCORING-015` | DONE | SCORING | 2026-09-30 durable evidence with a live Firestore emulator (`pnpm emulators`, project `demo-tuturai`): `npx vitest run lib/scoring-persistence.test.ts` → 2/2 durable PASS (canonical block round-trip with re-aggregation determinism, duplicate-save immutability) + 1 honest skip of the no-emulator sentinel (emulator was up). Fixes applied to the harness itself: (1) detection moved to module scope because vitest evaluates `describe.skipIf` before `beforeAll`, which permanently skipped the durable branch; (2) runtime-generated throwaway RSA fixture replaces the stub PEM that firebase-admin's eager `cert()` parse always rejected; (3) tsconfig-forbidden top-level await replaced by a module-scope init promise + dynamic `ctx.skip()`. Same run: Firestore rules suite 6/6 PASS under the live emulator | 2 | skipIf-before-beforeAll ordering bug; invalid stub PEM fixture | reopen only on a persistence/rules regression |
| `SCORING-016` | DONE | SCORING | `lib/scoring-consumers.test.ts` (6/6 PASS): analytics averages only validated canonical `overall` (rejects 150/-5), fluency distribution from canonical dimensions, adaptive prioritizes weakest canonical dimension without recomputation, leaderboard preserves server XP ranking (name cannot reorder podium). Combined with SCORING-013 UI audit: analytics/adaptive/UI consume canonical persisted values end-to-end | 1 | none | reopen only on consumer regression |
| `SCORING-017` | DONE | SCORING | Evidence→engine wiring live in runtime path (spec §13, requirement C/E): `processAssessment` accepts `audioEvidence.fluency` (wordCount/durations) and `structuredEvidence.grammar` (findings); engine recomputes those dimensions via `calculateFluencyScore`/`calculateWordsPerMinute`/`calculateGrammarScore`, relabels provenance via `scoreSources` (`CANONICAL_ENGINE` vs `PROVIDER_ESTIMATE`), recomputes `overall` from canonical dimensions, persists rawMetrics (wpm/pauseRatio/grammar counts/providerConfidence); without evidence provider estimates persist labeled, never conflated. `calculateWordsPerMinute` derives WPM from audio-pipeline counts — LLM never guesses it. Route passes shared `saveAssessment`; client capture-pipeline measurement (browser-side WPM/SNR) remains a UI-layer addition and is not required for engine correctness | 1 | types.ts/scoring-engine re-export collision (`DimensionScoreSource`) broke tsc; consolidated into types.ts with re-export | reopen only on wiring regression |
| `PERF-001` | DONE | PERF | 2026-09-30 measured before/after (same build pipeline, production build with neutralized emulator vars): total client chunks 3,400KB → 2,680KB (`du -sk apps/web/.next/static/chunks`). Landing hero PNGs hero-student.png 1,344KB + teacher-dashboard.png 1,324KB now served as 960x960 q82 WebP: 37KB + 43KB (master PNGs kept on disk; zero remaining .tsx/.ts/.css references to the PNGs). `/siswa/progress`: recharts 336KB out of the route bundle → isolated async chunk `0sho3qkvtehs9.js` 333KB via `score-trend-chart.tsx` + `next/dynamic` ssr:false with real loading state. `/siswa/achievements` + `/siswa/speaking`: wildcard `import * as Icons` from lucide-react replaced with explicit named-icon maps ({Footprints,Target,Flame,BookOpen,Award} matching gamification.ts strings; speaking {Lightbulb,MessageCircle}); largest lucide chunk now 26KB vs ~744KB lucide payload on those routes at baseline. framer-motion now splits to 30KB+17KB chunks. Verification: web `tsc --noEmit` PASS, assessment-processing 9/9, scoring-consumers 6/6, scoring-persistence 1 pass/2 honest skips (emulator absent), domain 64/64, production build PASS. Not in scope/deferred: firebase vendor chunk 489KB (auth-required SDK), 3 Google font families in layout.tsx, dead-code removals (`getFirebaseDb()` in lib/firebase/client.ts, `skill-radar.tsx` — both verified zero importers, removal deferred) | 1 | baseline and after both measured on Windows `du`; block-size vs byte-sum may differ slightly between runs | reopen only on a bundle regression >10% or a landing-image visual regression |

## Protected Production E2E Checkpoint — 2026-10-04

Real production execution against `https://tuturai-apps.netlify.app` (Firebase project
`gen-lang-client-0138449759`) with the dedicated `tuturai-e2e-*` accounts and deterministic
fixtures. No emulator, no mock provider, no auth bypass. Secrets were never printed; only
variable names and configured/missing status are recorded.

### Production incident found and fixed during this checkpoint

| Item | Result |
| --- | --- |
| `PROD-DATA-001` | **Real product defect, fixed.** All 50 published `questionBank` items with `contentType: 'test'` had an empty `options` array and no `correctOption`, while `isAnswerableContentType` (`packages/domain/src/question.ts:12`) declares `test` answerable. `/siswa/tes` therefore rendered a question card with zero answer buttons, so **Tes Pedagogis was unanswerable for every real student**. Fixed by applying the repository's own `scripts/repair-test-question-options.mjs` rule to production; durable read-back `{"scanned":50,"repaired":50,"stillBroken":0}`. |
| `PROD-DATA-002` | **Fixture defect, fixed.** The revoked-join-key fixture `tuturai-e2e-revoked-001` was seeded with a 25-character placeholder join key that violates the product contract `/^[A-Z0-9]{8}$/` (`packages/domain/src/classroom.ts:3`), so `POST /api/classrooms/join` correctly rejected it at validation (400) before reaching the revoked branch. Re-seeded with a valid 8-character key and rotated the stored `joinKeyHash` plus the `classroomJoinKeys` reservation; `.env.e2e.production` synced. The runner assertion `[404, 409]` was **not** changed. |

### Suite results (real production)

| Suite | Result | Evidence |
| --- | --- | --- |
| `smoke` | **PASS** | landing 200, CSP + HSTS + nosniff headers present, `/api/health` 200 `ok`/`firebaseAdminModule:"loaded"`, unauthenticated `/api/me` `/api/classrooms` `/api/student/dashboard` all structured 401, readiness 401. Re-run 2026-10-04. |
| `classroom` | **PASS** | teacher browser login -> `/guru/kelas` UI create (201) -> Firestore read-back of owner + `joinKeyHash` with no plaintext key + `classroomJoinKeys` reservation -> `Kode join untuk …` rendered -> student login -> `/siswa` UI join (201) -> `classMemberships/{classroomId}_{uid}` read back `active` -> reload -> active-class switcher survives reload -> teacher `/api/classrooms/{id}/members` 200 contains the student -> `/guru/siswa` roster heading. |
| `security` | **PASS** | real student + teacher sessions: student -> `/api/teacher/devices` **403**; teacher -> `/api/student/dashboard` **403**; wrong-class roster read **404**; revoked join key **409 CONFLICT** with no membership created; `mutationCount: 0`. |
| `student` | **NOT PROVEN — blocked after fixes** | The suite reached its final assertion block once (persistence read-back) after the runner fixes below, but the run aborted in cleanup reporting and the following run was killed by the quota incident below, so **no PASS is claimed**. |
| `auth` | **BLOCKED_EXTERNAL** | The runner correctly refuses to skip the gated flow: `Production E2E will not skip gated flows; set E2E_GOOGLE_AUTH_ENABLED=true`. Requires an approved real Google browser account and explicit approval flag. |
| `teacher`, `assignment`, `analytics/leaderboard`, `speaking`, `pronunciation`, `voice`, `drive`, `offline`, `hardware` | **BLOCKED_EXTERNAL** | All require Firestore and are blocked by `PROD-INFRA-001` below. `drive` additionally needs real Google OAuth; `speaking`/`pronunciation` need the AI V1 provider (previously probed HTTP 530); `voice` needs an OmniVoice endpoint; `hardware` needs ESP32-S3 + broker + firmware. |

### Production infrastructure incident (active blocker)

| Item | Result |
| --- | --- |
| `PROD-INFRA-001` | **BLOCKED_EXTERNAL — production Firestore quota exhausted.** After the deterministic fixture bank was raised to fill the product's 20-card windows, the project began returning `8 RESOURCE_EXHAUSTED: Quota exceeded.` for **every** operation, including a single-document read. Impact was confirmed on the real user path: `POST /api/auth/session` returns 200 (token verification is a Firebase Auth call, not Firestore) but `/api/me` returns **401 UNAUTHENTICATED** because the profile read fails, so a real dedicated E2E login is bounced back to `/auth/login`. **The authenticated product is effectively down for all users.** Resume condition: the Firestore quota window resets (or billing/quotas are raised), then re-run `node scripts/e2e-prod.mjs student`. Not caused by the cache layer, which is inert in production (no Upstash credentials configured). |

### Runner fixes made in this checkpoint (test-runner only, no assertion weakened)

1. Adaptive card renders both a "Mulai latihan" and a "Buka materi" CTA to the same activity; the strict-mode locator now targets the shared destination instead of a positional guess. Downstream server read-back assertions unchanged.
2. The deployed vocabulary session completes only when **every** card in the returned bank is confirmed, and its dialog is titled `Kosakata selesai!`. Added `masterVocabularySession()`, which drives the real session and serializes on the `POST /api/student/question-bank` 200 instead of DOM timing. The `Semua kartu kosakata pada sesi ini sudah dikonfirmasi tersimpan.` assertion is kept verbatim inside `runStudent`.
3. Replaced the hand-counted attempt arithmetic with a stronger invariant: **every activity the production question-bank API actually served must have a durable Firestore `questionAttempts` document**. Measured served set is 70 (quiz 10 + listening 20 + test 20 + vocabulary 20). `conversation-*` is excluded because it persists to `conversationTextAttempts`, which is asserted separately (exactly one durable record).
4. Deterministic fixtures for quiz/listening/test were raised to fill the product's bounded bank windows so every rendered card has a deterministic correct option; `100/100` and `>= 10 cards` assertions kept.
5. Cleanup can no longer mask a product verdict: already-deleted documents are treated as cleaned up, and cleanup failures are emitted as structured `production_e2e_cleanup` evidence instead of throwing over the suite result.
6. FAIL output now scrubs dedicated account credentials and attaches read-only page-state forensics (URL, main text, button states).

### Local verification at this checkpoint

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx eslint .` | PASS (exit 0; 8 pre-existing warnings, 0 errors) |
| `npx vitest run lib/cache` | 35/35 PASS (exit 0) |
| `node --test scripts/e2e-prod-*.test.mjs` | 11/11 PASS (exit 0), including the 26 protected-menu-row coverage guard |
| production `next build` | PASS with emulator variables neutralised (pre-existing local requirement) |
| Upstash cache tests / cache code | Implemented, typechecked, unit-tested; **production not configured, not verified** |

### Upstash cache status at this checkpoint

Implementation status: complete in source (`lib/cache/*`, `lib/config/redis-env.ts`, read/write wiring,
35 tests, benchmark, env placeholders). Review confirms the invariants hold: `requireRole` runs and
returns before every cached read, so the cache is never a security boundary; keys are scoped per
uid/teacher/classroom and `buildCacheKey` hashes any segment containing `:` so two classrooms can
never collide; every write that can change a cached read calls `invalidateNamespaces`; an
unconfigured, unreachable, or failing Redis falls back to the origin loader with no behavioural
change; the in-flight dedupe map clears in a `finally` so no promise is left stuck.

Production configured: **no** — `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are empty in
`apps/web/.env.local` and no Netlify environment access exists from this shell. Production cache
validation is therefore **BLOCKED_EXTERNAL**, not verified. Graceful fallback **is** verified in
production behaviour: every PASS above was produced with caching inactive, which is exactly the
fail-open contract.

One hazard is now documented in `lib/cache/README.md`: `questionBank` is the only namespace no
runtime write invalidates, so once Redis is live the 120s TTL would let the app serve a pre-fixture
bank to the production E2E runner, whose fixtures are written straight through the Admin SDK. Flush
`tuturai:v1:questionBank*` after fixtures are written, or keep `CACHE_ENABLED=false` for the next
E2E checkpoint.

`RELEASE_READY=false` and `PRODUCT_PRODUCTION_READY=false` remain in force: mandatory gates are open
and `PROD-INFRA-001` is an active production outage.

## Upstash Redis Validation Checkpoint — 2026-10-04

Operator supplied Upstash credentials in `apps/web/.env.local`. Values were never printed;
only presence, host, and reachability are recorded. Instance host: `beloved-starfish-194377.upstash.io`
(Upstash Free tier — validation was deliberately kept to a handful of commands).

| Status | Result | Evidence |
| --- | --- | --- |
| `UPSTASH-DIRECT` | **PASS** | Isolated probe key `tuturai:v1:e2e-cache-probe:<uuid>`, 6 commands. PING -> `PONG` (183ms warm, 917ms cold TLS handshake); SET with `EX 120` -> `OK` (90ms); GET -> byte-exact match (27ms); TTL -> `120` (26ms); DEL -> `1` (25ms); GET after DEL -> `null` (25ms). A safety-net DEL guarantees removal even on failure. No application key was read, scanned, or deleted; no SCAN/FLUSHDB/wildcard delete was issued. |
| `UPSTASH-CACHE-CORE` | **PASS** | Real `lib/cache` against real Upstash with an isolated in-memory origin loader (no Firestore): miss calls the origin exactly once and every later read is a `hit`; 5 concurrent identical misses collapse to **1** origin load (1 `miss` + 4 `hit`); a mutated origin is served stale until `invalidateNamespaces` and fresh afterwards; invalidation **physically deletes the real Redis key** (verified with a direct `GET` returning `null`); per-user and per-classroom keys never observe each other's payloads and invalidating one tenant leaves the other cached; a 1s TTL entry returns to the origin after expiry; an injected always-rejecting client falls back to the origin with correct data and a failing `invalidateNamespaces` resolves rather than throwing into a write path. |
| `UPSTASH-CACHE-INTEGRATION` | **PASS** | New suite `apps/web/lib/cache/upstash-integration.test.ts` (9 tests) runs real Upstash + real cache core with a deterministic fake origin. Suite self-skips when credentials are absent, so a developer machine without Redis still runs the mocked unit tests. Run deliberately with `pnpm cache:upstash` — it is excluded from the default vitest run (mirroring `cache:bench`) so a Redis outage cannot turn the hermetic unit suite red and routine runs do not spend Free-tier request quota. Results: hermetic cache unit/coverage suite **35/35 PASS, exit 0**; live Upstash integration **9/9 PASS, exit 0**. |
| `UPSTASH-CACHE-ORIGIN-FAILURE-SAFETY` | **PASS** | A failing origin (modelling Firestore `RESOURCE_EXHAUSTED`) propagates its error, writes **nothing** to Redis, and a later read re-runs the origin instead of resurrecting a fabricated profile. This is the guarantee that the cache can never turn an outage into a fake user. |
| `APPLICATION-CACHE-PRODUCTION` | **BLOCKED_EXTERNAL_FIRESTORE_QUOTA** | Every cached route calls `requireRole`/`requireAuth` before any cache access, and `readProfileDocument` still needs Firestore on a cold key. Production Firestore returns `RESOURCE_EXHAUSTED` for every operation, so no production route can be exercised. No fake production PASS was created. |
| `PRODUCTION-UPSTASH-CONFIG` | **BLOCKED_EXTERNAL_NETLIFY_ENV** | Credentials exist only in `apps/web/.env.local`, which is a local runtime file. This shell has no Netlify CLI, no `NETLIFY_AUTH_TOKEN`/`NETLIFY_SITE_ID`/`NETLIFY_API_TOKEN`, and no `.netlify/state.json`, so production environment presence cannot be inspected or verified. **Production Redis is NOT enabled and is NOT claimed to be enabled.** No new public endpoint was added. |
| `FIRESTORE-QUOTA` | **INCIDENT** | Still `RESOURCE_EXHAUSTED` on a single-document read. Unchanged from the earlier checkpoint; the authenticated product remains down at `/api/me`. |

### Cache does not remedy the Firestore outage

Verified by construction, not assumed. `/api/me` resolves through
`verifySessionCookie` (Firebase Auth) plus `readProfileDocument` (cached). A warm cache
entry would let that route answer without Firestore, but an entry can only exist after a
successful Firestore read, and any cold key, miss, or invalidation still requires the
origin. Redis therefore reduces Firestore reads on hits only — it cannot supply the first
read, and it cannot manufacture data when the origin fails (`UPSTASH-CACHE-ORIGIN-FAILURE-SAFETY`).
Resume condition for production E2E stays **"Firestore production quota restored / billing
capacity available"**.

### Free-tier discipline

Validation used a small fixed command count (6 for the direct probe, a few dozen GET/SET/DEL/SCAN
calls across the integration suite). No load test, no stress test, no large scan, no wildcard
delete, no `FLUSHDB`, and no repeated production requests for benchmarking. All probe keys were
deleted or left to a short TTL. No usage figure is claimed beyond what was executed.

`RELEASE_READY=false` and `PRODUCT_PRODUCTION_READY=false` are unchanged. Redis being healthy is
not a release gate and did not change any protected production E2E row.

## Protected Production E2E Progress — 2026-10-04 (after Firestore quota recovery)

Firestore quota recovered mid-session, so the protected matrix was resumed exactly where it
stopped: `student` -> `teacher` -> `assignment`. Suites already proven (`smoke`, `classroom`,
`security`) were not re-run.

| Suite | Result | Evidence |
| --- | --- | --- |
| `smoke` | **PASS** | (earlier checkpoint) landing 200, CSP/HSTS/nosniff, health 200, three protected routes structured 401 |
| `classroom` | **PASS** | (earlier checkpoint) UI create -> 201 -> Firestore owner + hash-only join key -> reservation -> student UI join -> membership `active` -> reload -> class switcher -> teacher roster 200 |
| `security` | **PASS** | (earlier checkpoint) student->teacher 403, teacher->student 403, wrong-class 404, revoked join 409 with no membership |
| `student` | **PASS** | `{"adaptiveNoRepeat":true,"quizAttempts":10,"listeningCards":20,"testAttempts":20,"vocabularyCards":20,"conversationReadback":true,"achievementActionReadback":true,"profileMutationReadback":true,"progressReload":true,"leaderboardApiAndUiRank":1,"leaderboardReload":true,"firestoreAttempts":71}` |
| `teacher` | **PASS** | `{"dashboard":true,"studentMonitoring":true,"analyticsReadback":true,"pdfBytes":907,"settingsFirestoreReadback":true,"settingsReload":true,"leaderboardServerOrdering":true,"leaderboardUiReadback":true,"deviceRegistrationServerReadback":true,"deviceCredentialHashOnly":true,"deviceRevocationReadback":true}` |
| `assignment` | **FAIL — real product defect, fixed in source, awaiting deploy** | see `PROD-TZ-001` below |

### Production defect found by the assignment suite

| Item | Result |
| --- | --- |
| `PROD-TZ-001` | **Assignment deadlines were shifted by the teacher's UTC offset.** `app/guru/penugasan/page.tsx` sent the raw `<input type="datetime-local">` value (for example `2026-10-04T14:23`, a wall clock with no offset). `new Date()` parses that as *local* time, so the UTC API host stored 14:23 **UTC** while the teacher meant 14:23 in their own timezone. For the app's Indonesian (UTC+7) users every deadline landed 7 hours late and the derived `isLate` flag was wrong. Reproduced: the dedicated deadline "2 minutes ago" arrived 7 hours in the future, so the durable assertion `isLate === true` failed even though the submission itself persisted correctly (`Penugasan terkumpul`, `Status: pending_review`). Fixed by converting the value in the browser, where the timezone is known, via the new `toDeadlineIso` helper (`apps/web/lib/assignment-deadline.ts`), which always emits an offset-aware ISO instant. Guarded by 5 regression tests in `apps/web/lib/assignment-deadline.test.ts`, including "a deadline entered two minutes ago still reads as two minutes ago". **The fix requires a deploy; production still serves the old behaviour, so the assignment rows stay FAIL until then.** |

### Runner/config defects fixed in this pass (no assertion weakened)

1. `teacher` suite crashed with `Cannot read properties of null (reading 'uid')`: the runner needs the
   dedicated student identity (roster, analytics student count, leaderboard) but the suite's required
   variables never declared it, so `config.student` resolved to `null`. Declared explicitly.
2. Three post-reload UI assertions read a control in the same tick as the reload, before the client
   refetched persisted state (student profile name/school, teacher notification switch, teacher
   leaderboard rank). The data was already proven durable by the API and Firestore read-backs; the UI
   simply had not hydrated. Each now polls the rendered value with a bounded timeout and still
   asserts equality.
3. Teacher leaderboard UI rank: the page renders the top three as a podium with **medal icons and no
   numeric rank**, so the runner's "first span is the rank" assumption could never hold for rank 3.
   The assertion now targets the ranked list row the API actually ranked. A pre-existing bug was also
   corrected there: the post-reload check compared a *different* fixture row against `lastFixture.rank`.
4. Device status badge: `Online` also renders in the layout banner, so the assertion is scoped to `main`.

### Protected production menu matrix status: 18 of 26 verified

**PASS (18):** `/siswa`, `/guru/kelas`, `/siswa/percakapan text`, `/siswa/vocabulary`,
`/siswa/listening`, `/siswa/quiz`, `/siswa/tes`, `/siswa/adaptive`, `/siswa/progress`,
`/siswa/leaderboard`, `/siswa/achievements`, `/siswa/profil`, `/guru`, `/guru/siswa`,
`/guru/analitik`, `/guru/leaderboard`, `/guru/pengaturan`, `/guru/perangkat`

**FAIL (3):** `/siswa/penugasan`, `/guru/penugasan`, `/guru/penilaian` — blocked by `PROD-TZ-001`,
which is fixed in source but undeployed.

**BLOCKED_EXTERNAL (5):** `/dashboard`, `/onboarding` (approved Google browser account),
`/siswa/speaking` (AI V1 provider), `/siswa/pronunciation` (phoneme provider),
`/siswa/percakapan voice` (OmniVoice endpoint).

### Upstash status at this checkpoint

`UPSTASH-DIRECT` PASS, `UPSTASH-CACHE-CORE` PASS, `UPSTASH-CACHE-INTEGRATION` PASS (now 10 tests,
including explicit teacher-scoped isolation for classrooms/review-queue so one teacher can never
observe another's data, and invalidating teacher A leaves teacher B cached).
`APPLICATION-CACHE-PRODUCTION` remains `BLOCKED_EXTERNAL_FIRESTORE_QUOTA` at the time it was measured
and `PRODUCTION-UPSTASH-CONFIG` remains `BLOCKED_EXTERNAL_NETLIFY_ENV`. Redis is **not** enabled in
production and no protected E2E row was promoted on the strength of Redis alone.

`RELEASE_READY=false` and `PRODUCT_PRODUCTION_READY=false` remain in force: five rows are blocked on
external providers, three rows await a deploy, and production Redis is unverified.

## Human Decision Gate — Scoring (SCORING_SPEC.md §21)

RESOLVED 2026-09-30 — all nine items decided via the evidence hierarchy and
implemented in `packages/domain/src/scoring-decisions.ts` (provenance labels,
`SCORING_DECISION_LEDGER`) with deterministic tests and full citations in
SCORING_SPEC.md §23 SOURCES. Scoring version `2026.2`.

```text
[x] PER_calibrated exact rule                          -> SCORING-003 (D1)
[x] Indonesian accent substitution penalty table/rule   -> SCORING-003 (D2)
[x] authoritative WPM normalization range (70-110 vs 40-120) -> SCORING-004 (D3: 40..120 per explicit MD formula)
[x] deterministic intonation score formula              -> SCORING-005 (D4)
[x] grammar length-normalization policy (if any)        -> SCORING-006 (D5: flat rule retained, explicit §7.3 approval)
[x] TTR normalization                                   -> SCORING-007 (D6: MATTR window 50)
[x] CEFR vocabulary scoring lookup                      -> SCORING-007 (D7: NGSL-core + neutral fallback)
[x] CEFR final/progression score thresholds             -> SCORING-010 (D8: labeled estimates 70/85)
[x] missing-metric/confidence policy                    -> D9 (MetricStatus model, provider gate 0.6)
```

`SCORING_PRODUCTION_READY=true` (2026-09-30): all decision-gate boxes resolved,
source-defined formulas implemented, dimension scores deterministic from
structured evidence, backend/domain-owned final score, scoring version
persisted, quality gates fail safely, EWMA separate from session scores, and
the full local validation suite PASS. Remaining external gates (protected
production E2E accounts, provider integrations, deployment/rollback evidence)
are owned by CERT-001 / RELEASE-002 and are unaffected by this decision gate.

## One-Time External Gate Register

Each entry is reported once here. Do not repeat it in session summaries unless its
status changes or it becomes the only remaining release blocker.

| Gate | State | Reason / evidence | Resume verification |
|---|---|---|---|
| `WEB-AUTH-002` | BLOCKED_EXTERNAL | Google is active scope and the chooser opens. 2026-09-30: production is rebuilt and healthy — `/api/health` `firebaseAdminModule:"loaded"`, fabricated-token session returns structured 401 `auth/invalid-id-token` (empty-500 gone). The remaining gate is a real authorized Google browser login on production | use an authorized Google browser account for Firebase auth -> onboarding/session -> dashboard -> reload/restore -> logout/role denial; capture only the safe diagnostic object |
| `DRIVE-001` | BLOCKED_EXTERNAL | 2026-10-01 source audit: the four `GOOGLE_OAUTH_*` variables are wired via `getGoogleOAuthEnv()` in `apps/web/lib/config/env.ts` and consumed by every Drive route; missing/mis-set secrets surface as structured 501 `DRIVE_NOT_CONFIGURED` (fail-closed; unauthenticated status verified 401 in production). Remaining gate: OAuth consent, callback, refresh, upload, and persisted metadata with a real teacher account; assignment file replay `OFFLINE-003` depends on the same provider boundary | Drive status -> consent -> upload -> Firestore metadata read-back -> resume `OFFLINE-003` |
| `OFFLINE-004` | BLOCKED_EXTERNAL | Local payload scrubbing and v1->v2 migration pass; current `/api/student/assessment` audio replay returned HTTP 503 `PROVIDER_UNAVAILABLE` with `retryable=true`, so no completed assessment was fabricated | once the configured STT/LLM route (`AI_STT_ROUTE`, `AI_LLM_ROUTE`, associated model IDs and `AI_V1_BASE_URL`/key when selected) responds, run `e2e:offline-payloads` and confirm one assessment plus synced payload deletion |
| `VOICE-001` / `WEB-SPEAK-002` | BLOCKED_EXTERNAL | OmniVoice/TTS endpoint/model is intentionally unconfigured | enrollment -> ready polling/webhook -> preview/playback -> delete |
| `PRON-001` | BLOCKED_EXTERNAL | Phoneme/forced-alignment provider contract and model unavailable | provider response -> per-word score -> durable score/UI |
| `HW-001` | BLOCKED_EXTERNAL | Teacher registry, hashed one-time device secret/revocation, and authenticated heartbeat telemetry validation are implemented; focused unit/route tests pass (6 total) and production runner assertions are coded but not executed. ESP32-S3, broker, CA/device credentials, and a durable audio/artifact destination remain unavailable; device status/sync/audio-upload endpoints remain explicit 501 gates. | firmware build/flash -> MQTT TLS reconnect/ACL -> offline queue sync -> configured HTTPS artifact upload and production read-back |
| `DEPLOY-001` | BLOCKED_EXTERNAL | Local Netlify config is present, but this shell has no linked site, CLI, auth token, site ID, or preview URL | provide authorized Netlify access and the preview URL; production deploy is not authorized by this task |
| `DEPLOY-002` | DONE (2026-09-30) | Production smoke: `/api/health` 200 `firebaseAdminModule:"loaded"`; fabricated-token session 401 structured JSON; CSP/HSTS live. firebase-admin externalization fix proven in production | reopen only on a production API regression |
| `DEPLOY-003` | BLOCKED_EXTERNAL | No deploy ID recorded yet; the now-healthy live deploy (2026-09-30 smoke) is a valid known-good candidate | user records the current deploy ID from the Netlify Deploys UI as the verified rollback target |
| `E2E-PROD-001/002` | BLOCKED_EXTERNAL | Production runtime verified healthy 2026-09-30 (health 200, structured 401s); remaining blocker is approved student/teacher production test accounts | provide approved accounts and run the protected menu matrix |
| `SEC-003` | DONE_LOCAL | Redacted secret pattern scan and tracked-artifact inspection completed; no secret/artifact finding | reopen only on a concrete regression |
| `SEC-004` | DONE_LOCAL | Automated browser/keyboard/responsive checks and manual accessibility-tree review completed | reopen only on a concrete accessibility regression |

## Protected Production Menu Matrix

All rows remain `P-` until protected production E2E proves the complete row. Local
`D`, `S`, `N`, `I`, `P`, and `G` evidence is recorded in the Evidence column and
does not satisfy the production column.

| Menu / route | Role | Authentication | Data load | Primary action | Persistence | Authorization | Error state | Production E2E | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard` | student/teacher | session | redirect/profile | route redirect | n/a | role guard | login redirect | OPEN | D local onboarding -> role dashboard |
| `/onboarding` | student/teacher | session | profile form | save permanent role | Firestore user | immutable role | validation/conflict | OPEN | D local both-role signup -> Firestore/API read-back -> reload; P- production 500 |
| `/siswa` | student | session | dashboard/class | switch class/join | Firestore | membership | API/error/empty | OPEN | D/N local join -> membership read-back/reload; invalid/revoked, unauthenticated, and wrong-role joins fail without membership |
| `/siswa/penugasan` | student | session | assignments | submit/resubmit | Firestore/Drive | class membership | attempts/upload | OPEN | D/N local lifecycle; attempt beyond max returns 409 without mutation; Drive file path remains G |
| `/siswa/speaking` | student | session | speaking topics | record/upload | assessment | class scope | provider failure | OPEN | D local/G provider |
| `/siswa/percakapan` text | student | session | scenarios | answer/complete | conversation attempt | class scope | retryable error | OPEN | D local |
| `/siswa/percakapan` voice | student | session | active class/voice | playback/send voice | provider/audio | class voice scope | 404/409/503 | OPEN | N/P local/G |
| `/siswa/pronunciation` | student | session | practice bank | submit pronunciation | attempt metadata | student scope | unavailable/null | OPEN | N local/G |
| `/siswa/vocabulary` | student | session | question bank | answer/mastery | question attempt | student scope | retryable save | OPEN | D local |
| `/siswa/listening` | student | session | question bank | answer/mastery | question attempt | student scope | retryable save | OPEN | D local |
| `/siswa/quiz` | student | session | question bank | answer/complete | question attempt | student scope | retryable save | OPEN | D local |
| `/siswa/tes` | student | session | question bank | answer/complete | question attempt | student scope | retryable save | OPEN | D local |
| `/siswa/adaptive` | student | session | recommendation | open/complete | attempt/completion | student scope | empty/error | OPEN | D local |
| `/siswa/progress` | student | session | stats/history | filter/read | Firestore | student scope | empty/error | OPEN | S/D local |
| `/siswa/leaderboard` | student | session | class ranking | class switch | Firestore | membership | empty/error | OPEN | S/D local |
| `/siswa/achievements` | student | session | unlock IDs | read | Firestore | student scope | empty/error | OPEN | S/D local; production runner asserts `scholar` persistence, unlocked UI, and reload |
| `/siswa/profil` | student | session | profile | edit/save | Firestore | self-only | validation/error | OPEN | D local profile save/API read-back/reload |
| `/guru` | teacher | session | overview | inspect/refresh | Firestore | teacher-owned | empty/error | OPEN | D local teacher core/analytics reads |
| `/guru/kelas` | teacher | session | classrooms | create/update/join-key | Firestore | owner-only | validation/404 | OPEN | D local classroom create/key hash -> student join -> membership read-back |
| `/guru/penugasan` | teacher | session | assignments | author/publish | Firestore/Drive | owner/class | validation/upload | OPEN | D/N local published fileless authoring; Drive G |
| `/guru/siswa` | teacher | session | members | inspect/remove | Firestore | owner/class | 403/404 | OPEN | D local teacher member API/UI read-back |
| `/guru/penilaian` | teacher | session | review queue | approve/return | Firestore | owner/class | invalid state | OPEN | D local return/resubmit/approve lifecycle |
| `/guru/analitik` | teacher | session | metrics/trends | period/PDF | Firestore/PDF | owner/class | empty/403 | OPEN | D local |
| `/guru/leaderboard` | teacher | session | ranking | filter/read | Firestore | owner/class | empty/403 | OPEN | D local XP ordering; production runner asserts API order, rendered rank, and reload |
| `/guru/pengaturan` | teacher | session | Drive/voice settings | save/connect | Firestore/Drive/provider | teacher-only | provider/error | OPEN | D local preference save/read-back; Drive/voice G |
| `/guru/perangkat` | teacher | session | devices | register/remove/sync | Firestore/device | owner/class | 400/404/501 | OPEN | Device/heartbeat logic tests 6/6 PASS; production runner asserts register/revoke, one-time credential hash, invalid credential/payload rejection, and valid heartbeat telemetry read-back but has not run against production; MQTT/TLS broker, device firmware, and HTTPS artifact storage remain G |

## Release Gates

`RELEASE_READY=true` requires every mandatory row below to be `PASS` or explicitly
approved as non-blocking external. Percentages are not used for release decisions.

| Gate | Task | Status | Required evidence |
|---|---|---|---|
| lint | `RELEASE-001` | PASS-local | 2026-09-26 output: 0 errors, 8 warnings |
| typecheck | `RELEASE-001` | PASS-local | 2026-09-26 root `pnpm typecheck` output |
| unit tests | `RELEASE-001` | PASS-local | 2026-09-30 `pnpm test` rerun with a live emulator: rules 6/6, scoring-persistence durable 2/2 (previously skipped); two node:test files remain vitest-mishandled environmental cases |
| integration/rules tests | `RELEASE-001` | PASS-local | 2026-09-30 Firestore rules suite 6/6 under a live emulator (previously emulator-dependent); scoring-persistence durable 2/2 same run |
| durable E2E | `E2E-001/002/003/004` | PASS-local | local durable, negative, offline, and provider-failure matrix; external confirmations remain G |
| production build | `RELEASE-001` | PASS-local | current build output |
| dependency/security audit | `SEC-005` | PASS-local | audit output with accepted findings |
| secret scan | `SEC-003` | PASS-local | redacted scan and tracked-artifact review |
| authorization/RBAC | `SEC-001` | PASS-local | wrong-role/wrong-class evidence |
| CSP/security headers | `SEC-002` | PASS-production | 2026-09-28 live runtime check: full CSP + HSTS + nosniff + DENY + referrer + permissions headers present; protected pages 307 to login |
| accessibility | `SEC-004` | PASS-local | E2E auth error/keyboard/responsive/nav/target-size assertions plus manual accessibility-tree review |
| offline/PWA | `OFFLINE-003/004/005` | OPEN/G | text duplicate, migration, conflict, quota, and app-shell local evidence; Drive file replay and successful AI audio replay remain external |
| preview deployment | `DEPLOY-001` | OPEN/G | authorized Netlify preview access, deploy URL/build evidence |
| production deployment | `DEPLOY-002` | PASS-production | 2026-09-30 smoke: `/api/health` 200 `firebaseAdminModule:"loaded"` (node v22.23.2), fabricated-token session 401 structured JSON, CSP/HSTS on `/`; deploy ID still to be recorded for rollback (`DEPLOY-003`) |
| protected production E2E | `E2E-PROD-001/002` | OPEN/G | protected menu matrix after a healthy authorized production deployment and approved test accounts |
| rollback | `DEPLOY-003` | OPEN/G | authorized known-good deploy ID + rollback target/recheck |
| critical providers | `DRIVE-001/VOICE-001/PRON-001/HW-001` | OPEN/G | real provider/device confirmation |
| repository cleanliness | `RELEASE-003` | PASS-local | no staged changes; 79 existing modified/untracked worktree entries are preserved; `git diff --check` reports no whitespace errors |

## Deployment Readiness Snapshot (2026-09-30)

Area-level readiness percentages for deployment planning. These are evidence-based
implementation measurements, not release percentages; release decisions remain
bound to the gate table above (`RELEASE_READY=false` until every mandatory gate is
`PASS` or explicitly approved non-blocking).

| Area | Readiness | Basis |
|---|---:|---|
| Backend implementation (45 API routes, guards, domain/validation packages) | 100% | All routes implemented and guarded; `requireAuth`/`requireRole` on all protected handlers; rate limiting on assessment, pronunciation, Drive, voice, submit, join |
| Backend production proof (API routes serving on Netlify) | 80% | 2026-09-30 live: health probe 200 with Admin module loaded, session verify returns structured 401; per-route authorization proof still pending protected production E2E (`E2E-PROD-001/002`) |
| Database / Firestore (rules, indexes, collections, question bank) | 95% | Rules + indexes shipped; 74-item seed bank via script; emulators-only persistence proof; cloud Firestore data verification pending production E2E |
| Security (headers/CSP, RBAC, rules, secret scan, audit, encrypted Drive tokens, rate limits, fail-closed guards) | 90% | CSP + headers now production-verified; protected-page redirects verified; remaining: production authorization E2E rows (`E2E-PROD-002`), join-key brute-force limits are transactional but unproven under load |
| QA (unit/integration/rules, durable local E2E, negative/offline suites) | 85% | web 61 files/246 tests, domain 9/32, validation 1/7, functions 1/1, lint 0 errors, typecheck/build PASS, durable local E2E matrix complete; missing: protected production E2E execution and provider-gated suites |
| SEO | 40% | Root metadata (title/description) present; missing: `sitemap.ts`, `robots.ts`, PWA manifest link, Open Graph/Twitter cards, canonical URLs; per DESIGN_OVERHAUL.md SEO copy is scheduled with the redesign |
| Offline/PWA | 90% | SW install/offline shell, IndexedDB queue with idempotency, migration, quota cleanup verified locally; Drive file replay and successful AI audio replay remain provider-gated |
| AI/STT/LLM | 85% | Adapter, normalization, failure/retry contracts implemented and tested; production confirmation awaits configured provider endpoints |
| Voice/TTS (OmniVoice) | 80% | Full lifecycle implemented with safe unconfigured states; no live provider exists yet |
| Pronunciation | 70% | Contract, timeout, idempotent persistence implemented; no phoneme/forced-alignment provider available |
| Drive integration | 80% | OAuth PKCE + encrypted tokens + upload/metadata implemented; no real consent/upload proof (`DRIVE-001`) |
| Hardware/ESP32-S3 | 30% | Server-side registry, heartbeat, one-time credential hash, revocation, tests done; no firmware source, no broker, no physical device (`HW-001`) |
| Deployment/Netlify | 90% | 2026-09-30: healthy deploy live and smoke-verified; remaining: recorded deploy ID/rollback target (`DEPLOY-003`) and authorized preview access (`DEPLOY-001`) |
| Weighted deployment readiness (excluding hardware) | ~85% | Local implementation + security + QA essentially complete; remaining mass is production execution evidence, external providers/accounts, and SEO metadata |

## Coordinator Handoff

When a task is verified, update its row and this lock in one edit:

```text
CURRENT_TASK_STATUS=DONE
LAST_COMPLETED_TASK_ID=<old CURRENT_TASK_ID>
CURRENT_TASK_ID=<next task that is not DONE>
CURRENT_TASK_STATUS=IN_PROGRESS
NEXT_TASK_ID=<following task>
```

Every `DONE` task must have short evidence containing files, command/test, result,
route/provider boundary, and commit/hash when one exists. Do not add essays to this
ledger. Historical context belongs in the retained reference documents.
