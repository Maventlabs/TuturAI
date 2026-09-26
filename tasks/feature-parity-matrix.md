# TuturAI Feature Parity Matrix

Status values: `present-ui`, `partial`, `missing`, `blocked`, `not-verifiable`.

> Historical audit baseline. Current implementation status and phase gates are
> tracked in [`../EXECUTION.md`](../EXECUTION.md); do not use the original
> pre-migration statuses below as proof that implemented Firebase/Firestore
> slices are still mock-only.

| PRD area | Existing evidence | Current status | Required replacement / verification |
|---|---|---|---|
| Google/email authentication | `apps/web/components/auth/login-form.tsx`, `sign-up-form.tsx`, Supabase client/server | `partial` | Firebase Google + email/password, session restore, logout, auth error states, E2E. |
| Permanent role | signup role input and profile role reads | `partial` | Server-only role write during onboarding; immutable Firestore/rules enforcement. |
| Route guards | `apps/web/app/siswa/layout.tsx`, `guru/layout.tsx`, `apps/web/proxy.ts` | `partial` | Firebase ID token verification and fail-closed API/server guards; wrong-role tests. |
| Classroom CRUD | `apps/web/app/guru/kelas/page.tsx`, mock `classes` | `present-ui` | Firestore class ownership, active/archive state, CRUD API, durable UI. |
| Join key | no verified backend route in inspected web app | `missing` | Hashed unique key, regenerate/revoke, rate limiting, multi-class membership. |
| Student class switcher | student shell/profile UI exists; no durable class source verified | `partial` | Membership query, switcher, class-scoped state and permissions. |
| Assignment creation | no verified assignment API; route inventory lacks assignment route | `missing` | Assignment schema/API/UI, draft/published, due date, max attempts, attachments/links. |
| Google Drive | no Drive integration found in inspected web app | `missing` | OAuth state/PKCE, encrypted refresh token, `drive.file`, folder/file metadata. |
| Submission/review | teacher review UI exists using mock students; no durable workflow verified | `partial` | State machine, attempt limits, late derivation, approve/return/resubmit, integration tests. |
| Student dashboard | `/siswa/page.tsx` and shared shell | `present-ui` | Replace `mock-data.ts` with Firestore-backed data and real loading/error/offline states. |
| Speaking practice | `/siswa/speaking`, `components/student/speaking-session.tsx` | `partial` | Real recording/upload/job lifecycle, normalized assessment, no fake score. |
| AI conversation | `/siswa/percakapan/page.tsx`, local `setTimeout` interaction | `partial` | Secure AI endpoint, context state, provider failure/cancellation handling. |
| Pronunciation practice | `/siswa/pronunciation/page.tsx` | `present-ui` | Persist practice and connect assessment/provider result. |
| Vocabulary practice | `/siswa/vocabulary/page.tsx`, mock vocabulary | `present-ui` | Durable item/mastery model and adaptive updates. |
| Listening/quiz/adaptive | `/siswa/listening`, `/quiz`, `/adaptive`, `/tes` | `present-ui` | Persist attempts/progress; define source content and error states. |
| Leaderboard/gamification | student/teacher leaderboard and mock XP/streak/achievements | `present-ui` | Transparent server-side scoring, class scope, anti-tamper tests. |
| Teacher analytics | `/guru/analitik/page.tsx` and mock charts | `present-ui` | Shared Firestore aggregation source, period filters, attention signals. |
| Teacher student detail | `/guru/siswa/page.tsx` and mock students | `present-ui` | Class ownership enforcement and durable five-dimension history. |
| Teacher voice profile | no verified voice API/menu implementation found | `missing` | One profile/teacher, consent, OmniVoice/TTS adapter, isolation/deletion lifecycle. |
| Offline-first PWA | no verified IndexedDB/service worker/sync queue in inventory | `missing` | IndexedDB stores, Cache Storage shell, idempotency, retry/backoff, quota cleanup. |
| PDF reports | no verified report route/package found | `missing` | Student/class report renderer, shared analytics source, download and permission tests. |
| Device registry/pairing | `/guru/perangkat` UI and placeholder `/api/device/*` | `partial` | Pairing, registry, per-device credentials, MQTT/HTTPS gateway, safe commands. |
| Device telemetry | placeholder status returns fixed `TTR-A1F3`, `online`, battery `87` | `partial` | Real authenticated telemetry, offline behavior, ACL and credential rotation. |
| Security | demo passwords and client fallback present; no rules/test evidence | `blocked` | Remove production demo path, add validation, rules, secret scan, rate limits, OAuth validation. |
| Test infrastructure | no test/spec files found; package only has lint/build scripts | `missing` | Add focused unit/integration/E2E runners and CI gates before claiming phase completion. |

## Existing Route Coverage

- Public/auth: `/`, `/auth/login`, `/auth/sign-up`, `/auth/error`, `/auth/sign-up-success`, `/auth/callback`.
- Student: `/siswa`, `/siswa/speaking`, `/siswa/percakapan`, `/siswa/pronunciation`, `/siswa/vocabulary`, `/siswa/listening`, `/siswa/quiz`, `/siswa/adaptive`, `/siswa/tes`, `/siswa/progress`, `/siswa/leaderboard`, `/siswa/achievements`, `/siswa/profil`.
- Teacher: `/guru`, `/guru/kelas`, `/guru/siswa`, `/guru/penilaian`, `/guru/analitik`, `/guru/leaderboard`, `/guru/perangkat`, `/guru/pengaturan`.
- Existing device placeholders: `POST /api/device/sync`, `POST /api/device/audio-upload`, `GET /api/device/status`.

## Highest-Risk Gaps

1. Production identity/data layer is Supabase plus demo fallback, not Firebase.
2. Most dashboard data comes from `apps/web/lib/mock-data.ts`.
3. Placeholder device endpoints return success without auth or persistence.
4. No verified tests or deployment configuration were found in the audit clone.
5. Source repository is outside the project workspace, so implementation target must be aligned before coding.
