# AI Provider Context

## Current Configuration

- `apps/web/.env.local` is the active local configuration file.
- The configured `v1` provider credentials are present for the current STT/LLM routes:
  - `AI_V1_BASE_URL` is configured.
  - `AI_V1_API_KEY` is configured.
  - `AI_STT_MODEL_ID` is configured.
  - `AI_LLM_MODEL_ID` is configured.
- `AI_LOCAL_BASE_URL` is intentionally empty.
- `AI_TTS_MODEL_ID` is intentionally empty.

## Why Local Is Empty

The local route is reserved for the project's self-hosted OmniVoice/TTS service. That service has not been built or deployed yet. Empty local values are expected development state, not missing credentials for the configured v1 STT/LLM provider.

## Implementation Rules

- Never expose `AI_V1_API_KEY` or any provider secret to the browser.
- Never treat an empty local TTS configuration as provider success.
- STT/LLM v1 calls may proceed only after server-side config validation.
- TTS/OmniVoice calls must return an explicit `not configured` or retryable provider error until the self-hosted service exists.
- Do not add placeholder audio, fabricated assessment scores, or simulated provider responses.
- Read this file when implementing Phase 4 AI, voice, or TTS work.

## Required Project Context

- Read `PRD.md`, `AGENTS.md`, `MUST.md`, `EXECUTION.md`, and only the relevant provider files before starting a new phase. `EXECUTION.md` is the only runtime status source.
- Use installed skills and relevant MCP servers; skills and MCP usage are mandatory project workflow, not optional suggestions.
- Firestore is the durable database/source of truth. Local emulator verification exists; do not provision a replacement database because cloud discovery is unavailable in the current CLI session.
- Do not claim a phase checkpoint until its acceptance criteria and verification evidence pass.
