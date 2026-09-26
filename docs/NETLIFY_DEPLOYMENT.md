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
