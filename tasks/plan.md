# Implementation Plan: TuturAI PRD v0.1

## Overview

Membawa codebase TuturAI existing ke target PRD secara incremental, dengan mempertahankan route/UI yang sudah ada tetapi mengganti Supabase/demo/mock behavior dengan Firebase, secure Netlify Functions, Google Drive, configurable AI adapters, dan offline-first persistence. Implementasi harus dimulai dari Phase 1 dan hanya melanjutkan phase setelah acceptance criteria serta verification phase sebelumnya lulus.

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
- [ ] Checkpoint 1: Both roles can register/login, restore sessions, logout, and cannot cross role boundaries. Blocked on Firebase credentials and rules/API guard tests.

### Phase 2: Classroom, Student & Teacher Core

- [x] Task 2.1: Classroom create/list/update/archive endpoints with teacher ownership enforcement.
- [x] Task 2.2: Hashed join key and student join endpoint with transactional uniqueness, regeneration/revocation, and durable rate limiting.
- [x] Domain prework for Task 2.2: normalize/validate 8-character keys and enforce active, non-revoked, non-duplicate join rules.
- [x] Task 2.3: Membership management and multi-class student switcher.
- [x] Task 2.3a: Teacher member listing/removal with classroom ownership enforcement.
- [x] Task 2.4: Replace remaining dashboard mock data with durable student/teacher queries; dashboard pages now use durable queries or explicit unavailable states rather than mock production metrics.
- [x] Task 2.4a: Replace the student quiz's static question array with a Firestore-backed published question bank and protected answer API.
- [x] Task 2.4b: Move vocabulary, listening, and pronunciation practice content to the published Firestore question bank; persist practice attempts through the protected answer API and show explicit provider-unavailable state instead of fabricated pronunciation scores.
- [x] Task 2.4c: Move speaking topic selection to the published Firestore question bank and preserve the existing real recording/provider failure states.
- [x] Task 2.4d: Move conversation and pedagogical test content to the published Firestore question bank; provider-dependent conversation responses fail explicitly until an AI provider is configured.
- [x] Task 2.4e: Add the protected student learning-stats endpoint and use real question attempts/user progress for progress and achievements views.
- [x] Task 2.5a: Persist quiz attempts idempotently and award XP server-side; leaderboard now reads the updated durable XP.
- [x] Task 2.5: Persist streak and achievement state with transparent UTC-day rules, server-side counters, and idempotent achievement unlock writes.
- [ ] Checkpoint 2: Teacher creates a class; student joins once; both dashboards reflect the same membership.

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
- [ ] Task 4.2: Whisper Large V3 STT integration through configured provider.
- [ ] Task 4.3: Assessment processing and persistence for five dimensions plus confidence/error metadata.
- [ ] Task 4.4: Adaptive recommendation engine using persisted assessment history.
- [ ] Task 4.5: Teacher voice enrollment, consent, deletion, isolation, and status lifecycle.
- [ ] Task 4.6: OmniVoice/self-hosted TTS adapter and class-scoped playback.
- [ ] Checkpoint 4: A real speaking session returns provider-confirmed normalized output; provider failure never creates a score.

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
- [ ] Persist assessment history and expose recommendations through a protected API.

### Phase 5: Offline-First & Sync

- [ ] Task 5.1: IndexedDB stores with schema versioning for drafts, cache, audio queue, and pending mutations.
- [ ] Task 5.2: Service worker/app shell cache with explicit offline status.
- [ ] Task 5.3: Idempotent sync queue with retry/backoff, conflict handling, and server-confirmed state.
- [ ] Task 5.4: Audio quota monitoring, cleanup, and retention rules.
- [ ] Checkpoint 5: Offline draft/audio survives refresh and reconnect does not duplicate server mutations.

### Phase 6: Analytics & PDF Reporting

- [ ] Task 6.1: Shared analytics aggregation source for class/student views.
- [ ] Task 6.2: Trend, distribution, common error, attention, and period filtering.
- [ ] Task 6.3: Student/class PDF report generation and download.
- [ ] Checkpoint 6: Dashboard and PDF use the same permission-filtered source data.

### Phase 7: Hardware & Device Plane

- [ ] Task 7.1: Device registry/pairing and per-device credential model.
- [ ] Task 7.2: ESP-IDF/FreeRTOS local audio/VAD/queue baseline.
- [ ] Task 7.3: MQTT over TLS topic ACL and HTTPS artifact upload.
- [ ] Task 7.4: Device telemetry, safe command validation, dashboard status, and offline reconnect.
- [ ] Checkpoint 7: Paired hardware remains safe offline and synchronizes authorized data only.

### QA, Security & Release

- [x] Task Q.1: Unit tests for role, join key, attempts, state machines, score normalization, and sync reducer.
- [ ] Task Q.2: Integration tests for Firebase, Drive, AI adapter, reports, and device endpoints.
- [ ] Task Q.3: E2E teacher/student happy paths plus required failure paths.
- [ ] Task Q.4: Security review, rules tests, dependency scan, secret exposure scan, and accessibility/responsive smoke test.
- [ ] Task Q.5: Netlify deploy/release/rollback verification.
- [ ] Final checkpoint: All enabled P0 acceptance criteria pass; no dead interaction, placeholder success, fake data, or cross-tenant access.

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
- Firebase cloud auth verification requires an authorized Firebase CLI/project session; local Firebase/Firestore implementation and emulator rules verification are already available.
- Google Drive OAuth client credentials are required only for the Drive integration slice. The configured AI v1 credentials are available; local OmniVoice/TTS remains intentionally unconfigured until it is built.
- Netlify site/account access is required before deployment verification.
