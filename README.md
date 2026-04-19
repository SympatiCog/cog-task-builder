# cog-task-builder

Web-based authoring UI for [cog-task-engine](https://github.com/SympatiCog/cog-task-engine) task JSON.

Schema 1.1.0. Source-of-truth spec: `vendor/engine/docs/LLM_TASK_AUTHORING.md`.

## Development

```bash
npm install
npm run dev        # localhost:5173
npm run test       # vitest  — 84 tests
npm run typecheck
npm run build      # → dist/
```

Optional backend for authoritative validation:

```bash
VITE_VALIDATOR_URL=http://localhost:8080/validate npm run dev
```

Without the env var, the "Run server validation" button returns the
client-side report labeled as a stub.

## Repo layout

```
src/
  actions/             pure (task, args) → task functions per section
  components/
    primitives/        Field, TextField, NumberField, Toggle, Select,
                       KeyedList, MultiSelect, AssetRefPicker,
                       CommaListField
    sections/          one panel per task-JSON section + Validation +
                       Help + TimelineView
  defaults/            newTask() factory for blank schema-1.1 task
  hooks/               useKeyboardShortcuts
  serde/               import / export / canonical key ordering
  store/               Zustand store, localStorage persist
  types/               TS types for schema 1.1.0
  validator/           client-side pure validator + server wrapper
test/                  vitest — round-trip, canonical order,
                       unknown-key preservation, cascade correctness,
                       validator rule coverage
vendor/engine/         git submodule → cog-task-engine
                       (spec + example fixtures source of truth)
```

## Workflow

1. Start from **New** or import an existing task (file picker, paste
   JSON, or drag a file onto the window).
2. Fill Metadata, Theme, Inputs, Responses first.
3. Add Assets (images/audio/pools) before Stimulus types and Trial
   template so autocomplete can help.
4. Build the Trial template. Drag to reorder. Exactly one item must
   have `captures_response: true`.
5. Define Stimulus types. Each carries `correct_response` and per-item
   overrides.
6. Set Timing and add Blocks.
7. Open Validation and resolve errors. Export JSON.

Keyboard: `⌘/Ctrl+E` exports, `⌘/Ctrl+/` jumps to Validation, `Esc`
closes the paste dialog.

## Engine submodule

`vendor/engine/` pins a specific commit of cog-task-engine. To update:

```bash
git submodule update --remote vendor/engine
# Then: re-sync test fixtures from vendor/engine/tasks/examples/ if they changed.
```
