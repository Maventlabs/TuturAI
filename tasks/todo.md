# TuturAI Task Checklist

## Current Status

- Phase 2.5 complete. Phase 3 implementation is complete locally; authenticated E2E and real Google consent/upload verification remain open.
- Repository hygiene files (`MUST.md`, expanded `.gitignore`, and shield-based `README.md`) are prepared locally; the first GitHub MCP commit is blocked by a `403 Resource not accessible by personal access token` from `vetrns/TuturAI-Final`.

- [x] Read `PRD.md` and `AGENTS.md`.
- [x] Audit public landing/auth routes with Firecrawl and browser automation.
- [x] Confirmed existing auth/data implementation uses Supabase, demo cookie fallback, and mock data.
- [x] Confirmed placeholder device API routes; removed simulated success responses and replaced them with explicit authenticated `501` responses.
- [x] Confirmed canonical source is available in the project workspace at `source/TuturAI`.
- [x] Wrote `tasks/plan.md` with dependency-ordered implementation slices.
- [x] Confirm canonical source workspace before code implementation: `source/TuturAI` on `main` at `70dd524`.
- [x] Complete feature parity matrix in `tasks/feature-parity-matrix.md`.
- [ ] Complete Phase 1 implementation; Firebase Auth/session/onboarding, reusable role guard, and local Firestore scaffolding are implemented, cloud auth verification remains.
- [ ] Complete Phase 1 verification; local rules and guard tests pass, external auth and endpoint integration remain.
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

## Phase 0: Source Alignment

- [x] Decide canonical source path / bring source into workspace.
- [x] Add reproducible scripts and env documentation.
- [x] Create route-to-PRD feature parity matrix.

## Phase 1: Foundation, Auth & Data Model

- [x] Environment schema and secret boundary (`source/TuturAI/apps/web/lib/config/env.ts`, `.env.example`).
- [x] Shared domain types and validation/error envelope (`packages/domain`, `packages/validation`).
- [x] Pure submission transition, assessment normalization, and idempotent sync queue logic with unit tests.
- [x] Pure classroom join-key validation and ownership/membership guards with unit tests.
- [x] Firebase Auth Google + email/password client flow implemented; real provider verification remains.
- [x] Permanent onboarding role endpoint implemented with immutable role conflict protection.
- [x] Firebase ID token verification and reusable role-aware API guard; endpoint integration tests remain.
- [x] Add Firestore schema audit, indexes file, security rules, and emulator configuration.

### Current execution slice

- [x] Replace Supabase/demo auth client with Firebase Auth.
- [x] Add HTTP-only session bridge and server-side profile lookup.
- [x] Add role onboarding endpoint with immutable role write.
- [x] Add protected route/API guard integration tests.
- [x] Add Firestore rules/indexes/emulator scaffolding.
- [x] Add executable Firestore rules tests with the verified Java 25 runtime.

## Verification Requirements

- [x] Typecheck/lint (lint passes with 6 pre-existing React Compiler/UI warnings).
- [x] Unit tests for changed validation logic.
- [x] Integration tests for reusable protected API guards; endpoint and rules integration remain.
- [ ] E2E auth happy path for student and teacher.
- [ ] Unauthorized/wrong-role/wrong-class failure paths.
- [ ] No simulated success or dead interaction; device routes now fail closed, remaining mock UI is tracked for later vertical slices.
- [x] Phase 2 classroom slice: teacher create/list and student join/list endpoints with hashed join keys.
- [x] Phase 2 classroom lifecycle: teacher update/archive, join-key regeneration/revocation, durable join-attempt rate limiting, and transactional key reservations.
- [x] Phase 2 membership management: teacher member listing/removal with classroom ownership enforcement.
- [x] Phase 2 multi-class switcher: student dashboard lists memberships and allows selecting the active classroom.
- [x] Phase 2 classroom UI: teacher create, lifecycle, join-key, and member management actions use real API states; student join panel uses real API states.
- [x] Normalize classroom and membership timestamps to Firestore `Timestamp` values; API responses expose ISO strings.
- [x] Phase 3 assignment domain validation and draft/publish/archive rules.
- [x] Phase 3 Firestore assignment create/list API with teacher ownership and student membership enforcement.
- [x] Phase 3 submission turn-in/review APIs with late derivation, max-attempt enforcement, approve terminal state, and returned resubmit.
- [x] Phase 3 assignment/student pages use real assignment and submission API states.
- [x] Phase 3 teacher review queue uses teacher-scoped Firestore data and real approve/return actions.
- [x] Phase 4.1 AI adapter contract and failure-safe assessment processing.
- [ ] Phase 4.4 adaptive recommendation persistence/API.
- [x] Phase 3 Firestore security rules deny client writes and scope assignment/submission reads by role/class.
- [x] Question bank server contract, answer validation, server-side scoring, and idempotency tests.

## Latest Verification

- [x] Direct TypeScript compiler: passed after Firestore timestamp and guard-test changes.
- [x] Vitest full local suite: 23 tests passed, including 3 protected API guard tests.
- [x] `git diff --check`: passed for the canonical source repository.
- [x] Root Turborepo typecheck: passed.
- [x] Root Turborepo build: passed; Next.js generated 38 routes.
- [x] Root Turborepo tests: passed (17 domain + 4 validation + 1 functions health + 3 API guard + 6 Firestore rules tests).
- [x] Repository lint: passed with 6 warnings from existing UI code.
- [x] Local Firebase/Firestore verification: emulator-backed rules tests pass under Java 25.
- [x] Assignment domain tests: 21 domain tests passed.
- [x] Assignment build verification: root build passed and generated assignment/submission routes.
- [x] Submission refresh verification: student submission lookup restores server state after reload.
- [x] Final slice verification: root typecheck and build passed; web lint passed with 8 existing/React Compiler warnings and 0 errors.
- [x] Review queue verification: full web emulator suite passed with 11 tests; build includes `/api/submissions/review-queue`.
- [x] Phase 4.1 verification: provider adapter tests cover timeout/retry/cancellation/malformed output without fabricated scores.
- [x] Adaptive recommendation prework: 3 domain tests pass with bounded difficulty and transparent focus reason.
- [x] Student dashboard now reads name, level, and XP from `GET /api/me`; unavailable rank/streak remain explicitly `—`.
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

## Blockers

- GitHub MCP identifies as `vetrns`, but the current token cannot write repository contents; the empty `vetrns/TuturAI-Final` repository needs a token/session with repository `Contents: write` permission before the MCP commit can be created.
- Next.js MCP server currently detected belongs to unrelated `Mavent/anymd`; no TuturAI dev server is running.
- Cloud Firestore discovery was initially blocked, then verified after Firebase CLI login/project selection; the existing Firestore project/database was retained.
- Google Drive OAuth values are present locally; real consent/callback/upload verification remains an external provider gate. Self-hosted TTS model is still unavailable.
- Firebase project configuration and Admin credentials are present in local environment; real cloud auth verification still needs an authorized Firebase CLI/project session.
- The Firestore project/database is an existing project decision and was verified through the authenticated Firebase CLI; do not provision or replace it. Local emulator verification uses the verified JDK 25 path and `pnpm dlx firebase-tools@latest`.
- Firebase Google login does not require a duplicate Google OAuth client key. Drive credentials are configured, but Checkpoint 3 remains open until a real OAuth consent and upload confirms provider metadata behavior.
- Phase 3 Drive boundary, folder hierarchy, MIME/size validation, and assignment/submission metadata persistence are implemented locally.
- Phase 4 v1 provider integration is no longer credential-gated: `AI_V1_BASE_URL`, `AI_V1_API_KEY`, `AI_STT_MODEL_ID`, and `AI_LLM_MODEL_ID` are present in `.env.local`.
- Local OmniVoice/TTS remains intentionally unconfigured until the self-hosted service is built; `AI_LOCAL_BASE_URL` and `AI_TTS_MODEL_ID` must stay empty without being treated as simulated success.
- Turbopack production build currently fails while resolving remote `next/font` assets; Webpack production build passes. This is an environment/network/toolchain verification issue, not a dashboard type or route error.
