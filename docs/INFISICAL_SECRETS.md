# Infisical Secrets Runbook

Migration from on-disk `.env` files to centrally managed secrets in Infisical for
the TuturAI monorepo: Next.js 16 web app in `apps/web`, Netlify Functions in
`apps/functions`, pnpm workspaces driven by Turborepo.

No application code changes are required for this migration. The app reads
`process.env` through `apps/web/lib/config/env.ts` (and `process.env` directly in
`apps/web/scripts/*.mjs`), so wherever the variables come from, the runtime is
unchanged. `infisical run` injects them into the spawned process.

## Where variables come from today

| Context | Current source |
| --- | --- |
| Local development (`pnpm dev` -> `turbo run dev` -> `next dev`) | `apps/web/.env.local`, loaded automatically by Next.js. Never committed. |
| Root seed / script tasks (`pnpm --filter @tuturai/web seed:*`, `e2e:*`) | `apps/web/scripts/*.mjs` parse `apps/web/.env.local` themselves in `loadLocalEnv()`, filling only variables that are **not** already set in `process.env`. |
| Production (Netlify) | Netlify site environment variables, entered in the Netlify UI/CLI. `netlify.toml` carries only public runtime metadata plus `SECRETS_SCAN_OMIT_KEYS`. |
| CI (`.github/workflows/ci.yml`) | Non-secret build values declared inline in the workflow step. |

Because `loadLocalEnv()` skips variables that are already present, values injected
by `infisical run` always win over `apps/web/.env.local`.

## Environment variable inventory (names only)

Names are taken from `apps/web/.env.example` and the validation in
`apps/web/lib/config/env.ts`. Values are never recorded in this repository.

**Browser-visible (`NEXT_PUBLIC_*`, inlined at build time - not secrets):**

`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_FIREBASE_API_KEY`,
`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
`NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`,
`NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST`

**Server-only credentials (required in production):**

`FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
`FIREBASE_ADMIN_PRIVATE_KEY`, `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`,
`GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY`, `AI_LOCAL_BASE_URL`, `AI_LOCAL_API_KEY`,
`AI_V1_BASE_URL`, `AI_V1_API_KEY`

**AI provider routing and non-secret configuration:**

`AI_STT_ROUTE`, `AI_TTS_ROUTE`, `AI_LLM_ROUTE`, `AI_PRONUNCIATION_ROUTE`,
`AI_STT_MODEL_ID`, `AI_TTS_MODEL_ID`, `AI_LLM_MODEL_ID`,
`AI_PRONUNCIATION_MODEL_ID`, `AI_PRONUNCIATION_PATH`, `AI_PRONUNCIATION_TIMEOUT_MS`,
`AI_TTS_ENROLLMENT_PATH`, `AI_TTS_STATUS_PATH`, `AI_TTS_SYNTHESIS_PATH`,
`AI_TTS_DELETE_PATH`

**Emulator-only, local development:**

`FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_PROJECT_ID`

**Platform-injected:** `NODE_ENV`, `NETLIFY` (`apps/web/app/api/health/route.ts`).

## Delivery method by target

| Target | Method |
| --- | --- |
| Local development | Infisical CLI + `.infisical.json` project link, `infisical run --env=dev -- <command>` |
| CI (GitHub Actions) | Machine identity with Universal Auth; client ID/secret in GitHub Actions secrets |
| Production (Netlify) | Netlify environment variables remain the delivery store; a machine identity is only needed if the build must pull values from Infisical at build time |

## Local development migration

1. Sign up at <https://app.infisical.com>, then `Secrets Management` -> `+ Add New
   Project` and name it after the service (for example `tuturai`). Every project
   starts with `Development`, `Staging`, and `Production` environments.
2. On the Secrets Overview page, drag and drop a copy of `apps/web/.env.local`
   onto the page (or use `Paste Secrets`), review the discovered keys, select the
   target environments, and upload. This imports every key/value pair at once.
3. Install the CLI for this machine:
   - Windows: `winget install infisical` (or
     `scoop bucket add org https://github.com/Infisical/scoop-infisical.git; scoop install infisical`)
   - macOS: `brew install infisical/get-cli/infisical`
   - Anywhere with Node.js: `npm install -g @infisical/cli`
4. Authenticate: `pnpm secrets:login` (`infisical login`). In WSL 2, Codespaces,
   or a remote SSH session with no browser, use `pnpm secrets:login:headless`
   (`infisical login -i`) instead.
5. Link this repository: run `pnpm secrets:init` (`infisical init`) **from the
   repository root** and pick the project. This writes `./.infisical.json`, which
   holds local project settings only, contains no secret values, and is safe to
   commit.
6. Run the app through the CLI: `pnpm dev:secrets`
   (`infisical run --env=dev -- turbo run dev`). Any other command can be wrapped
   the same way: `pnpm secrets:run -- node apps/web/scripts/seed-question-bank.mjs`.
7. To make the delivery change permanent for the team, point the existing entries
   at the wrapped command once the CLI, login, and `.infisical.json` are in place:
   `"dev": "infisical run --env=dev -- turbo run dev"` in the root `package.json`.
   This is deliberately not the default yet, because `pnpm dev` would fail on any
   checkout where the CLI is not installed.

## Non-local targets

Do not use interactive login outside local development.

1. Create a machine identity in the Infisical project and attach Universal Auth.
   See <https://infisical.com/docs/documentation/platform/identities/machine-identities>
   and <https://infisical.com/docs/documentation/platform/identities/universal-auth>.
2. Scope the identity to the minimum project/environment it needs (`prod` only
   for production, `staging` only for staging).
3. Store the client ID and client secret in that platform's own secret store:
   Netlify UI environment variables for the Netlify build, or GitHub Actions
   secrets (`secrets.INFISICAL_CLIENT_ID` / `secrets.INFISICAL_CLIENT_SECRET`) for
   `.github/workflows/ci.yml`.
4. Never commit the client secret, and never echo it in build logs.

## Verification

1. Start through the wrapper: `pnpm dev:secrets`. Confirm one known variable
   resolves, for example by logging its length rather than its value.
2. Rename the local file: `Rename-Item apps/web/.env.local apps/web/.env.local.backup`
   (PowerShell) / `mv apps/web/.env.local apps/web/.env.local.backup`.
3. Restart through `pnpm dev:secrets` and confirm the app still starts and the
   same variable still resolves. That is the proof that values come from
   Infisical and not from disk.
4. Restore the backup only if the check fails.

## Leak scanning and cleanup

- `apps/web/.env.local` has never been committed in this repository's history (only
  `apps/web/.env.example` is tracked), so there are no recorded values to rotate
  for that file. Rotate any credential that was ever committed anywhere else -
  git history keeps it.
- Scan for leaked secrets with `pnpm secrets:scan` (`infisical scan .`). See
  <https://infisical.com/docs/cli/scanning-overview>.
- Keep `.env` and its variants out of commits. The root `.gitignore` already
  ignores `.env`, `.env.*`, and `!*.example`, which covers `.env.local`,
  `.env.backup`, and `.env.local.backup`.
- Never commit, echo, or paste real secret values into a file, a doc, or chat.
