# TuturAI Execution State

THIS FILE IS THE ONLY EXECUTION STATE.
NEVER RESTART COMPLETED WORK.
NEVER RE-AUDIT COMPLETED PHASES WITHOUT NEW EVIDENCE OF REGRESSION.
ALWAYS RESUME FROM CURRENT_PHASE and NEXT_TASK_ID.

Last normalized: 2026-09-25
Product specification: `PRD.md`
Architecture and security contract: `AGENTS.md`

## Execution Lock

```text
CURRENT_PHASE=PHASE 13 - Final Production Readiness Certification
CURRENT_TASK_ID=CERT-001
CURRENT_TASK_STATUS=BLOCKED_EXTERNAL
NEXT_TASK_ID=NONE
LAST_COMPLETED_TASK_ID=RELEASE-001
BLOCKED_EXTERNAL=WEB-AUTH-002,DRIVE-001,OFFLINE-003,OFFLINE-004,SEC-002,DEPLOY-001,DEPLOY-002,DEPLOY-003,E2E-PROD-001,E2E-PROD-002,VOICE-001,WEB-SPEAK-002,PRON-001,HW-001
RELEASE_READY=false
PRODUCT_PRODUCTION_READY=false
```

Only the coordinator updates this lock. A task moves monotonically through:

```text
TODO -> IN_PROGRESS -> VERIFYING -> DONE
TODO -> IN_PROGRESS -> BLOCKED_EXTERNAL
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
- Evidence: email/password path is `DONE`; live Identity Toolkit `accounts:createAuthUri` returned `google.com` auth URLs for `http://localhost:3000` and `https://tuturai-apps.netlify.app`, confirming provider/continue-URI acceptance. Google UI, onboarding, and server-session boundaries are implemented. Full real-browser Google login/session/restore/logout proof still requires an authenticated Google browser account; Firebase Console currently redirects to Google account sign-in.
- Exit criteria: no local auth regression and Google browser flow proves Firebase auth -> onboarding/session -> dashboard -> restore/logout.
- Status: `BLOCKED_EXTERNAL` pending a real Google browser account/session and consent for the final end-to-end flow.
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
- Status: `BLOCKED_EXTERNAL` for production CSP/header confirmation (`SEC-002`); all local Phase 8 tasks are complete.
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
- Evidence: current local production build succeeds and serves CSP plus JSON `401` for unauthenticated `/api/me`, `/api/classrooms`, and `/api/student/dashboard`. Read-only production checks on 2026-09-26 returned homepage `200` without CSP and empty `500` for all three protected API reads; response indicates Netlify forwarded the `500`. Current `proxy.ts`/`netlify.toml` CSP changes are uncommitted and therefore not present in the public deployment. Netlify function logs and production environment are not accessible from this shell.
- Exit criteria: deployment and rollback evidence is fresh and successful.
- Status: `BLOCKED_EXTERNAL` for Netlify runtime logs/environment and explicit production-deploy approval; local build and runtime comparison are complete.
- Next phase: PHASE 11.

### PHASE 11 - Protected Production Menu E2E

- Scope: authenticated production verification for every protected student/teacher
  menu and primary action.
- Task IDs: `E2E-PROD-001`, `E2E-PROD-002`.
- Acceptance criteria: production role login, data load, primary action, persistence,
  authorization and failure state are evidenced per route.
- Required tests: protected production Playwright/browser runs using approved test
  accounts; no emulator data or simulated provider success.
- Evidence: `0/26` protected production menu E2E currently proven.
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
| `WEB-AUTH-002` | BLOCKED_EXTERNAL | 2 | Firebase web app exists; live `accounts:createAuthUri` returned a Google auth URI for localhost and Netlify; Console redirects to Google sign-in; full real browser -> Firebase -> onboarding/session -> dashboard -> restore/logout remains unverified | 3 | current Playwright/CLI browser has no authenticated Google user session; local Auth Emulator evidence is not production proof | when an authenticated Google browser account is available, complete sign-in, new/existing-user role path, server session, dashboard, reload/restore, logout, and role denial |
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
| `OFFLINE-004` | BLOCKED_EXTERNAL | 7 | `REOPENED_FROM=OFFLINE-004`; `REASON=markMutationSynced retained confirmed audio Blob`; fixed via payload purge on sync and v1->v2 migration. Unit 7/7, `e2e:offline-migration` and `e2e:offline` PASS; latest `e2e:offline-payloads` response is 503 `PROVIDER_UNAVAILABLE` (retryable), with no assessment created and audio retained for retry | 3 | after local cleanup fix, current assessment provider is unavailable for successful browser replay | when STT/LLM endpoint returns success, rerun `e2e:offline-payloads` and verify one Firestore assessment plus audio payload cleanup |
| `OFFLINE-005` | DONE | 7 | 2026-09-25 `e2e:offline-refresh` PASS: service worker install/control -> offline refresh -> cached `offline.html` shell; navigation fallback does not cache authenticated HTML | 1 | none | reopen only on offline refresh/cache regression |
| `SEC-001` | DONE | 8 | local rules/API authorization | 1 | none | reopen only on regression |
| `SEC-002` | BLOCKED_EXTERNAL | 8 | local `netlify.toml` defines CSP/security headers, but the last production smoke found runtime CSP absent and protected routes returning 500; deployment/recheck is required | 1 | production runtime did not reflect repository header configuration | after approved deployment, verify response headers and protected-route redirects on production |
| `SEC-003` | DONE | 8 | local redacted pattern scan found no private-key/provider-key matches; only existing test fixture `local-secret`; worktree has no tracked audit artifact outside dependency files | 1 | initial ledger pointed at an ignored audit artifact that was not present in the current worktree | reopen only on a concrete secret-scan regression |
| `SEC-004` | DONE | 8 | 2026-09-25 `e2e:auth-accessibility` PASS: error uses alert role, visible keyboard focus, 375/1440px student/teacher layouts without overflow, current-page nav announcement, >=24px dashboard links, mobile drawer Escape/focus return; manual login/student accessibility-tree review; Vitest 39 files/126 tests, typecheck, lint 0 errors/8 existing warnings, `git diff --check` | 2 | reproduced missing alert role, missing `aria-current`, and 16px dashboard link targets; fixed at auth error, shared nav, and student dashboard boundaries | reopen only on a concrete accessibility regression |
| `SEC-005` | DONE | 8 | local high/critical dependency audit | 1 | none | reopen on dependency change |
| `SEC-006` | DONE | 8 | `apps/web/components/dashboard/dashboard-shell.tsx`, `scripts/e2e-auth-logout.mjs`, package script. `e2e:auth-logout` PASS: emulator login/session read-back 200; offline DELETE fails without clearing the HTTP-only session, visible alert appears and UI stays signed in; online retry clears cookie, returns to login, and `/api/me` becomes 401. Full Vitest 39 files/126 tests, typecheck, lint 0 errors/8 existing warnings, and diff check pass. | 3 | initial E2E fixture had an Auth user but no Firestore profile; after deterministic emulator-only fixture setup, reproduced logout failure: server DELETE failed offline with no visible error | reopen only on logout/session reliability regression |
| `E2E-001` | DONE | 9 | 2026-09-25 `e2e:onboarding` PASS for student+teacher: UI signup -> onboarding 201 -> session 200 -> independent Firestore + `/api/me` read-back -> reload; `e2e:classroom-join` PASS: teacher UI create -> POST 201/key hash+reservation read-back -> student UI join -> membership read-back -> reload/active class -> teacher API/UI member read-back. Existing durable assignment, learning, speaking, history, analytics and review flows retained. | 2 | initial classroom E2E had strict locator ambiguity for duplicate badge/select and member names; assertions now target the selected class and visible member | reopen only on a core durable E2E regression |
| `E2E-002` | DONE | 9 | `e2e:authorization-boundaries` PASS: unauth join 401, teacher-role join 403, malformed key 400, unknown key 404, revoked key 409 (no membership writes); maxAttempts=1 submit -> teacher return -> exhausted-attempt UI disabled -> direct attempt 2 returns 409 and Firestore remains attempt 1/returned. Existing outsider/wrong-class/device/Drive/voice negative E2E retained. Route unit test now uses real `DomainRuleError`; full Vitest 39 files/126 tests, typecheck, lint 0 errors/8 warnings, diff check pass; `e2e:assignment` isolated rerun PASS attempt 2 approved. | 5 | actual `DomainRuleError` used `code='MAX_ATTEMPTS_REACHED'`, while route checked `message`; real boundary returned 500. Mapped domain rule errors to 409 and disabled exhausted UI retry. Initial timeout was absent emulator listeners; started Auth/Firestore only. | reopen only on a concrete authorization/negative-path regression |
| `E2E-003` | DONE | 9 | text reconnect + online startup replay creates exactly one Firestore attempt and clears synced payload; offline DB migration v1->v2 removes legacy synced audio/file payloads but retains pending/conflict data; unauthenticated replay 401 -> conflict; quota test removes oldest audio to <=25 MiB; `e2e:offline-payloads` confirms Drive failure and retryable audio 503 do not mark synced. `e2e:offline-refresh` PASS. | 2 | E2E v1 fixture initially asserted DB version before app migration and was expanded to wait for migration/conflict state | reopen only on offline replay, quota, or cleanup regression; `OFFLINE-003/004` remain G |
| `E2E-004` | DONE | 9 | Extended `apps/web/scripts/e2e-pronunciation-unavailable.mjs` to verify practice-attempt Firestore read-back and same-key retry idempotency. `node --check` PASS; `pnpm --filter @tuturai/web e2e:pronunciation-unavailable` PASS against Auth/Firestore emulators: `provider_unavailable`, `score:null`, persisted attempt, retry returns same ID and exactly one matching document. Existing `E2E-002`, `WEB-TEACHER-002/006`, and `E2E-003` evidence covers voice/Drive/device/offline failure boundaries; actual provider/account/device confirmations remain G. GitHub is out of scope. | 1 | none; successful E2E emitted a non-fatal metadata lookup warning (`ETIMEDOUT`/`ENOTFOUND`) while emulator assertions all passed | reopen only on a concrete local regression or provider configuration change |
| `DEPLOY-001` | BLOCKED_EXTERNAL | 10 | `netlify.toml` preview/build/security-header config inspected; no `.netlify/state.json`, Netlify CLI, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, or `NETLIFY_API_TOKEN`; no preview URL is available in the repository | 1 | preview access cannot be inspected or deployed from this environment | resume with an authorized Netlify CLI/session and preview URL; production changes remain approval-gated |
| `DEPLOY-002` | BLOCKED_EXTERNAL | 10 | Fresh `pnpm --filter @tuturai/web build` PASS; local production-mode `next start` returns `401` JSON with CSP on `/api/me`, `/api/classrooms`, `/api/student/dashboard`. Public Netlify homepage is 200 without CSP; same API reads return empty 500. `proxy.ts` and `netlify.toml` header additions are uncommitted; no production deploy was made. | 1 | production API failures are forwarded by Netlify (`x-nf-request-id` captured); app/provider logs and runtime env cannot be read, so exact remote failure cause is not proven | with Netlify access, inspect function logs for the captured request IDs, verify `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, then request explicit production-deploy approval and recheck headers/routes |
| `DEPLOY-003` | BLOCKED_EXTERNAL | 10 | No known-good deploy ID or rollback target is recorded; `.netlify/state.json`, Netlify CLI, and account credentials are absent; public target currently has protected API 500 | 1 | rollback target cannot be established from current repository/local Netlify state | inspect Netlify deploy history once authorized site access is available; select only a verified healthy deploy as rollback target |
| `E2E-PROD-001` | BLOCKED_EXTERNAL | 11 | Protected student production routes `/api/me`, `/api/classrooms`, and `/api/student/dashboard` return 500 unauthenticated; no approved production student test account or healthy deployment is available | 1 | production runtime fails before expected unauthenticated JSON 401; local build returns the expected 401 | resume after production runtime is repaired and an approved student test account is available; run the existing protected student menu matrix |
| `E2E-PROD-002` | BLOCKED_EXTERNAL | 11 | Protected teacher production routes are not testable while the same deployed runtime returns 500; no approved production teacher test account or healthy deployment is available | 1 | production runtime unavailable for authorized teacher E2E | resume after production runtime is repaired and an approved teacher test account is available; run the existing protected teacher menu matrix |
| `RELEASE-001` | DONE | 12 | 2026-09-26 `pnpm lint` PASS (0 errors, 8 warnings); `pnpm typecheck` PASS (4 packages); `pnpm test` PASS (web 39 files/127 tests including Firestore rules; domain 9/32; validation 1/7; functions 1/1); `pnpm --filter @tuturai/web build` PASS. These are local quality gates only, not production feature proof. | 1 | none | reopen only on code/dependency changes or a gate regression |
| `RELEASE-002` | BLOCKED_EXTERNAL | 12 | accessibility/security local evidence is complete; unresolved required gates are Netlify preview/production/rollback, Google auth/Drive, AI/TTS/pronunciation, offline replay, and hardware | 1 | no required external confirmations or production approval available | resume once each listed provider/deploy/access requirement is available; keep release false until then |
| `RELEASE-003` | BLOCKED_EXTERNAL | 12 | Local cleanliness check: 86 status entries are existing source/docs/tests/specs plus this session's `EXECUTION.md`/pronunciation E2E update; no staged files, gitlinks, generated/secret-like paths, or debug logs remain; `git diff --check` reports only LF-to-CRLF warnings. Rollback evidence is still unavailable. | 1 | no authorized Netlify deploy history or verified-good rollback target | complete rollback evidence after Netlify access provides a healthy deployment ID; pre-existing worktree changes remain untouched |
| `CERT-001` | BLOCKED_EXTERNAL | 13 | no certification issued; local release gates pass, but required provider, deployment, protected-production, offline replay, and rollback gates remain open | 1 | external gates remain unproven and production deployment is not approved | re-evaluate the release table after all external gates are closed or explicitly approved non-blocking |

## One-Time External Gate Register

Each entry is reported once here. Do not repeat it in session summaries unless its
status changes or it becomes the only remaining release blocker.

| Gate | State | Reason / evidence | Resume verification |
|---|---|---|---|
| `WEB-AUTH-002` | BLOCKED_EXTERNAL | Google is active scope; live `accounts:createAuthUri` accepts Google provider and both local/Netlify continue URIs; Console redirects to Google account sign-in; end-to-end user identity and consent still need a real account | use an authorized Google browser account to complete Firebase auth -> onboarding/session -> dashboard -> reload/restore -> logout/role denial |
| `DRIVE-001` | BLOCKED_EXTERNAL | OAuth consent, callback, refresh, upload, and persisted metadata need a real teacher account; assignment file replay `OFFLINE-003` depends on the same provider boundary | Drive status -> consent -> upload -> Firestore metadata read-back -> resume `OFFLINE-003` |
| `OFFLINE-004` | BLOCKED_EXTERNAL | Local payload scrubbing and v1->v2 migration pass; current `/api/student/assessment` audio replay returned HTTP 503 `PROVIDER_UNAVAILABLE` with `retryable=true`, so no completed assessment was fabricated | once the configured STT/LLM route (`AI_STT_ROUTE`, `AI_LLM_ROUTE`, associated model IDs and `AI_V1_BASE_URL`/key when selected) responds, run `e2e:offline-payloads` and confirm one assessment plus synced payload deletion |
| `VOICE-001` / `WEB-SPEAK-002` | BLOCKED_EXTERNAL | OmniVoice/TTS endpoint/model is intentionally unconfigured | enrollment -> ready polling/webhook -> preview/playback -> delete |
| `PRON-001` | BLOCKED_EXTERNAL | Phoneme/forced-alignment provider contract and model unavailable | provider response -> per-word score -> durable score/UI |
| `HW-001` | BLOCKED_EXTERNAL | ESP32-S3, broker, CA/device credentials unavailable | firmware build/flash -> MQTT TLS reconnect -> offline queue sync |
| `DEPLOY-001` | BLOCKED_EXTERNAL | Local Netlify config is present, but this shell has no linked site, CLI, auth token, site ID, or preview URL | provide authorized Netlify access and the preview URL; production deploy is not authorized by this task |
| `DEPLOY-002` | BLOCKED_EXTERNAL | Public Netlify returns empty 500 for protected API reads and does not return the CSP configured in the current local source; Netlify runtime logs/environment are inaccessible and production deployment requires approval | grant authorized Netlify access/log visibility and explicitly approve a production deploy after preview verification |
| `DEPLOY-003` | BLOCKED_EXTERNAL | No deployment history/site access is available to identify a verified-good rollback target; current public runtime is not a valid known-good target | provide authorized Netlify deploy-history access and verify a healthy target before rollback testing |
| `E2E-PROD-001/002` | BLOCKED_EXTERNAL | Production API reads return empty 500 and no approved production test accounts are available | repair/verify a production deployment and provide approved student/teacher test accounts |
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
| `/siswa/achievements` | student | session | unlock IDs | read | Firestore | student scope | empty/error | OPEN | S/D local |
| `/siswa/profil` | student | session | profile | edit/save | Firestore | self-only | validation/error | OPEN | D local profile save/API read-back/reload |
| `/guru` | teacher | session | overview | inspect/refresh | Firestore | teacher-owned | empty/error | OPEN | D local teacher core/analytics reads |
| `/guru/kelas` | teacher | session | classrooms | create/update/join-key | Firestore | owner-only | validation/404 | OPEN | D local classroom create/key hash -> student join -> membership read-back |
| `/guru/penugasan` | teacher | session | assignments | author/publish | Firestore/Drive | owner/class | validation/upload | OPEN | D/N local published fileless authoring; Drive G |
| `/guru/siswa` | teacher | session | members | inspect/remove | Firestore | owner/class | 403/404 | OPEN | D local teacher member API/UI read-back |
| `/guru/penilaian` | teacher | session | review queue | approve/return | Firestore | owner/class | invalid state | OPEN | D local return/resubmit/approve lifecycle |
| `/guru/analitik` | teacher | session | metrics/trends | period/PDF | Firestore/PDF | owner/class | empty/403 | OPEN | D local |
| `/guru/leaderboard` | teacher | session | ranking | filter/read | Firestore | owner/class | empty/403 | OPEN | D local XP ordering and rendered route |
| `/guru/pengaturan` | teacher | session | Drive/voice settings | save/connect | Firestore/Drive/provider | teacher-only | provider/error | OPEN | D local preference save/read-back; Drive/voice G |
| `/guru/perangkat` | teacher | session | devices | register/remove/sync | Firestore/device | owner/class | 400/404/501 | OPEN | N/P local/G |

## Release Gates

`RELEASE_READY=true` requires every mandatory row below to be `PASS` or explicitly
approved as non-blocking external. Percentages are not used for release decisions.

| Gate | Task | Status | Required evidence |
|---|---|---|---|
| lint | `RELEASE-001` | PASS-local | 2026-09-26 output: 0 errors, 8 warnings |
| typecheck | `RELEASE-001` | PASS-local | 2026-09-26 root `pnpm typecheck` output |
| unit tests | `RELEASE-001` | PASS-local | 2026-09-26 root `pnpm test` output |
| integration/rules tests | `RELEASE-001` | PASS-local | 2026-09-26 Firestore emulator rules suite 6/6 and API/domain tests |
| durable E2E | `E2E-001/002/003/004` | PASS-local | local durable, negative, offline, and provider-failure matrix; external confirmations remain G |
| production build | `RELEASE-001` | PASS-local | current build output |
| dependency/security audit | `SEC-005` | PASS-local | audit output with accepted findings |
| secret scan | `SEC-003` | PASS-local | redacted scan and tracked-artifact review |
| authorization/RBAC | `SEC-001` | PASS-local | wrong-role/wrong-class evidence |
| CSP/security headers | `SEC-002` | OPEN/G | production header check after authorized deploy |
| accessibility | `SEC-004` | PASS-local | E2E auth error/keyboard/responsive/nav/target-size assertions plus manual accessibility-tree review |
| offline/PWA | `OFFLINE-003/004/005` | OPEN/G | text duplicate, migration, conflict, quota, and app-shell local evidence; Drive file replay and successful AI audio replay remain external |
| preview deployment | `DEPLOY-001` | OPEN/G | authorized Netlify preview access, deploy URL/build evidence |
| production deployment | `DEPLOY-002` | OPEN/G | authorized deploy ID + smoke + headers |
| protected production E2E | `E2E-PROD-001/002` | OPEN/G | protected menu matrix after a healthy authorized production deployment and approved test accounts |
| rollback | `DEPLOY-003` | OPEN/G | authorized known-good deploy ID + rollback target/recheck |
| critical providers | `DRIVE-001/VOICE-001/PRON-001/HW-001` | OPEN/G | real provider/device confirmation |
| repository cleanliness | `RELEASE-003` | PASS-local | no staged changes, gitlinks, generated/secret-like paths, or debug logs; existing worktree remains intentionally uncommitted |

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
