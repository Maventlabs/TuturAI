# MUST.md - Persistent Project Rules

This file is the project operating contract. Read `PRD.md`, `AGENTS.md`, and
`EXECUTION.md` before implementation and reread this file after context
compaction. `EXECUTION.md` is the only runtime status source.

## Execution Order

Continue through the phases in `EXECUTION.md` in order without skipping anything.
Before each phase, read and use as primary references:

1. `PRD.md`.
2. `AGENTS.md`.
3. `MUST.md`.
4. `EXECUTION.md`.
5. Relevant implementation and reference files only.

Do not advance, skip a task, or mark a task complete until its implementation and
testing are actually complete. Update `EXECUTION.md` immediately after every task
or phase transition so it reflects the actual repository state. Retained files in
`tasks/` are historical and must not be used as the execution lock.

## Implementation Contract

- Use the relevant installed skills and MCP tools during the work.
- For UI work, use shadcn/shadcn and ReactBits MCP when a suitable component
  exists; do not recreate an available component manually.
- Menus, buttons, forms, navigation, interactions, state, CRUD, workflows,
  and features must be functional end-to-end, never static or placeholder UI.
- Connect each feature to the required backend, database, API, or state layer.
- Implement and test loading, error, empty, success, offline/sync, and
  permission/role states where relevant.
- Preserve the established architecture and document any technically
  necessary deviation.
- Every learning menu/category with questions, exercises, quizzes, tasks,
  assessments, challenges, or similar content needs its own scalable bank.
  Target approximately 50 varied items per menu/category unless the PRD
  specifies another amount. Keep data in the database or structured JSON,
  not directly in UI components.
- After each slice, run relevant unit/integration tests and Playwright E2E for
  the primary user flow and at least one failure or permission path.

## Preservation And Security

- Do not delete, overwrite, truncate, or replace existing files casually.
- Read and understand an existing file before editing it.
- Prefer additive, minimal changes and preserve relevant existing code,
  configuration, documentation, data, and implementation.
- Do not perform destructive refactors to simplify implementation.
- Never invent fake credentials, provider responses, scores, uploads, OAuth,
  database writes, or simulated success.
- Keep credentials, API keys, OAuth secrets, private keys, tokens, and local
  environment files out of Git, browser bundles, build logs, and Firestore.
- Stop only when blocked by a missing credential/API key/environment value,
  external access, a product/security decision, a destructive action, a real
  payment, or a production change. State the exact dependency required.
- Otherwise continue independently without pausing for optional preferences.

## Definition Of Done

For each active phase: finish every requirement and sub-phase, implement the
behavior, expand/organize data, run tests, fix errors and regressions, update
TODO and documentation, and re-verify acceptance criteria before moving on.

The final integration must leave only model/provider connection choices for the
operator: AI providers must remain replaceable through the existing server-side
router for local and API deployments.
