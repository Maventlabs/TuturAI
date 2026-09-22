# TuturAI

[![Repository](https://img.shields.io/badge/repository-GitHub-181717?logo=github)](https://github.com/vetrns/TuturAI-Final)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-ffca28?logo=firebase&logoColor=111)](https://firebase.google.com/docs/firestore)
[![Netlify](https://img.shields.io/badge/deploy-Netlify-00c7b7?logo=netlify&logoColor=white)](https://www.netlify.com/)

TuturAI is an adaptive English-speaking platform for students and teachers.
It combines multidimensional speaking assessment, adaptive practice, classroom
workflows, teacher analytics, Google Drive assignment files, offline recovery,
and a replaceable server-side AI provider router.

> Project status: active implementation. Read [`PRD.md`](PRD.md),
> [`MUST.md`](MUST.md), and [`tasks/todo.md`](tasks/todo.md) before making
> changes. Incomplete external integrations must report their real state rather
> than simulate success.

## Product Scope

- Student onboarding, classroom membership, practice, quizzes, speaking, and progress.
- Teacher classrooms, assignments, review queues, analytics, leaderboards, and settings.
- Firestore-backed durable domain data with server-side authorization boundaries.
- Google Drive OAuth with least-privilege `drive.file` access for teacher files.
- Normalized AI assessment contract for pronunciation, fluency, intonation,
  grammar, vocabulary, overall score, transcript, feedback, and confidence metadata.
- Offline-first drafts/queues/cache with idempotency and explicit sync states.
- Hardware roadmap for ESP-IDF/FreeRTOS devices using MQTT over TLS for lightweight commands.

## Repository Layout

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js App Router web application and protected API routes |
| `apps/functions` | Privileged Netlify Functions boundary |
| `packages/domain` | Framework-free business rules, types, and state transitions |
| `packages/validation` | Shared input validation and API error contracts |
| `packages/config` | Shared TypeScript/tooling configuration |
| `firebase` | Firestore rules, indexes, and Firebase scaffolding |
| `tasks` | Sequential implementation plan and live progress checklist |
| `docs` | Architecture, provider, and technical decision context |
| `source/TuturAI` | Preserved source archive used during migration |

## Requirements

- Node.js compatible with the installed Next.js version.
- pnpm `11.17.0`.
- Firebase project configuration for auth and Firestore development.
- Server-only credentials for Firebase Admin and Google Drive when those
  integrations are enabled.
- Optional AI provider configuration for STT, TTS, and LLM routes.

## Setup

```bash
pnpm install --frozen-lockfile
copy apps\web\.env.example apps\web\.env.local
```

Fill `apps/web/.env.local` with real values appropriate to the environment.
Never commit `.env.local`, service-account files, OAuth secrets, private keys,
or provider tokens. Public Firebase web configuration may be exposed by the
browser; Firebase Admin, Google OAuth secrets, token encryption keys, and AI
API keys must remain server-only.

## Development Commands

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

The web application is available at `http://localhost:3000` when the dev
script starts successfully. Use the Firebase emulator/test configuration for
local rule and integration tests; do not treat emulator data as production data.

## AI Provider Router

AI provider configuration is server-side and capability-specific:

```dotenv
AI_LOCAL_BASE_URL=
AI_V1_BASE_URL=
AI_V1_API_KEY=
AI_STT_ROUTE=v1
AI_TTS_ROUTE=local
AI_LLM_ROUTE=v1
AI_STT_MODEL_ID=
AI_TTS_MODEL_ID=
AI_LLM_MODEL_ID=
```

The application uses adapters rather than hardcoded provider hostnames or model
IDs. Switching between a local model and an API provider should require config
changes only. Provider timeout, malformed output, unavailable model, retryable
failure, and cancellation states must remain visible to the caller.

## Google Drive

Drive is separate from Google sign-in. The integration uses OAuth PKCE and the
least-privilege `drive.file` scope. Teacher-owned files are organized under:

```text
TuturAI/
  classroom/
    assignment/
      submission/
        student/
```

Firestore stores metadata and ownership references; raw credentials and refresh
tokens remain encrypted/server-only. Students submit through TuturAI and do not
need to connect their own Drive account.

## Testing And Verification

Every phase requires relevant unit/integration coverage, the primary Playwright
E2E flow, and at least one error or permission path. Before claiming a phase is
complete, verify:

- Typecheck and lint results.
- Unit and integration test results.
- Browser happy path and failure path.
- Unauthorized, wrong-role, wrong-class, and revoked-key behavior where relevant.
- No dead interaction, placeholder success, fabricated score, or leaked secret.

See [`MUST.md`](MUST.md) for the persistent execution contract and
[`tasks/todo.md`](tasks/todo.md) for the current phase status.

## Security Notes

- Secrets are loaded from environment/config and are never bundled into client code.
- Protected routes verify Firebase ID tokens and enforce role/class ownership.
- File uploads validate MIME type, extension, size, and sanitized names.
- Raw practice audio is temporary unless the session explicitly requires retention.
- `.gitignore` excludes local environments, credentials, build output, media,
  test artifacts, and browser audit artifacts.

## License

This repository is private project software. Licensing terms are not yet published.
