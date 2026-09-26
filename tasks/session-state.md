# TuturAI Session State

> HISTORICAL / DO NOT USE FOR EXECUTION STATE
>
> Resume from [`../EXECUTION.md`](../EXECUTION.md). This file preserves prior
> session evidence and decisions only.

## Historical Resume Rule

The old resume instructions below are preserved as historical evidence. Resume from
[`../EXECUTION.md`](../EXECUTION.md), then consult this file only for prior evidence.

- Do not repeat a completed task or rerun unchanged verification.
- Rerun tests only after code changes or when a prior command failed.
- Treat checked items with dated evidence as completed.
- Continue from the first unchecked breadth-first menu item.
- Do not return to auth unless a new auth regression is demonstrated.
- Never replace a provider failure with simulated success.

## Product Direction

- Backend/domain first.
- Keep the current frontend as a thin functional shell while all menus receive real API/durable boundaries.
- Perform the total UI redesign after backend contracts and menu behavior are stable.
- Use a production breadth-first sweep, not a phase loop.

## Completed Evidence

- Phase 1 auth/session/RBAC and Firestore rules verified.
- Phase 2 classroom checkpoint verified: teacher create, invalid join-key rejection, student join, teacher member listing.
- Google existing-account signup path now creates a session without repeating onboarding.
- Firebase auth errors are mapped to actionable messages.
- Last successful verification after auth changes: typecheck passed, production build passed with 51 routes, full suite passed with 41 web tests, 29 domain tests, 4 validation tests, and 1 functions test.
- Lint passes with existing React warnings only.
- Adaptive menu now has a protected `/api/student/adaptive` route and Firestore attempt-derived UI state; focused tests, typecheck, build, lint, and Next.js diagnostics passed.
- Adaptive browser evidence now passes with a `200` recommendation response, durable completion count, and a linked activity deep link.
- Pronunciation no longer submits a fabricated quiz answer. It records a server-side practice-attempt metadata row with `score: null` and explicit `provider_unavailable` status; authenticated student browser proof remains pending.
- Student dashboard now derives rank, streak, weekly target, and recent activity from server-side leaderboard, user, and question-attempt data; focused verification passed, while authenticated student browser proof remains pending.
- Student shell/profile no longer use hardcoded level, XP, or streak values; profile stats now render server-backed streak and leaderboard rank. Verification passed with 51 web tests, typecheck, lint with existing warnings only, production build, and Next.js diagnostics.
- Configured speaking provider boundary now passes through emulator-backed Playwright multipart upload: Whisper returned `you`, normalized assessment data returned, and the Firestore assessment write was confirmed.
- Offline browser replay now passes for a conversation mutation with one durable record after reconnect; assignment lifecycle and teacher analytics/report E2E also pass.
- Learning-menu Playwright now passes Quiz, Listening, Tes Pedagogis, Conversation text, Vocabulary, and Adaptive with 40 durable question attempts plus 1 durable conversation attempt. Firebase Auth emulator session exchange is isolated behind an emulator-only verified-token bridge; production session cookies are unchanged.
- Student history Playwright now passes progress, leaderboard, achievements, and profile with durable stats and unauthenticated `401` evidence.
- Teacher core Playwright now passes dashboard, classes, assignments, students, speaking review, analytics, and leaderboard; a classroom owned by another teacher fails closed with `404`.
- Pronunciation unavailable Playwright now passes: the page loads, a protected practice attempt returns `provider_unavailable`, and `score` remains `null`.
- Final slice gates passed: typecheck, production build, `git diff --check`, and emulator-backed Vitest with 36 files/113 tests.
- Teacher integrations local E2E now passes: settings and device menus load with the teacher session; Drive status returns a typed connection state; invalid upload returns `400`; empty device state, invalid registration `400`, and missing-device removal `404` are verified. Real Drive consent/upload remains external.
- Student voice authorization E2E now passes: invalid text returns `400`, an active student reaches the explicit teacher voice `processing` gate with `409`, and a wrong-class request returns `404`; no provider audio is fabricated.
- Student conversation voice now has a class-scoped server route and UI playback action. The route enforces student membership, teacher voice-profile readiness, configured TTS settings, no-store audio responses, and explicit `404/409/503/500` failures. Focused voice/provider tests passed with 18 tests, typecheck/lint passed, and `next build` includes `/api/classrooms/[classroomId]/voice`.
- Adaptive completion now has a dedicated emulator-backed Playwright flow that follows the recommendation, completes the linked activity, confirms exactly one durable attempt, and confirms the completed activity is no longer recommended.
- Local provider configuration now supports `AI_LOCAL_API_KEY`; provider tests confirm it is sent only as a bearer header. `OfflineStatus` has a hydration-safe initial state, and the student shell no longer calls the teacher-only device endpoint.
- Teacher dashboard monitoring panels now consume authorized durable analytics for trend, skill, and common-error data instead of rendering empty placeholders.
- Public production smoke now verifies login, sign-up, and auth-error routes for `200` responses, headings, input labels, keyboard focus, and zero browser errors. The Vercel Analytics injection was removed because the Netlify-targeted server returned 404/MIME console errors for `/_vercel/insights/script.js`.
- Fresh continuation verification is green: emulator-backed web tests passed with 37 files/119 tests, web/root typecheck passed, production build passed with all application routes, lint passed with 0 errors and existing React warnings, and `git diff --check` passed. Offline assignment files and conversation audio now retain payloads for reconnect replay; browser proof for those two payload types remains pending.
- Offline payload browser proof now passes with `scripts/e2e-offline-payloads.mjs`: an offline assignment file is retained as a Blob in the pending mutation, and recorded conversation audio is retained in both `audioQueue` and the pending mutation with matching `sessionId`/idempotency key. The test is emulator-only and does not reconnect the assignment queue to Drive.
- Fixed a real conversation-audio race found by that E2E: the assessment effect no longer aborts its own fetch when `assessing` state changes, so offline audio reaches the pending-mutation queue.
- CSP now permits Firebase Auth/Firestore emulator hosts only outside production; `proxy.test.ts` covers both development and production policy modes. Fresh gates passed: `pnpm test` with 38 web files/123 tests, root typecheck, production build, and lint with 0 errors/8 existing React warnings.
- Direct production smoke on `https://tuturai-apps.netlify.app/` found a release blocker: `/`, `/auth/login`, `/auth/sign-up`, and `/auth/error` return `200` with no browser errors, but `/onboarding`, `/guru`, and `/siswa` return `500 Internal Server Error` before unauthenticated redirect. Local dev returns the expected `307 -> /auth/login` for those same protected routes. Production responses also omit the runtime `Content-Security-Policy` header even though local `proxy.ts` sets it; do not claim production readiness until the deployed runtime is diagnosed/redeployed and rechecked.
- Added a focused `proxy.test.ts` regression suite and a production-safe early redirect for anonymous page requests under `/dashboard`, `/onboarding`, `/guru`, and `/siswa`; API routes remain JSON-guarded by their existing server authorization. The focused suite passes locally. The Netlify deployment has not been changed, so production recheck remains open.
- Verification after the proxy change: `proxy.test.ts` passed (3/3), web typecheck passed, targeted ESLint passed, local dev `/siswa` returned `307` with `/auth/login`, local `/api/me` returned `401` JSON, production build passed, and the full web suite passed (38 files, 122 tests). `git diff --check` passed with only existing CRLF normalization warnings.

## External Gates

- Google Sign-In must be enabled in Firebase Console under Authentication > Sign-in method > Google.
- Google Drive real consent/upload is not verified.
- Real AI speaking-session persistence is not verified.
- OmniVoice/TTS real enrollment and playback are not verified because `AI_LOCAL_BASE_URL`, `AI_LOCAL_API_KEY`, and `AI_TTS_MODEL_ID` are absent from `.env.local`.
- Pronunciation remains intentionally score-free until a phoneme-capable provider endpoint and model contract are supplied.
- Netlify deploy/rollback is not executed from this workspace. Direct production-domain verification was executed and failed on protected-route `500` responses plus missing runtime CSP; deployment/runtime diagnosis remains open.
- Hardware firmware, MQTT broker, device CA/credentials, and telemetry endpoint are not available.
- Manual responsive/accessibility review and GitHub secret-scanner verification remain pending; automated public-route smoke is complete.
- Root Git integrity remains gated: `apps/web` and `source/TuturAI` are nested repositories recorded as gitlinks without `.gitmodules`; nested history and source changes must be backed up before deliberate flattening or push normalization.
- Do not claim these are complete without provider confirmation.

## Next Work

1. Supply the self-hosted OmniVoice-compatible HTTPS endpoint, model ID, and optional bearer key, then run real enrollment, ready-state polling, delete, teacher preview, and student class-scoped playback.
2. Complete Google Drive OAuth consent/upload with a real teacher Google account and verify persisted Drive metadata.
3. Supply a phoneme-capable pronunciation provider contract/model and verify confirmed score persistence plus completion UI.
4. Run Netlify deploy/rollback and production-domain verification, then execute the remaining accessibility and release smoke gates.
5. Supply hardware firmware/broker/device credentials before running MQTT/TLS and device reconnect verification.
