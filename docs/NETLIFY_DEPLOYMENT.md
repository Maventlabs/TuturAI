# Netlify Deployment Runbook

## Repository Preconditions

The root repository currently records `apps/web` and `source/TuturAI` as gitlink
entries without a `.gitmodules` mapping. Do not push the root repository as-is
and assume Netlify can fetch those directories. The active web source must be
flattened into the canonical `Maventlabs/TuturAI` repository, or the linked
repositories must be made accessible and documented.

Inspect before changing the boundary:

```powershell
git ls-tree HEAD apps/web source/TuturAI
git -C apps/web status --short --branch
git -C source/TuturAI status --short --branch
```

If the intent is to publish the complete source in the root repository, make a
backup branch first, then convert the gitlinks deliberately. Do not delete any
nested `.git` directory until its history is backed up.

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
