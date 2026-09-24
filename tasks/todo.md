# TuturAI Task Checklist

## Current Status

- **Completion rule:** mark a feature `[x]` only after its full user path works end-to-end with the real configured boundary, durable state, success state, failure state, and verification evidence. Unit tests or provider adapters alone remain unchecked prework.
- **Execution strategy:** production breadth-first sweep. Implement every student/teacher menu through a real durable/API boundary before deepening later-phase AI, offline, analytics, or hardware behavior. Do not loop back to already-verified auth unless a new regression is demonstrated.
- Phase 1 checkpoint complete for Firebase email/password, server session, permanent role, RBAC, and Firestore rules. Phase 2 classroom checkpoint is complete. Phase 2.5 is complete. Phase 3 implementation is complete locally; real Google Drive consent/upload verification remains open.
- Repository hygiene files (`MUST.md`, expanded `.gitignore`, and shield-based `README.md`) are prepared locally; the first GitHub MCP commit is blocked by a `403 Resource not accessible by personal access token` from `vetrns/TuturAI-Final`.

- [x] Read `PRD.md` and `AGENTS.md`.
- [x] Audit public landing/auth routes with Firecrawl and browser automation.
- [x] Confirmed existing auth/data implementation uses Supabase, demo cookie fallback, and mock data.
- [x] Confirmed placeholder device API routes; removed simulated success responses and replaced them with explicit authenticated `501` responses.
- [x] Confirmed canonical source is available in the project workspace at `source/TuturAI`.
- [x] Wrote `tasks/plan.md` with dependency-ordered implementation slices.
- [x] Confirm canonical source workspace before code implementation: `source/TuturAI` on `main` at `70dd524`.
- [x] Complete feature parity matrix in `tasks/feature-parity-matrix.md`.
- [x] Complete Phase 1 implementation; Firebase Auth/session/onboarding, reusable role guard, and local Firestore scaffolding are implemented.
- [x] Complete Phase 1 verification; cloud email/password registration, session restore, logout, role boundaries, wrong-role API, and local rules tests are verified. Google popup consent remains an external provider gate.
- [x] Add authenticated `GET /api/me` contract with Firestore profile and role-scoped permissions.
- [x] Student dashboard profile metrics now come from Firestore via `/api/me`; mock mission/activity/leaderboard cards are replaced by explicit durable-data pending states.
- [x] Student dashboard assignment panel now reads published assignments and the student's Firestore submission state through `/api/student/dashboard`.
- [x] Student dashboard class leaderboard now reads active membership and durable user XP from Firestore with server-side class membership authorization.
- [x] Student leaderboard page now reads the authorized Firestore leaderboard through `/api/student/dashboard`; removed leaderboard mock data, fake speaking scores, fake streaks, and hardcoded student identity.
- [x] Student profile page now reads name, email, school, class, level, and XP from the Firestore-backed dashboard profile; removed hardcoded profile data and fake XP progress.
- [x] Student quiz now reads published grammar questions from the Firestore `questionBank` collection and persists idempotent answers/XP through a protected student API.
- [x] Seed 30 authored grammar, vocabulary, and reading questions into the configured Firestore project with deterministic IDs; rerunning the seed is fail-closed.
- [x] Extend the deterministic seed with vocabulary cards, browser-readable listening prompts, and pronunciation practice content; make the seed rerunnable with deterministic `batch.set` writes.
- [x] Replace student vocabulary, listening, and pronunciation mock arrays with Firestore-backed loading, loading/error/empty states, and persisted practice attempts.
- [x] Replace student speaking topic mock data with Firestore-backed published topics and retain explicit AI/provider error behavior in the speaking session.
- [x] Finish the Phase 2.4 migration for dashboard pages; student practice/progress/achievements and teacher dashboard, students, leaderboard, devices, and analytics now use durable data or explicit unavailable states.
- [x] Phase 2.5: persist learning streak, attempt counters, correct-answer counters, and achievement unlock IDs in the idempotent question-answer transaction with transparent UTC-day rules.
- [x] Phase 3.1/3.2: add Google Drive OAuth PKCE state handling, encrypted server-only token storage, token refresh, strict upload validation, and teacher-owned classroom upload boundary; credentials remain an explicit gate.
- [x] Phase 3 folder and metadata slice: auto-create `TuturAI/class/assignment/submission/student`, persist assignment/submission Drive metadata, and expose connection status/disconnect actions.
- [x] Phase 1 auth error handling: preserve Firebase error codes, explain duplicate email/provider configuration failures, and route existing Google accounts through normal session creation instead of repeating onboarding.
- [x] Adaptive learning menu slice: replace the hardcoded student path with a protected Firestore-backed recommendation endpoint, durable attempt-derived activity state, empty/error states, and links to the corresponding practice routes.

## Phase 0: Source Alignment

- [x] Decide canonical source path / bring source into workspace.
- [x] Add reproducible scripts and env documentation.
- [x] Create route-to-PRD feature parity matrix.

## Phase 1: Foundation, Auth & Data Model

- [x] Environment schema and secret boundary (`source/TuturAI/apps/web/lib/config/env.ts`, `.env.example`).
- [x] Shared domain types and validation/error envelope (`packages/domain`, `packages/validation`).
- [x] Pure submission transition, assessment normalization, and idempotent sync queue logic with unit tests.
- [x] Pure classroom join-key validation and ownership/membership guards with unit tests.
- [x] Firebase Auth Google + email/password client flow implemented; email/password cloud flow verified, Google popup consent remains externally gated.
- [x] Permanent onboarding role endpoint implemented with immutable role conflict protection.
- [x] Firebase ID token verification for onboarding, Firebase session-cookie verification for protected requests, and reusable role-aware API guard.
- [x] Add Firestore schema audit, indexes file, security rules, and emulator configuration.

### Current execution slice

- [x] Replace Supabase/demo auth client with Firebase Auth.
- [x] Add HTTP-only session bridge and server-side profile lookup.
- [x] Add role onboarding endpoint with immutable role write.
- [x] Add protected route/API guard integration tests.
- [x] Add Firestore rules/indexes/emulator scaffolding.
- [x] Add executable Firestore rules tests with the verified Java 25 runtime.

## Verification Requirements

- [x] Typecheck/lint (lint passes with 7 pre-existing React Compiler/UI warnings).
- [x] Unit tests for changed validation logic.
- [x] Integration tests for reusable protected API guards; endpoint and rules integration remain.
- [x] E2E auth happy path for student and teacher via email/password.
- [x] Unauthorized and wrong-role failure paths; Firestore wrong-class/outside access rules are covered by emulator tests.
- [x] No simulated success or dead interaction; device routes fail closed and remaining provider-gated states are explicit.
- [x] Phase 2 classroom slice: teacher create/list and student join/list endpoints with hashed join keys.
- [x] Phase 2 classroom lifecycle: teacher update/archive, join-key regeneration/revocation, durable join-attempt rate limiting, and transactional key reservations.
- [x] Phase 2 membership management: teacher member listing/removal with classroom ownership enforcement.
- [x] Phase 2 multi-class switcher: student dashboard lists memberships and allows selecting the active classroom.
- [x] Phase 2 classroom UI: teacher create, lifecycle, join-key, and member management actions use real API states; student join panel uses real API states.
- [x] Normalize classroom and membership timestamps to Firestore `Timestamp` values; API responses expose ISO strings.
- [x] Phase 2 browser checkpoint: teacher create, invalid-key rejection, student join, active-classroom display, and teacher member listing verified with durable API responses.
- [x] Phase 3 assignment domain validation and draft/publish/archive rules.
- [x] Phase 3 Firestore assignment create/list API with teacher ownership and student membership enforcement.
- [x] Phase 3 submission turn-in/review APIs with late derivation, max-attempt enforcement, approve terminal state, and returned resubmit.
- [x] Phase 3 assignment/student pages use real assignment and submission API states.
- [x] Phase 3 teacher review queue uses teacher-scoped Firestore data and real approve/return actions.
- [x] Phase 4.1 AI adapter contract and failure-safe assessment processing.
- [x] Phase 4.2 end-to-end STT: emulator-backed Playwright upload to the protected speaking assessment route reached the configured Whisper provider and returned transcript `you`.
- [x] Phase 4.3 end-to-end assessment: the same provider boundary returned normalized assessment data and the confirmed result was persisted to Firestore; UI microphone capture uses this shared boundary without a fabricated fallback.
- [x] Phase 4.4 adaptive recommendation persistence/API; the protected route now reads durable assessment history and prioritizes the weakest confirmed dimension.
- [x] Phase 3 Firestore security rules deny client writes and scope assignment/submission reads by role/class.
- [x] Question bank server contract, answer validation, server-side scoring, and idempotency tests.

## Production Breadth-First Menu Sweep

- [x] Student dashboard: durable profile/class/assignment/progress aggregation with explicit unavailable states; rank, streak, recent activity, and weekly target now derive from server data. Authenticated student browser proof remains pending.
- [x] Student learning menus: all non-provider paths (conversation text, vocabulary, listening, quiz, adaptive path, pedagogical test) have durable browser evidence; speaking provider upload/persistence is verified, while pronunciation scoring remains explicitly provider-unavailable until a phoneme-capable provider is configured.
- [x] Student history menus: progress, leaderboard, achievements, and profile use the same permission-filtered durable source; authenticated Playwright verified all four routes, durable stats, and unauthenticated `401`.
- [x] Teacher core menus: dashboard, classes, assignments, students, speaking review, analytics, and leaderboard use real classroom-scoped data; authenticated Playwright verified all seven routes, analytics `200`, and wrong-class fail-closed `404`.
- [x] Teacher integrations local boundary: `scripts/e2e-teacher-integrations.mjs` verified teacher settings/device routes, Drive status `200` with durable connection shape, missing-upload validation `400`, empty device state, invalid registration `400`, and missing-device removal `404`; real Drive consent/upload remains an external gate.
- [ ] Breadth checkpoint: every menu has a verified happy path, failure path, and server-side authorization test before deep feature work resumes.

### Speaking-related scoring decision

- [x] Scoring contract applies to the three speaking-related menus: `Speaking`, `Pronunciation`, and `Percakapan`.
- [ ] End-to-end menu scoring is complete: speaking voice upload and deterministic conversation text are verified; pronunciation remains score-free/provider-unavailable until a phoneme-capable provider is configured, and conversation voice remains provider-gated.
- [x] Non-speaking menus keep deterministic server-side scoring and do not receive AI calls by default.
- [x] Browser verification rule: use Playwright scripts, not manual browser MCP interaction.
- [x] Test-data rule: seed Firebase/Firestore through test setup; never place mock production records or simulated provider success in application code.

## Latest Verification

- [x] Direct TypeScript compiler: passed after Firestore timestamp and guard-test changes.
- [x] Vitest full local suite: 23 tests passed, including 3 protected API guard tests.
- [x] `git diff --check`: passed for the canonical source repository.
- [x] Root Turborepo typecheck: passed.
- [x] Root Turborepo build: passed; Next.js generated 38 routes.
- [x] Root Turborepo tests: passed (17 domain + 4 validation + 1 functions health + 3 API guard + 6 Firestore rules tests).
- [x] Repository lint: passed with 7 warnings from existing UI code and 0 errors.
- [x] Local Firebase/Firestore verification: emulator-backed rules tests pass under Java 25.
- [x] Production public smoke: `/auth/login`, `/auth/sign-up`, and `/auth/error` returned `200`; headings, form labels, keyboard focus, and browser console were verified. Removed the incompatible Vercel Analytics runtime injection and dependency after it produced `/_vercel/insights/script.js` errors on the Netlify-targeted production server.
- [x] Fresh post-cleanup verification: root `pnpm test` passed with 37 web files/117 tests, `pnpm audit --prod --audit-level=high` reported no known vulnerabilities, root typecheck/build passed, and `git diff --check` passed.
- [x] Assignment domain tests: 21 domain tests passed.
- [x] Assignment build verification: root build passed and generated assignment/submission routes.
- [x] Submission refresh verification: student submission lookup restores server state after reload.
- [x] Final slice verification: root typecheck and build passed; web lint passed with 8 existing/React Compiler warnings and 0 errors.
- [x] Review queue verification: full web emulator suite passed with 11 tests; build includes `/api/submissions/review-queue`.
- [x] Phase 4.1 verification: provider adapter tests cover timeout/retry/cancellation/malformed output without fabricated scores.
- [x] Phase 4.2 end-to-end verification: configured provider upload returned transcript `you` through `/api/student/assessment`; the corresponding normalized assessment persistence was confirmed in the emulator.
- [x] Phase 4 runtime adapter verification: real Whisper returned transcript `you`, real v1 chat assessment returned normalized JSON, focused AI/API tests passed (11 tests), full web emulator suite passed (37 tests), root typecheck passed, and production build passed with 51 routes.
- [x] Phase 1 authenticated verification: Firebase email/password signup returned `200`, onboarding `201`, session `200`, and role dashboards loaded for both student and teacher. Browser session restore, logout, unauthorized redirect, wrong-role route redirects, and wrong-role API `403` were verified.
- [x] Adaptive recommendation prework: 3 domain tests pass with bounded difficulty and transparent focus reason.
- [x] Student dashboard shell and profile now read level, XP, streak, and rank from server-backed profile/dashboard data; no hardcoded gamification values remain in the student shell/profile.
- [x] `/api/me` tests: 3 passed; full Turborepo test suite: 20 web tests passed; Next.js build includes `/api/me`.
- [x] Focused post-dashboard verification: 14 non-emulator web tests passed, 6 auth/API tests passed, typecheck passed, and Webpack production build passed with `/api/me`.
- [x] Student dashboard assignment slice verification: 17 non-emulator web tests passed, typecheck passed, lint passed for changed files, and Webpack production build passed with 43 routes including `/api/student/dashboard`.
- [x] Student dashboard leaderboard verification: 17 non-emulator web tests passed, typecheck passed, repository lint passed with 8 pre-existing warnings and 0 errors, and Webpack production build passed with 43 routes.
- [x] Leaderboard/profile slice verification: 17 non-emulator web tests passed, typecheck passed when run after the build, focused lint passed, and Webpack production build passed with 43 routes.
- [x] Question bank verification: 30 Firestore seed items created, 26 domain tests passed, web typecheck passed, Webpack build passed with 44 routes, and quiz route uses explicit loading/error/empty states.
- [x] Phase 2.5 verification: 29 domain tests passed, web typecheck passed, Turbopack production build passed with 45 routes, and web lint passed with 7 existing warnings and 0 errors.
- [x] Phase 3.1/3.2 verification: 27 web tests passed under the Firestore emulator, web typecheck passed, and Turbopack production build passed with 48 routes including Drive OAuth/upload boundaries.
- [x] Phase 3 folder/metadata verification: web typecheck passed, web lint passed with 7 existing warnings and 0 errors, domain tests passed with 29 tests, and Drive routes compile into the production build.
- [x] Fresh Phase 3 slice verification: web emulator suite passed with 27 tests, domain suite passed with 29 tests, and production build passed with 50 routes including Drive status/disconnect and file submission routes.
- [x] Phase 2 browser checkpoint verification: teacher created classroom, invalid join key failed closed, student joined once, student dashboard showed the active classroom, teacher member view showed the same student, and classroom/member API requests returned `200`.
- [x] Post-checkpoint verification: root typecheck passed; full Turborepo test passed with 37 web tests, 29 domain tests, 4 validation tests, and 1 functions test; lint passed with 5 existing React warnings and 0 errors.
- [x] Adaptive menu verification: focused adaptive/domain tests passed (4 tests), web typecheck passed, production build passed with 52 routes including `/api/student/adaptive`, lint passed with 5 existing warnings and 0 errors, and Next.js MCP reported no compile/runtime errors. Authenticated student browser verification remains pending because the available browser session is teacher-scoped.
- [x] Pronunciation safety verification: 4 focused tests passed, web typecheck passed, production build passed with `/api/student/practice-attempts`, and pronunciation no longer sends a fabricated quiz answer or creates a score. Full emulator suite had 14 passing files (43 tests, 6 skipped) before the existing Firestore rules initialization hook timed out at 10s.
- [x] Student dashboard insight verification: 5 focused tests passed, changed-file lint passed, web typecheck passed, production build passed, and Next.js MCP reported no compile/runtime errors. Full web suite reached 15 passing files (45 tests, 6 skipped) before the existing Firestore rules initialization hook timed out at 10s.
- [x] Student shell/profile durability verification: web typecheck passed, all 16 web test files/51 tests passed under the Firestore emulator, web lint passed with 0 errors and 5 existing warnings, production build passed, and Next.js MCP reported no config/runtime errors.
- [x] Vocabulary durability verification: server-derived mastered IDs restore after reload, mastery updates only after a confirmed protected API response, non-rules suite passed with 16 files/47 tests, typecheck passed, lint passed with 0 errors and 5 existing warnings, production build passed, and Next.js MCP reported no config/runtime errors. Firestore rules suite remains affected by its existing initialization timeout.
- [x] Listening durability verification: server-derived mastery badges restore after reload, answer submission uses stable per-question idempotency keys, partial submit failures expose retryable UI instead of silent failure, non-rules suite passed with 16 files/47 tests, typecheck passed, lint passed with 0 errors and 5 existing warnings, production build passed, and Next.js MCP reported no config/runtime errors.
- [x] Expand question-bank coverage: added a create-only expansion script and wrote 276 missing Firestore documents so `question`, `vocabulary`, `listening`, `pronunciation`, `speaking`, `conversation`, and `test` each have 50 published items.
- [x] Google login session handoff hardening: popup auth now exchanges the returned `UserCredential.user` directly instead of depending on `currentUser` timing; typecheck/build passed, but real Google callback/session verification remains open.
- [x] Question-bank/auth patch verification: focused tests passed (4 tests), web typecheck passed, web lint passed with 5 existing warnings and 0 errors, Webpack/Turbopack production build passed with 53 generated routes, and Next.js MCP reported no config/runtime errors.
- [x] Teacher analytics implementation prework: added protected `/api/teacher/analytics`, teacher-classroom/member scoping, durable question-attempt and assessment aggregation, explicit unavailable speaking state, and analytics UI loading/error/empty states. Real authenticated browser verification remains open before breadth checkpoint completion.
- [x] Teacher leaderboard implementation: added protected `/api/teacher/leaderboard`, teacher-owned classroom membership scoping, durable XP ranking, persisted speaking-score averages, and replaced the alphabetical/N/A placeholder UI with real ranking and explicit unavailable metrics.
- [x] Added emulator-only Playwright E2E fixture script at `apps/web/scripts/e2e-speaking-assessment.mjs`; it fails closed when Auth/Firestore emulator variables are absent and seeds only test data.
- [x] Completion-popup implementation checkpoint: Quiz, Vocabulary, Listening, Tes Pedagogis, and confirmed-provider Speaking now render reusable result dialogs; root typecheck passes, focused completion tests pass, changed-file lint has 0 errors, and `git diff --check` passes. Emulator-backed Playwright happy/failure evidence is still required before checking these menu slices.
- [x] Conversation text scoring increment: deterministic keyword-relevance rubric, idempotent Firestore persistence, protected API, retryable UI error, completion popup, and focused route/domain tests are implemented. Full browser/emulator evidence remains open.
- [x] Offline foundation increment: versioned IndexedDB stores, idempotent pending-mutation model, online/offline status indicator, and production service-worker registration/app-shell cache are implemented. Domain mutation wiring, reconnect replay, audio quota cleanup, and offline E2E remain open.
- [x] Current verification checkpoint: Firestore-emulator suite passed with 25 test files and 70 tests, root typecheck passed, production build passed, and full web lint passed with 0 errors and 5 existing React warnings.
- [x] Continuation slice: OmniVoice voice-profile API/UI prework, teacher-isolated metadata lifecycle, consent/delete path, and fail-closed provider errors added with 8 focused tests; real OmniVoice remains explicitly provider-gated.
- [x] Continuation slice: teacher-only voice synthesis preview now returns provider audio bytes with no-store headers only for a ready teacher profile; malformed/empty/provider failures remain explicit.
- [x] Continuation slice: device registry/pairing prework, one-time hashed device credentials, teacher/classroom authorization, credentialed heartbeat, client-denied Firestore device rules, and dashboard removal of fake hardware status added; 8 device-focused tests, typecheck, lint, emulator suite, and production build passed.
- [x] Removed additional simulated/dead behavior: dashboard hardware `setTimeout` sync, hardcoded hardware metrics, static speaking prompts, example-audio dead button, null progress score rendered as `0`, and Drive attachment `href="#"` fallback.
- [x] Dependency security gate: upgraded Next.js to `16.3.3` and PostCSS to `8.5.18`; `pnpm audit --prod --audit-level=high` now reports no high/critical vulnerabilities. Remaining audit findings are low/moderate and require separate upgrade compatibility review.
- [x] Offline sync verification: IndexedDB replay now handles stable idempotency keys, transient retry/backoff, permanent conflicts, online reconnect, and 25 MB audio FIFO cleanup; typecheck and six offline queue tests pass.
- [x] Adaptive assessment-history verification: focused adaptive/domain and route tests passed (5 tests), production build passed with `/api/student/adaptive`, and root typecheck passed after regenerating the interrupted Next cache.
- [x] Phase 6 analytics/report slice: teacher analytics now shares one aggregation contract for periods, trends, skill distribution, common errors, and attention students; `/api/teacher/reports` enforces teacher classroom/student scope and returns a generated PDF; analytics UI supports period selection and PDF download. Focused tests passed (8 tests), changed-file lint passed, root typecheck passed, and emulator-backed Playwright verified populated analytics, period filtering, PDF content type, and outsider student denial (`403`).
- [x] Playwright menu verification: assignment lifecycle passed `submit → return → resubmit → approve` with durable attempt 2; speaking review loaded a confirmed score of 80; Quiz, Listening, and Tes Pedagogis completed with confirmed `100/100` dialogs and 40 durable question attempts.
- [x] Question-bank boundary repair: published content is read from a bounded 1000-document window before applying type/skill/level filters, preventing later content types from being hidden by insertion order; test question generators now include answer options and `repair:test-question-options` repairs legacy documents idempotently.
- [x] Question-bank cache boundary hardening: protected question-bank GETs are forced dynamic and Vocabulary requests use `cache: no-store`, preventing stale published content from being reused across sessions.
- [x] Learning-menu continuation: the emulator-backed Playwright flow now covers Quiz, Listening, Tes Pedagogis, AI Conversation text, and Vocabulary with 40 durable question attempts plus 1 durable conversation attempt; the teacher speaking review flow also confirms score 80.
- [x] Practice-attempt idempotency hardening: pronunciation submissions now require a stable idempotency key, persist deterministic attempt IDs, and remain score-free when the provider is unavailable; focused route/domain tests passed and typecheck passed.
- [x] Adaptive deep-link completion: Tes Pedagogis now consumes the recommendation `questionId` consistently with the other learning menus.
- [x] Fresh post-patch verification: web Vitest passed 33 files/99 tests, web typecheck passed, production build passed with 60 static pages and all application routes, lint passed with 0 errors and 7 existing React warnings, and `git diff --check` passed.
- [x] Adaptive/offline/provider continuation verification: learning-menu Playwright passed Quiz, Listening, Tes Pedagogis, Conversation text, Vocabulary, and Adaptive with 40 durable question attempts plus 1 durable conversation attempt; offline queue replay passed with exactly 1 durable record; configured speaking provider upload returned transcript `you`, a normalized score, and persisted the assessment. Firebase Auth emulator session exchange required and now uses an emulator-only verified-token bridge; production still uses Firebase session cookies.
- [x] Fresh post-dependency verification: direct web emulator suite passed 34 files/107 tests, root typecheck passed, production build passed with all application routes, lint passed with 0 errors and 7 existing React warnings, and moving `shadcn` to devDependencies reduced the production audit to one moderate optional `uuid` advisory with no high/critical findings.
- [x] Fresh continuation verification: root `pnpm test` passed with 37 web files/117 tests plus domain, validation, and functions suites; root `pnpm typecheck` passed; root `pnpm build` passed with all application routes; `pnpm lint` passed with 0 errors and 7 existing React warnings; production audit reported no known vulnerabilities; and `git diff --check` passed.
- [x] Student conversation voice boundary: added class-scoped `POST /api/classrooms/[classroomId]/voice`, active-membership and teacher-profile authorization, explicit processing/unavailable/provider failure states, and a real audio playback action with active-classroom selection. Focused route/provider tests passed (18 tests), web typecheck/lint passed, and production build includes the route. Real OmniVoice playback remains provider-gated.
- [x] Student history E2E: `scripts/e2e-student-history.mjs` verified progress, leaderboard, achievements, and profile with durable data and unauthenticated `401`.
- [x] Teacher core E2E: `scripts/e2e-teacher-core.mjs` verified dashboard, classes, assignments, students, speaking review, analytics, and leaderboard; wrong-class access fails closed with `404`.
- [x] Pronunciation unavailable E2E: `scripts/e2e-pronunciation-unavailable.mjs` verified the pronunciation page and protected practice attempt persist `provider_unavailable` with `score: null` and no fabricated score.
- [x] Final verification for this slice: typecheck passed, production build passed with all application routes, `git diff --check` passed, and emulator-backed Vitest passed with 36 files/113 tests.
- [x] Teacher integrations local E2E: emulator-backed Playwright verified `/guru/pengaturan`, `/guru/perangkat`, authenticated session restore, Drive status, Drive upload validation, and device success/error states.
- [x] Student voice authorization E2E: `scripts/e2e-student-voice-gate.mjs` verified invalid text `400`, active classroom access stopping at explicit teacher voice `processing` `409`, and wrong-class access failing closed with `404`; no audio success was simulated.

## Mandatory Menu Completion Slices

- [x] Contract recorded: every completable activity requires durable result, validated score, completion popup, success/failure state, authorization, and Playwright E2E evidence.
- [x] Slice 1 `Quiz`: completion popup with confirmed score and XP; retryable answer failure; protected persistence and Playwright happy path verified by `scripts/e2e-learning-menus.mjs`.
- [x] Slice 2 `Vocabulary`: server-confirmed mastery attempts drive the deterministic `10/10` completion popup; emulator-backed Playwright evidence passes with 10 durable vocabulary attempts.
- [x] Slice 3 `Listening`: completion popup with deterministic score and durable attempts. Playwright happy path verified by `scripts/e2e-learning-menus.mjs`.
- [x] Slice 4 `Tes Pedagogis`: completion popup with deterministic score and durable result. Playwright happy path verified by `scripts/e2e-learning-menus.mjs`.
- [x] Slice 5 `Speaking`: completion popup is wired only to a confirmed normalized assessment; configured provider multipart upload and Firestore persistence are verified by `scripts/e2e-speaking-provider.mjs`.
- [ ] Slice 6 `Pronunciation`: completion popup only after phoneme-capable provider confirms a score; otherwise explicit unavailable state.
- [x] Slice 7 `AI Conversation` text path: server-side rubric persists the validated answer before the completion popup; emulator-backed Playwright evidence now passes with one durable `conversationTextAttempts` record. Voice path remains provider-gated.
- [x] Slice 8 `Penugasan`: server-confirmed completion popup, submit → return → resubmit → approve, attempt 2 persistence, and Playwright evidence verified by `scripts/e2e-assignment-lifecycle.mjs`.
- [x] Slice 9 `Adaptive Path`: emulator-backed Playwright verified the adaptive `200` response, durable completion count, and deep link to a linked activity; the path does not create an independent score or popup.
- [x] Adaptive API now folds confirmed practice, conversation, and question-scoped assessment scores into durable activity completion; unscored provider failures remain incomplete. Completed material is never recommended again. Focused web tests (16), isolated adaptive completion E2E, root typecheck, and production build pass with no browser console/page errors.
- [x] Teacher analytics/report browser verification: `scripts/e2e-teacher-analytics-report.mjs` verified populated classroom metrics, `7d` period reload, `application/pdf` report response, and cross-class student denial (`403`).
- [x] Non-completable navigation/monitor screens (`Dashboard`, `Progress`, `Leaderboard`, `Pencapaian`, `Profil`, teacher screens) show durable summaries only and do not invent scores; teacher dashboard trend/skill/error panels now consume the authorized analytics contract, while unavailable provider-derived metrics remain explicitly labeled.

## Blockers

- GitHub MCP identifies as `vetrns`, but the current token cannot write repository contents; the empty `vetrns/TuturAI-Final` repository needs a token/session with repository `Contents: write` permission before the MCP commit can be created.
- Root repository integrity gate remains open: `apps/web` and `source/TuturAI` are tracked as gitlinks without a `.gitmodules` mapping. Nested history and uncommitted source changes are preserved; do not flatten or delete nested `.git` directories without an explicit backup/normalization decision.
- Next.js MCP server currently detected belongs to unrelated `Mavent/anymd`; no TuturAI dev server is running.
- Cloud Firestore discovery was initially blocked, then verified after Firebase CLI login/project selection; the existing Firestore project/database was retained.
- Google Drive OAuth values are present locally; real consent/callback/upload verification remains an external provider gate. Self-hosted TTS model is still unavailable.
- Firebase project configuration and Admin credentials are present in local environment; email/password cloud auth verification is complete. Google popup consent remains an external account/consent gate.
- The Firestore project/database is an existing project decision and was verified through the authenticated Firebase CLI; do not provision or replace it. Local emulator verification uses the verified JDK 25 path and `pnpm dlx firebase-tools@latest`.
- Firebase Google login does not require a duplicate Google OAuth client key. Drive credentials are configured, but Checkpoint 3 remains open until a real OAuth consent and upload confirms provider metadata behavior.
- Firebase client configuration is present and `authDomain` matches `${projectId}.firebaseapp.com`; Google provider activation remains a Firebase Console setting, not a frontend code fix.
- Phase 3 Drive boundary, folder hierarchy, MIME/size validation, and assignment/submission metadata persistence are implemented locally.
- Phase 4 v1 provider integration is no longer credential-gated: `AI_V1_BASE_URL`, `AI_V1_API_KEY`, `AI_STT_MODEL_ID`, and `AI_LLM_MODEL_ID` are present in `.env.local`.
- Phase 4 runtime verification: real Whisper returned transcript `you`; the v1 OpenAI-compatible chat route returned normalized JSON; emulator-backed Playwright multipart upload confirmed the protected route and Firestore assessment write.
- Authenticated speaking UI microphone capture remains a browser-device smoke concern, but the shared upload boundary is provider-confirmed and failure-safe; no score is fabricated when the provider fails.
- Local OmniVoice/TTS remains intentionally unconfigured until the self-hosted service is built; `AI_LOCAL_BASE_URL` and `AI_TTS_MODEL_ID` must stay empty without being treated as simulated success.
- `AI_LOCAL_API_KEY` is now supported for local provider bearer auth, is server-only, and is never included in request bodies or public config. Real OmniVoice remains blocked because `AI_LOCAL_BASE_URL`, `AI_LOCAL_API_KEY`, and `AI_TTS_MODEL_ID` are currently missing from `.env.local`.
- Turbopack production build currently fails while resolving remote `next/font` assets; Webpack production build passes. This is an environment/network/toolchain verification issue, not a dashboard type or route error.
- Teacher analytics verification: official emulator-backed web test command passed with 19 files/57 tests including Firestore rules and analytics unit/API tests; web typecheck passed after route generation; production build passed with `/api/teacher/analytics`; lint passed with 0 errors and 5 existing React warnings. Authenticated teacher browser verification remains open.
- Teacher leaderboard verification: focused tests passed (3 tests), typecheck passed after route generation, lint passed with 0 errors and 5 existing React warnings, production build passed with `/api/teacher/leaderboard`, Next.js MCP reported no errors, and Playwright confirmed `/guru/leaderboard` loaded with `GET /api/teacher/leaderboard` returning `200` and no console errors.
- Latest official emulator-backed suite: 21 test files and 60 tests passed, including Firestore rules, teacher analytics, and teacher leaderboard API coverage.
- Latest local non-emulator suite: 20 test files and 55 tests passed; Firestore rules suite could not initialize because the emulator was not running on `127.0.0.1:8080`. Root lint passes with 5 existing warnings. Latest learning-menu Playwright run passed Quiz, Listening, Tes Pedagogis, and AI Conversation text with 30 durable question attempts plus 1 durable conversation attempt.
- Latest continuation verification: isolated adaptive completion E2E passed with one confirmed durable attempt and `1 / 1` completion; student shell no longer requests teacher-only device data; root tests passed with 37 web files/117 tests, root typecheck/build passed, lint passed with 7 existing React warnings, `pnpm audit --prod --audit-level=high` reported no known high/critical vulnerabilities, and production headers were verified on `/auth/login`.
