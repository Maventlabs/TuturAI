# Implementation Plan: TuturAI PRD v0.1

> HISTORICAL / DO NOT USE FOR EXECUTION STATE
>
> The canonical ordered task graph and phase lock live in
> [`../EXECUTION.md`](../EXECUTION.md). This file preserves the original plan
> and migration rationale.

## Overview

Membawa codebase TuturAI existing ke target PRD secara incremental, dengan mempertahankan route/UI yang sudah ada tetapi mengganti Supabase/demo/mock behavior dengan Firebase, secure Netlify Functions, Google Drive, configurable AI adapters, dan offline-first persistence. Implementasi harus dimulai dari Phase 1 dan hanya melanjutkan phase setelah acceptance criteria serta verification phase sebelumnya lulus.

**Completion rule:** a task may be checked only after the complete user journey works end-to-end through its real configured provider or durable boundary, including success, failure, persistence, and verification evidence. Local adapters, isolated unit tests, and compile-only slices are implementation prework.

## Audit Baseline

- Source audit: `source/TuturAI` dari `Maventlabs/TuturAI`, branch `main`, commit `70dd524`.
- Workspace proyek menyimpan source canonical di `source/TuturAI`; root tetap menyimpan PRD, operating contract, dan task artifacts.
- Existing web app: Next.js 16 + React 19 + TypeScript.
- Existing auth/data: Supabase SSR/client, demo cookie fallback, centralized mock data.
- Existing API: tiga device routes placeholder yang mengembalikan simulated success.
- Existing test setup: Vitest is available locally; focused shared-package tests cover onboarding validation, submission transitions, assessment normalization, sync idempotency, and function health.
- Monorepo deployment config: root `netlify.toml` now points Netlify Functions at `apps/functions/netlify` and builds `@tuturai/web`.

## Architecture Decisions

- Pertahankan route dan UI existing sebagai compatibility surface; lakukan migration slice-by-slice, bukan rewrite.
- Firebase Auth menjadi identity provider untuk Google dan email/password; role immutable disimpan pada server-controlled user profile.
- Firestore menjadi source of truth untuk durable domain data; IndexedDB hanya untuk cache/draft/audio queue/offline recovery.
- Netlify Functions menjadi secure boundary untuk Firebase Admin, Drive OAuth/upload, AI proxy, reports, dan device operations.
- Semua provider AI berada di balik adapter internal; URL, key, dan model ID hanya server-side environment.
- Google Drive `drive.file` menjadi storage assignment/submission; Firestore hanya menyimpan metadata/file IDs.
- Demo accounts, mock dashboard metrics, placeholder device responses, dan fallback simulated success tidak boleh masuk ke production behavior.
- Define shared domain types, validation schemas, and error envelope before feature endpoints.

## Task List

### Production Breadth-First Sweep

Execution strategy: every student and teacher menu gets a real UI-to-server/durable path first. Later AI, offline, analytics, and hardware depth follows after the complete surface is connected. Checkpoints must not cause verified auth work to loop; only credential gates, destructive actions, or new regressions may block progress.

- Student menus: dashboard, penugasan, speaking, AI conversation, pronunciation, vocabulary, listening, quiz, adaptive path, tes pedagogis, progress, leaderboard, achievements, profil.
- Teacher menus: dashboard, kelas, penugasan, siswa, penilaian speaking, analitik, leaderboard, monitor perangkat, pengaturan/Drive.
- Every slice requires protected API/data boundary, durable Firestore state or explicit unavailable state, validation, wrong-role/wrong-class tests, and verification evidence. No mock data or simulated success may look active.

#### Speaking-related scoring contract

- `Speaking`: record audio, run configured Whisper/STT, then run configured assessment LLM. Persist transcript, pronunciation, fluency, intonation, grammar, vocabulary, overall, feedback, confidence, provider/error metadata, and assessment status. Provider failure must remain retryable and must not create a completed score.
- `Pronunciation`: score the selected word/phrase against the expected pronunciation. Use a configured speech/phoneme-capable provider when available; do not use the general speaking rubric as a fake substitute. Until that capability is configured, persist the practice attempt with `score: null` and an explicit provider-unavailable state.
- `Percakapan`: text responses use deterministic rubric validation where the scenario supplies an answer key/rubric; voice responses may use STT plus the conversation assessment provider. Persist per-turn and session score only after validated output. TTS availability is independent from assessment scoring.
- `Quiz`, `Vocabulary`, `Listening`, and `Tes pedagogis`: continue using deterministic server-side scoring and do not call AI unless a menu-specific requirement explicitly needs semantic evaluation.
- E2E verification must use Playwright scripts. Test data must be seeded through Firebase/Firestore emulator or the configured test Firebase project, never embedded as production mock data or static simulated success.

#### Mandatory menu completion contract (2026-09-22)

- **Wajib berfungsi:** setiap menu aktivitas yang dapat diselesaikan harus benar-benar terhubung ke boundary Firestore/server, menghitung skor dengan formula deterministik atau AI provider yang memang dibutuhkan, menyimpan hasil durable, dan menampilkan state sukses maupun failure. Tidak boleh ada popup yang mengklaim skor bila server/provider belum mengonfirmasi hasil.
- **Per-menu E2E:** implementasi dilakukan satu menu per vertical slice. Slice dianggap selesai hanya setelah UI, API/domain scoring, persistence, popup hasil (teks + skor), retry/error state, authorization, focused tests, typecheck/lint, dan Playwright E2E happy/failure path lulus. Menu berikutnya tidak disentuh sebelum checkpoint slice sebelumnya lulus.
- **Scope:** popup completion berlaku untuk aktivitas siswa yang menghasilkan outcome. Dashboard, Progress, Leaderboard, Pencapaian, Profil, serta teacher navigation adalah destination/monitoring screens dan tidak diberi skor palsu; mereka hanya menampilkan hasil durable dari aktivitas.
- **Urutan slice:** `Quiz` -> `Vocabulary` -> `Listening` -> `Tes Pedagogis` -> `Speaking` -> `Pronunciation` -> `AI Conversation` -> `Penugasan` -> `Adaptive Path`. Setiap slice memakai komponen popup yang sama tetapi hanya menerima hasil yang sudah tervalidasi server-side.

### Phase 0: Source Alignment

- [x] Task 0.1: Put the audited active repository in the project workspace or confirm the canonical source path.
- [x] Task 0.2: Add reproducible project scripts and environment documentation without adding credentials.
- [x] Task 0.3: Record the feature parity matrix from existing routes/components to PRD requirements.

### Phase 1: Foundation, Auth & Data Model

- [x] Task 1.1: Add typed environment schema and server/client boundary checks.
- [x] Task 1.2: Add shared domain types, validation schemas, and error envelope in `packages/domain` and `packages/validation`.
- [x] Foundation migration: add pnpm workspace, Turborepo task graph, web package, functions package, and shared TypeScript config.
- [x] Foundation slice: add pure submission, assessment, and sync domain rules with tests; external credentials are not required for this slice.
- [x] Task 1.3: Configure Firebase Auth client flow for Google and email/password; provider verification remains credential-gated.
- [x] Task 1.4: Implement onboarding with permanent `student`/`teacher` role.
- [x] Task 1.5: Implement reusable explicit role-aware API guard; endpoint integration tests remain.
- [x] Task 1.6: Define Firestore collections, indexes, security rules, and emulator configuration; executable emulator verification remains runtime-gated.
- [x] Checkpoint 1: Both roles can register/login, restore sessions, logout, and cannot cross role boundaries. Email/password cloud E2E and Firestore rules evidence recorded below; Google popup consent remains an external provider gate.

### Phase 2: Classroom, Student & Teacher Core

- [x] Task 2.1: Classroom create/list/update/archive endpoints with teacher ownership enforcement.
- [x] Task 2.2: Hashed join key and student join endpoint with transactional uniqueness, regeneration/revocation, and durable rate limiting.
- [x] Domain prework for Task 2.2: normalize/validate 8-character keys and enforce active, non-revoked, non-duplicate join rules.
- [x] Task 2.3: Membership management and multi-class student switcher.
- [x] Task 2.3a: Teacher member listing/removal with classroom ownership enforcement.
- [x] Task 2.4: Replace remaining dashboard mock data with durable student/teacher queries; dashboard pages now use durable queries or explicit unavailable states rather than mock production metrics.
- [x] Task 2.4a: Replace the student quiz's static question array with a Firestore-backed published question bank and protected answer API.
- [x] Task 2.4b: Move vocabulary, listening, and pronunciation practice content to the published Firestore question bank; vocabulary/listening use the protected answer API, while pronunciation uses a protected metadata-only practice-attempt API with `score: null` and explicit provider-unavailable state.
- [x] Task 2.4c: Move speaking topic selection to the published Firestore question bank and preserve the existing real recording/provider failure states.
- [x] Task 2.4d: Move conversation and pedagogical test content to the published Firestore question bank; provider-dependent conversation responses fail explicitly until an AI provider is configured.
- [x] Task 2.4e: Add the protected student learning-stats endpoint and use real question attempts/user progress for progress and achievements views.
- [x] Task 2.5a: Persist quiz attempts idempotently and award XP server-side; leaderboard now reads the updated durable XP.
- [x] Task 2.5: Persist streak and achievement state with transparent UTC-day rules, server-side counters, and idempotent achievement unlock writes.
- [x] Checkpoint 2: Teacher creates a class; student joins once; both dashboards reflect the same membership.

Phase 2 browser evidence (2026-09-22): teacher created `Phase 2 E2E English` and received join key `YARAH84M`; invalid key `WRONG123` returned `Classroom was not found`; student joined successfully and saw the active classroom; teacher member view returned `1 siswa` for `phase1-student-20260922@example.com`. Network verification confirmed `GET /api/classrooms` and `GET /api/classrooms/{id}/members` returned `200`.

### Phase 3: Assignment + Google Drive

Local implementation is complete. Real provider verification and authenticated browser evidence remain open.

- [x] Task 3.1: Secure Drive OAuth state/PKCE and encrypted server-only token storage; missing OAuth credentials return an explicit configuration gate.
- [x] Task 3.2: Drive upload adapter using `drive.file`, MIME/size/name validation, refresh-token flow, and teacher/classroom ownership checks.
- [x] Task 3.3: Assignment create/publish/draft and class scoping with Drive attachment metadata.
- [x] Task 3.4: Submission attempt/state machine, late derivation, server-side attempt enforcement, refresh-safe submission lookup, and Drive submission metadata.
- [x] Task 3.5: Teacher review approve/return and returned-to-resubmit constraints with functional assignment/submission UI.
- [x] Task 3.6: Drive connection status/reconnect/disconnect and automatic `TuturAI/class/assignment/submission/student` folder hierarchy.
- [ ] Checkpoint 3: Teacher publish → student submit → teacher review → approve/return works with real Drive metadata. Credentials are present; provider consent/upload and authenticated E2E evidence remain.

Verification evidence for the local slice: web emulator suite 27 tests passed, domain suite 29 tests passed, web typecheck passed, lint passed with 7 existing warnings and 0 errors, and the production build passed with 50 routes.

### Phase 4: AI Assessment, Adaptive Learning & Teacher Voice

- [x] Task 4.1: AI adapter contract, timeout/retry/cancellation, normalized assessment schema.
- [x] Task 4.2: Whisper Large V3 end-to-end STT: emulator-backed Playwright multipart upload reached the configured provider and returned transcript `you`; retryable provider errors remain explicit.
- [x] Task 4.3: Assessment processing and persistence for five dimensions plus confidence/error metadata; real provider response and Firestore persistence were confirmed through the protected route.
- [x] Task 4.4: Adaptive recommendation engine using persisted assessment history; recommendations now prioritize the weakest confirmed assessment dimension through the protected adaptive API.
- [ ] Task 4.5: Teacher voice enrollment, consent, deletion, isolation, and status lifecycle.
- [ ] Task 4.6: OmniVoice/self-hosted TTS adapter and class-scoped playback.
- [x] Checkpoint 4: A real configured speaking upload returned provider-confirmed normalized output and persisted it; provider failure remains a retryable error without a fabricated score.

#### Task 4.1 execution slice: Provider-safe assessment adapter

- Define a server-only HTTP assessment provider contract with explicit audio input and `AbortSignal` support.
- Reuse the shared normalized assessment validation; reject malformed, incomplete, out-of-range, or non-JSON provider output.
- Retry only timeout/network/5xx failures with bounded exponential backoff; never retry client validation failures.
- Return typed retryable/non-retryable errors and never manufacture assessment scores when the provider is unavailable.
- Verification: focused adapter tests for success, malformed output, timeout retry, 4xx no-retry, 5xx retry, abort, and missing provider configuration.

#### Task 4.4 execution slice: deterministic recommendation prework

- [x] Add a pure recommendation function that selects the weakest speaking dimension.
- [x] Keep difficulty changes bounded and transparent from recent overall performance.
- [x] Add tests for no-history baseline, weakness targeting, and difficulty boundaries.
- [x] Persist assessment history and expose recommendations through a protected API.

#### Production breadth-first increment: adaptive learning menu

- [x] Replace the static adaptive path with a protected `/api/student/adaptive` route.
- [x] Build recommendations from published Firestore question-bank content and the student's durable question attempts.
- [x] Show loading, error, empty, completed, recommended, and available states without fabricated progress.
- [x] Link each recommendation to its corresponding practice route.
- [x] Verification: focused tests, web typecheck, production build, lint, and Next.js runtime diagnostics passed; authenticated student browser proof remains open.

#### Production breadth-first increment: pronunciation safety boundary

- [x] Replace pronunciation's fabricated `selectedOption: 0` answer submission with `POST /api/student/practice-attempts`.
- [x] Persist only the practice metadata and `provider_unavailable` status; never create a pronunciation score or XP award without a configured provider result.
- [x] Verification: 4 focused tests passed, web typecheck passed, production build passed with `/api/student/practice-attempts`, and Next.js diagnostics reported no errors. Full emulator suite remains affected by the existing Firestore rules initialization timeout.

#### Production breadth-first increment: student dashboard insights

- [x] Extend `/api/student/dashboard` with durable question-attempt insights, user streak, and leaderboard rank.
- [x] Replace dashboard placeholder activity and weekly-target panels with server-derived data and explicit empty/loading states.
- [x] Verification: 5 focused tests passed, changed-file lint passed, web typecheck passed, production build passed with 53 generated pages/routes, and Next.js diagnostics reported no errors. Full emulator suite reached 45 passing tests and 6 skipped before the existing Firestore rules initialization hook timed out at 10s.

#### Production breadth-first increment: student shell/profile data

- [x] Remove hardcoded student level, XP, and streak values from the shared shell and read persisted streak from the authenticated profile.
- [x] Render profile streak and leaderboard rank from the protected dashboard response instead of placeholder dashes.
- [x] Verification: all 16 web test files/51 tests passed under the Firestore emulator, web typecheck passed, lint passed with 0 errors and 5 existing warnings, production build passed, and Next.js diagnostics reported no errors.

#### Production breadth-first increment: vocabulary mastery persistence

- [x] Read vocabulary cards from the protected Firestore question-bank API and restore mastered IDs from correct `questionAttempts`.
- [x] Confirm mastery only after the protected answer response succeeds; show a retryable error instead of claiming local success.
- [x] Verification: 2 mastery unit tests passed, non-rules web suite passed with 16 files/47 tests, typecheck passed, lint passed with 0 errors and 5 existing warnings, production build passed, and Next.js diagnostics reported no errors. The existing Firestore rules initialization timeout remains separately tracked.

#### Production breadth-first increment: listening answer durability

- [x] Restore server-backed mastery state on listening questions and show it in the question list.
- [x] Use stable per-question idempotency keys across retries so partial network failures cannot create duplicate attempts or XP.
- [x] Expose saving/error states and keep the completion result hidden until every answer is confirmed by the protected API.
- [x] Verification: non-rules web suite passed with 16 files/47 tests, typecheck passed, lint passed with 0 errors and 5 existing warnings, production build passed, and Next.js diagnostics reported no errors.

#### Production breadth-first increment: question-bank breadth and Google session handoff

- [x] Add `apps/web/scripts/expand-question-bank.mjs` with deterministic create-only IDs and substantial content for all seven learning-menu types.
- [x] Run the expansion against Firestore: 30 question, 12 vocabulary, 8 listening, 8 pronunciation, 6 speaking, 6 conversation, and 4 test items became 50 each; 276 documents were added.
- [x] Pass the returned Firebase Google popup user directly to the server-session exchange to avoid relying on `auth.currentUser` propagation timing.
- [x] Verification: focused question/practice tests passed (4 tests), web typecheck passed, lint passed with 5 existing warnings and 0 errors, production build passed with 53 routes, and Next.js MCP reported no errors.
- [ ] Real Google account popup completion, callback, session cookie, and role/dashboard redirect remain pending external browser/provider verification.

#### Production breadth-first increment: teacher analytics data boundary

- [x] Add protected `GET /api/teacher/analytics` with teacher-owned classroom and active-membership scoping.
- [x] Aggregate durable question attempts by accuracy, skill, trend, classroom, and student count; include only valid persisted speaking scores.
- [x] Replace the analytics placeholder with real KPI, trend, skill, classroom, loading, error, empty, and unavailable-speaking states.
- [x] Verification: analytics unit/API tests passed (4 tests), full non-rules suite passed (18 files/51 tests), typecheck passed after route generation, lint passed with 0 errors and 5 existing warnings, and production build includes `/api/teacher/analytics`.
- [x] Teacher analytics browser verification is covered by emulator-backed Playwright, including populated metrics, period filtering, PDF response, and outsider `403`; broader teacher-menu breadth checkpoint remains open.

#### Production breadth-first increment: teacher leaderboard data boundary

- [x] Add protected `GET /api/teacher/leaderboard` with teacher-owned classroom and active-membership scoping.
- [x] Rank students by durable XP and show persisted speaking averages only when valid assessment records exist.
- [x] Replace the alphabetical/N/A leaderboard placeholder with real rank, XP, classroom filter, speaking score, loading, error, and empty states.
- [x] Verification: focused unit/API tests passed (3 tests), typecheck passed after route generation, lint passed with 0 errors and 5 existing warnings, production build includes `/api/teacher/leaderboard`, Next.js MCP reported no errors, and Playwright confirmed the route/API load with HTTP 200 and no console errors.
- [x] Teacher leaderboard route/API browser load is verified with HTTP `200`; broader teacher-menu breadth checkpoint remains open.
- Latest official emulator-backed suite after this slice: 21 test files and 60 tests passed, including Firestore rules, teacher analytics, and teacher leaderboard API coverage.

### Phase 5: Offline-First & Sync

- [x] Task 5.1: IndexedDB stores with schema versioning for drafts, cache, audio queue, and pending mutations.
- [x] Task 5.2: Service worker/app shell cache with explicit offline status.
- [x] Task 5.3: Idempotent sync queue with retry/backoff, conflict handling, and server-confirmed state.
- [x] Task 5.4: Audio quota monitoring, cleanup, and retention rules.
- [x] Checkpoint 5 verification: assignment and conversation mutations enqueue with stable idempotency keys, replay on reconnect, retry transient failures, quarantine permanent conflicts, and clean audio FIFO storage above the 25 MB quota; offline browser replay confirmed exactly one durable conversation record.

### Phase 6: Analytics & PDF Reporting

- [x] Task 6.1: Shared analytics aggregation source for class/student views.
- [x] Task 6.2: Trend, distribution, common error, attention, and period filtering.
- [x] Task 6.3: Student/class PDF report generation and download.
- [x] Checkpoint 6 local verification: teacher analytics supports `7d`, `30d`, and `all` periods, exposes trend/skill/common-error/attention data, and `/api/teacher/reports` applies teacher classroom/student scoping before generating a real PDF response. Focused analytics/report tests (8 tests), changed-file lint, and root typecheck pass. Authenticated browser download and Firestore emulator permission execution remain release verification items.

### Phase 7: Hardware & Device Plane

- [ ] Task 7.1: Device registry/pairing and per-device credential model.
- [ ] Task 7.2: ESP-IDF/FreeRTOS local audio/VAD/queue baseline.
- [ ] Task 7.3: MQTT over TLS topic ACL and HTTPS artifact upload.
- [ ] Task 7.4: Device telemetry, safe command validation, dashboard status, and offline reconnect.
- [ ] Checkpoint 7: Paired hardware remains safe offline and synchronizes authorized data only.

Runtime gate evidence (2026-09-24): real Whisper returned transcript `you`, the v1 OpenAI-compatible chat route returned normalized JSON, and emulator-backed Playwright multipart upload confirmed the protected speaking route plus Firestore assessment persistence. Firebase email/password signup is cloud-confirmed (`accounts:signUp` 200), with onboarding `201`, session `200`, student/teacher role dashboard redirects, logout, wrong-role API `403`, and authenticated session restoration verified in the browser.

#### Phase 1 verification evidence (2026-09-22)

- Student email registration/onboarding/session: Firebase `200`, `/api/auth/onboarding` `201`, `/api/auth/session` `200`, redirect `/siswa`.
- Teacher email registration/onboarding/session: Firebase `200`, `/api/auth/onboarding` `201`, `/api/auth/session` `200`, redirect `/guru`.
- Session restore: reload/navigation after login remains authorized using server-side Firebase session cookie verification.
- Unauthorized path: logout followed by `/siswa` redirects to `/auth/login`.
- Wrong-role routes: student `/guru` redirects to `/siswa`; teacher `/siswa` redirects to `/guru`.
- Wrong-role API: teacher `GET /api/student/dashboard` returns `403 FORBIDDEN`.
- Firestore rules: web emulator suite passes 37 tests, including outsider reads, PII isolation, role escalation, classroom owner/join-key tampering, and server-only membership writes.
- Security hardening: session bridge exchanges the Firebase ID token for an HTTP-only Firebase session cookie; raw ID tokens are no longer stored as the application session cookie.

### QA, Security & Release

- [x] Task Q.1: Unit tests for role, join key, attempts, state machines, score normalization, and sync reducer.
- [x] Task Q.2: Integration/API coverage exists for Firebase guards/rules, Drive validation boundary, AI adapters and configured assessment upload, reports/PDF, and device endpoints; real Drive/OmniVoice/hardware provider execution remains gated.
- [ ] Task Q.3: Core student/teacher E2E happy and failure paths pass, but the full breadth checkpoint still lacks verified Google Drive, pronunciation-provider, Google popup, and hardware paths.
- [ ] Task Q.4: Firestore rules and high/critical dependency gates pass; public production accessibility smoke now passes, but manual responsive/accessibility review, GitHub secret scanner availability, and broader security review remain open.
- [ ] Task Q.5: Netlify deploy/release/rollback verification.
- [ ] Final checkpoint: All enabled P0 acceptance criteria pass; no dead interaction, placeholder success, fake data, or cross-tenant access.

#### Continuation checkpoint (2026-09-23)

- Device registry implementation prework is now present: teacher-scoped registration/listing, one-time secret issuance, hashed credential storage, revocation boundary, classroom ownership check, authenticated heartbeat, bounded telemetry validation, and client-denied `devices` Firestore rules.
- Voice profile implementation prework is now present: server-only OmniVoice HTTP adapter, malformed/timeout/unavailable handling, consentful teacher enrollment, provider-confirmed deletion, teacher-isolated metadata, teacher-only synthesis preview, and settings UI. Real OmniVoice confirmation remains a credential/provider gate.
- Hardware dashboard no longer renders hardcoded online/battery values or fake `setTimeout` sync; it reads the teacher device API and shows unavailable/empty states.
- E2E fixture seeds were corrected from obsolete `profiles`/`memberships` collections to the current `users`/`classMemberships` schema. Full browser execution still requires a running app plus Auth/Firestore emulators.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Active repository is only in temp clone, not project workspace | High | Confirm/copy canonical source before implementation; do not patch temp audit clone as final deliverable. |
| Existing Supabase/demo fallback masks backend failures | High | Remove production fallback; add explicit auth/error states and Firebase integration tests. |
| Large UI surface depends on mock data | High | Replace by vertical feature slices, beginning with auth and class membership. |
| External credentials unavailable | High | Continue all local/provider-independent slices; stop only the specific integration at its credential gate and use labeled test mocks only in test environment. |
| Google Drive and AI workflows are asynchronous | High | Persist explicit states, idempotency keys, retryable failures, and cancellation. |
| Firestore cross-class access risk | High | Server authorization plus emulator security-rule tests for wrong user/role/class. |

## Open Questions / Gates

- Canonical source path is confirmed as `source/TuturAI`; no further source-path decision is pending.
- Firebase email/password cloud auth and role boundary verification are complete. Google popup login still needs a real Google account/consent browser run before being reported as externally verified.
- Google Drive OAuth client credentials are required only for the Drive integration slice. The configured AI v1 credentials are available; local OmniVoice/TTS remains intentionally unconfigured until it is built.
- Netlify site/account access is required before deployment verification.
