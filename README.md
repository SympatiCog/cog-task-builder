# cog-task-builder

Web-based authoring UI for [cog-task-engine](https://github.com/SympatiCog/cog-task-engine) task JSON.

The engine's schema (currently 1.1.0) is the contract. Authoring spec: `vendor/engine/docs/LLM_TASK_AUTHORING.md`.

## Development

```bash
npm install
npm run dev        # localhost:5173
npm run test       # vitest
npm run typecheck
npm run build      # → dist/
```

## Repo layout

```
src/
  components/          React UI
    primitives/        reusable form primitives (TextField, NumberField, ...)
  serde/               import / export / canonical key ordering
  store/               Zustand store (canonical state = TaskJson)
  types/               TS types for schema 1.1.0
test/
  fixtures/            copies of engine example tasks — resync when the engine schema changes
vendor/engine/         git submodule → cog-task-engine (spec + fixtures source of truth)
```

## Engine submodule

`vendor/engine/` pins a specific commit of cog-task-engine. To update:

```bash
git submodule update --remote vendor/engine
# Then: re-sync test fixtures from vendor/engine/tasks/examples/ if they changed.
```
