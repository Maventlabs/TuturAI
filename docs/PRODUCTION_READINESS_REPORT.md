# TuturAI Production Readiness Report

**Date:** 25 September 2026  
**Repository:** `Maventlabs/TuturAI`  
**Product:** TuturAI adaptive English-speaking platform  
**Target deployment:** Netlify  
**Hardware target:** ESP32-S3

## Executive Summary

The core web product has substantial verified implementation: Firebase auth/RBAC,
classrooms, deterministic learning menus, assignment lifecycle, teacher
analytics, reports, offline recovery, AI assessment boundaries, and explicit
provider failure states.

The initial whole-product estimate was approximately **45% production release
readiness**. That number includes unverified Google Drive consent, OmniVoice
execution, pronunciation scoring, Netlify deployment/rollback, and the hardware
plane. Documentation or local mocks cannot honestly turn those external gates
green.

This report separates readiness into two measures:

| Measure | Meaning | Current status |
| --- | --- | ---: |
| Local implementation readiness | Code, contracts, tests, security baseline, repository configuration, and deployment preparation that can be verified without private provider confirmation | Target: >=80% |
| Production release readiness | The complete product after real provider, Netlify, hardware-in-loop, monitoring, and rollback confirmation | Approximately 45%; release blocked |

The credential policy is to continue all independent work and defer only the
specific external operation that needs a credential. Deferred work must include
an exact resume contract and must never be reported as successful.

## Verified Work Reused

The following evidence is accepted from the existing session and is not rerun
without a related code/configuration change:

- Firestore rules and protected API authorization tests.
- Student learning/history and teacher core Playwright flows.
- Adaptive completion and no-repeat recommendation behavior.
- Assignment submit/return/resubmit/approve lifecycle.
- Offline conversation replay with idempotent durable mutation.
- AI STT/LLM adapter normalization and failure-safe behavior.
- Pronunciation unavailable behavior with `score: null`.
- Teacher analytics, leaderboard, reports, and wrong-class fail-closed behavior.
- Local production build, typecheck, lint, dependency audit, and public-route smoke.

## Readiness Work Completed In This Increment

- Added the credential-gate execution policy to `PRD.md`.
- Added this report as the current readiness source.
- Added a proprietary `LICENSE` with no implied redistribution rights.
- Hardened root `.gitignore` for secrets, audit captures, firmware outputs, and build artifacts.
- Added a reproducible Netlify configuration with pinned Node/pnpm expectations,
  build, dev, functions, headers, and deploy-context sections.
- Added a GitHub Actions quality workflow for install, lint, typecheck, tests,
  audit, and build.
- Replaced the Windows-only Firestore test command with a cross-platform runner
  that can discover an available Java installation.
- Updated README repository/license/deployment expectations.
- Documented the root gitlink issue before the first push so Netlify does not
  deploy an incomplete checkout.

## Credential-Gated Tasks

### OmniVoice/TTS

Implemented local code exists for enrollment, metadata persistence, teacher
preview, and classroom-scoped student playback. The remaining gate is the real
provider contract and reachable HTTPS service.

Required server-only configuration:

- `AI_TTS_ROUTE=local`
- `AI_LOCAL_BASE_URL`
- `AI_LOCAL_API_KEY` when bearer authentication is enabled
- `AI_TTS_MODEL_ID` when the provider requires a model ID
- Enrollment, status/webhook, synthesis, and delete path overrides when defaults differ

Required provider confirmation:

- Enrollment returns a stable provider voice ID.
- `processing` transitions to `ready` or `failed` through polling or webhook.
- Synthesis returns non-empty audio bytes with a valid content type.
- Delete confirms provider-side deletion.

### Pronunciation

The current safe behavior is provider-unavailable with `score: null`. A valid
pronunciation provider must return phoneme/phone-level or forced-alignment data,
not only a transcript. The adapter contract must include target text, detected
phonemes, per-word scores, error types, confidence, and an overall score.

### Google Drive

OAuth values may exist locally, but consent, callback, refresh, upload, and
persisted Drive metadata require a real Google account and provider confirmation.

### Hardware

Broker host, CA or device certificate authority, per-device credentials, and
physical ESP32-S3 hardware are required only for hardware-in-loop verification.
The protocol and firmware preparation can proceed without them.

### Netlify

Local environment values do not automatically reach Netlify. Preview and
production variables must be configured in the Netlify site environment with
server-only scopes. Production deployment and rollback require explicit approval.

## Hardware Production Plan

The target is ESP32-S3 with ESP-IDF 5.x, C++17, and FreeRTOS. The transport is
not plain MQTT:

- `esp-mqtt` event-driven client.
- MQTT 5 over `mqtts://` using ESP-TLS/mbedTLS certificate verification.
- Optional mutual TLS per device.
- QoS 1 for state-changing messages, last-will presence, bounded reconnect backoff,
  message IDs, expiry, replay protection, and broker ACLs.
- HTTPS for audio and large artifacts.
- NVS/LittleFS or microSD for durable offline queue state.
- Signed OTA, watchdog, brownout recovery, and safe local behavior when cloud is unavailable.

The device menu contract will support classroom, lesson/activity, start, record,
retry, submit, sync status, and firmware update. Every session receives a
server-verifiable `sessionId` and `idempotencyKey`. Audio is deleted only after
server acknowledgement.

## Release Gates

- [x] Local tests, typecheck, build, lint, audit, and diff hygiene have current evidence.
- [x] Netlify configuration and environment-variable handoff documentation exist.
- [x] Proprietary license and repository secret protections exist.
- [ ] Root gitlinks are flattened or intentionally published as accessible dependencies.
- [ ] Netlify Preview deploy succeeds from the canonical GitHub repository.
- [ ] Production environment variables are present in Netlify without secret leakage.
- [ ] Real Google Drive consent/upload is confirmed.
- [ ] Real OmniVoice enrollment, readiness, preview, delete, and student playback are confirmed.
- [ ] Phoneme-capable pronunciation provider is confirmed.
- [ ] ESP32-S3 firmware builds, flashes, reconnects, queues offline work, and syncs through the real broker.
- [ ] Netlify production deploy, smoke test, and rollback are confirmed.
- [ ] Manual responsive/accessibility review and secret scan are recorded.

## Honest Readiness Decision

The repository can continue toward an **80% local implementation-readiness
threshold** by finishing repository normalization, CI, Netlify preview, security
automation, protocol contracts, and provider-gated code paths. The product must
not be labeled fully production-ready until the external release gates above are
confirmed.
