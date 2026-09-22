# TuturAI Root Monorepo Design

## Status

Approved in conversation before implementation.

## Context

The active project workspace is `TuturAI-Fullstack/`. The cloned GitHub source is
currently nested under `source/TuturAI/` and contains a Next.js web app, an empty
Python API shell, firmware scaffolding, AI notebooks/scripts, and research assets.
The web app also owns its own `package.json`, lockfile, and workspace file, which
makes the repository difficult to install and deploy as one product.

The target is a shallow root monorepo that deploys the web app and secure server
functions independently while sharing domain contracts and validation code.

## Goals

- Make `TuturAI-Fullstack/` the active repository root.
- Use one pnpm workspace, one lockfile, and Turborepo task orchestration.
- Keep the existing web UI as the starting surface instead of rewriting screens.
- Move durable domain rules into packages shared by web and functions.
- Use Netlify for the web app and Netlify Functions for privileged server work.
- Keep Firebase, Google Drive, AI providers, and secrets behind explicit boundaries.
- Preserve the current GitHub source as a non-destructive reference during migration.
- Make local verification and deployment commands reproducible without credentials.

## Non-goals

- Do not make the existing empty Python API a production deployment target.
- Do not implement Firebase Auth, Firestore, Drive OAuth, or AI provider calls
  without real credentials/configuration.
- Do not delete `source/TuturAI` during the first migration pass.
- Do not move notebooks, datasets, or firmware into JavaScript packages.
- Do not add a second database, storage provider, or speculative microservice.

## Target Structure

```text
TuturAI-Fullstack/
├─ apps/
│  ├─ web/                  # Next.js application, Netlify deploy target
│  └─ functions/            # Netlify Functions, privileged server boundary
├─ packages/
│  ├─ domain/               # Shared types and pure business rules
│  ├─ validation/           # Shared input validation and API error contracts
│  └─ config/               # Shared TypeScript/tooling configuration
├─ firebase/
│  ├─ firestore.rules       # Added before Firestore integration is enabled
│  ├─ firestore.indexes.json
│  └─ firebase.json
├─ docs/
├─ tasks/
├─ netlify.toml
├─ package.json
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
├─ turbo.json
└─ source/TuturAI/          # Temporary source archive/reference, not active workspace
```

## Package Boundaries

### `apps/web`

Owns routes, UI, browser state, PWA behavior, and client-safe Firebase configuration.
It may import `@tuturai/domain`, `@tuturai/validation`, and `@tuturai/ui` if a UI
package is later justified. It must not import Firebase Admin, Drive refresh tokens,
AI provider secrets, or function internals.

### `apps/functions`

Owns Netlify Function handlers for Firebase Admin verification, privileged Firestore
mutations, Drive OAuth/upload, AI proxying, reports, and device operations. It may
import domain and validation packages but never browser-only code.

### `packages/domain`

Owns framework-free types and pure rules: roles, classroom ownership, join-key
validation, assignment/submission transitions, assessment normalization, and sync
state transitions. No Firebase, React, Netlify, or environment access.

### `packages/validation`

Owns shared request/input schemas and the error envelope used at API boundaries.
Server handlers must validate again even when the web client validates first.

### `packages/config`

Owns shared TypeScript and lint configuration only. Runtime secrets remain in the
package/app that consumes them; no root `.env` is introduced.

## Migration Mapping

- Copy `source/TuturAI/apps/web` to root `apps/web` and rename its package to
  `@tuturai/web`.
- Move the existing pure domain files and tests from the web app into
  `packages/domain`; keep temporary compatibility exports only while imports are
  migrated.
- Move the shared validation/error files into `packages/validation`.
- Create `apps/functions` as a TypeScript Netlify Functions package with a health
  endpoint and explicit auth/error boundary, but no simulated production success.
- Leave the existing Python API, firmware, notebooks, and datasets under
  `source/TuturAI` until each has an explicit migration task.
- Maintain root `tasks/` and `PRD.md` as the project source of truth.

## Build And Deployment

- `pnpm-workspace.yaml` includes `apps/*` and `packages/*` only.
- Root scripts delegate to `turbo run`; package scripts own actual build/test/lint
  commands.
- `turbo.json` defines `build`, `typecheck`, `test`, `lint`, and uncached persistent
  `dev` tasks. Build tasks depend on dependency package builds.
- Next.js uses `transpilePackages` for local packages and a monorepo tracing root.
- `netlify.toml` points the web build at `@tuturai/web` and functions at
  `apps/functions/netlify`.
- CI uses `corepack pnpm install --frozen-lockfile` and `pnpm turbo run
  typecheck test build`.
- Deployment verification must pass with placeholder-free configuration; external
  integrations stop at a credential gate instead of fabricating success.

## Migration Slices

1. Scaffold root workspace, package names, pnpm lockfile, and Turborepo tasks.
2. Copy and normalize the web app at `apps/web`; verify it builds from root.
3. Extract domain and validation packages; verify package imports and tests.
4. Add the functions package and Netlify routing/configuration.
5. Add Firebase project/rules scaffolding without enabling fake auth/data.
6. Run root typecheck, tests, build, and deployment configuration checks.
7. Only after the root build is stable, begin Firebase Auth and Firestore slices.

## Safety And Rollback

- Migration is additive first; the nested source remains untouched.
- Each slice must leave root tests/typecheck/build in a runnable state.
- No destructive delete or replacement of `source/TuturAI` is allowed without a
  separate explicit decision.
- If a root migration fails, the existing nested web app remains available as the
  rollback reference.

## Acceptance Criteria

- Root `pnpm install --frozen-lockfile` resolves one workspace lockfile.
- `pnpm turbo run typecheck` and `pnpm turbo run test` pass for all active packages.
- `pnpm turbo run build --filter=@tuturai/web` produces a deployable Next.js build.
- Netlify configuration identifies web and functions directories without secrets.
- Shared domain tests pass outside the web app package.
- No production route reports simulated success or exposes server secrets.

## Credential Gates

- Firebase project ID/client config and Firebase Admin credentials are required for
  real auth/rules verification.
- Google Drive OAuth client credentials are required for Drive flows.
- AI provider base URL, API key, and model IDs are required for inference flows.
- Netlify site/account access is required for remote deployment verification.
