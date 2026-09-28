# Netlify Deployment Runbook

## Repository Preconditions

The canonical root repository contains `apps/web` as a normal tracked directory
(Git tree mode `040000`), not a gitlink. The current root has no `source/TuturAI`
directory or `.gitmodules`; the Netlify build base is `.` and can read the active
web app from the same repository. Do not follow older instructions to flatten a
gitlink or remove a nested `.git` directory unless the tree evidence changes.

Verify the repository boundary before changing it:

```powershell
git ls-tree HEAD apps/web source/TuturAI .gitmodules
git status --short --branch
```

The remote default branch is `main` (confirmed by
`git ls-remote --symref origin HEAD`); the current `main` tracks `origin/main`.
`netlify.toml` defines production build behavior, but the
Netlify site's production-branch selection is stored in Netlify site settings,
not this file. Changes intended for the existing production connection must be
pushed to its configured production branch; do not create an unrelated preview
branch.

## Netlify Settings

The committed `netlify.toml` defines:

- Root base directory.
- Node.js 22.
- pnpm `11.17.0` from the root `packageManager` field.
- `pnpm --filter @tuturai/web build`.
- Next.js output at `apps/web/.next`.
- Netlify Functions at `apps/functions/netlify`.
- Preview, branch, production, and local dev contexts.
- Baseline security headers.

Sensitive values must be entered in Netlify UI or CLI environment management,
never in `netlify.toml`.

Use `apps/web/netlify-env.template` as a manual entry sheet only; do not import
it as-is. The checked-in `apps/web/.env.local` is for emulator development and
uses project `demo-tuturai` with Auth/Firestore emulators at localhost. Do not
copy its Firebase Admin values or emulator hosts to production. The configured
`AI_V1_*` entries may be copied to Netlify Functions only if they are the
intended production provider credentials; those variables and v1 model IDs are
present in the local file, but their secret values are deliberately not repeated
here and the provider has not been probed in this deployment check. Copy them
through Netlify's Functions environment UI if they are the intended production
endpoint; never put their values in Git. The
TTS/local provider remains explicitly unavailable while `AI_LOCAL_BASE_URL` is
unset.

`apps/web/e2e-prod.env.template` is a separate local Playwright-runner template,
not a Netlify environment file. It deliberately disables gated suites until
dedicated production test accounts, matching Firebase Admin credentials, and
real provider access are configured. Do not set local Firebase emulator hosts
when running `pnpm e2e:prod:*`.

Copy it to `apps/web/.env.e2e.production` and fill values locally. The runner
loads only that file; it never loads `.env.local`. This file is Git-ignored.
`E2E_TEST_DATA_APPROVED=true` and `E2E_*_ACCOUNT_APPROVED=true` are explicit
operator assertions that the accounts and fixtures are dedicated and safe to
mutate. `E2E_HEADLESS=false` is required for the Google Sign-In and Drive consent
checkpoints. The runner fails on missing provider flags/configuration and does
not turn an unrun or unavailable flow into a pass.

Available production commands:

```powershell
pnpm e2e:prod:config:test
pnpm e2e:prod:smoke
pnpm e2e:prod:auth
pnpm e2e:prod:student
pnpm e2e:prod:teacher
pnpm e2e:prod:classroom
pnpm e2e:prod:assignment
pnpm e2e:prod:drive
pnpm e2e:prod:speaking
pnpm e2e:prod:pronunciation
pnpm e2e:prod:voice
pnpm e2e:prod:offline
pnpm e2e:prod:security
pnpm e2e:prod:all
```

`e2e:prod:all` validates every suite's required credentials and explicit enable
flags before it starts; run individual suites while a provider is being brought
online. Drive E2E cleanup only accepts files associated with an E2E-marked
assignment owned by the authenticated teacher and removes both Drive objects and
their Firestore metadata.

Do not configure `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`,
`NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`, or
`NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST` in Netlify production. Those
variables are local-test-only and would route production traffic to localhost.

## Initial GitHub Push

Run from the repository root after reviewing the staged file list:

```powershell

git add -A

# Confirm that no .env, private key, token, or service-account file is staged.

git commit -m "chore: prepare TuturAI for Netlify"
```

If the secret-name command prints anything, stop, unstage the file, and rotate
the credential if it was ever committed. An empty result is required.

## Netlify CLI Setup

Install and authenticate locally:

```powershell
pnpm add --global netlify-cli
netlify login
netlify link
netlify status
```

Set production variables through the Netlify UI or CLI. Use the exact names from
`apps/web/.env.example`; do not paste values into Git. At minimum, review:

```text
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI
GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY
AI_V1_BASE_URL
AI_V1_API_KEY
AI_STT_MODEL_ID
AI_LLM_MODEL_ID
AI_LOCAL_BASE_URL
AI_LOCAL_API_KEY
AI_TTS_MODEL_ID
```

## Preview and Production

Preview first:

```powershell
netlify deploy --build
netlify open:admin
```

Verify the preview URL with the existing E2E scripts and provider failure paths.
Production requires explicit approval:

```powershell
netlify deploy --build --prod
```

Record the deploy ID and URL. Rollback must use the previous known-good deploy
from the Netlify dashboard or CLI after confirming the target deploy ID.
