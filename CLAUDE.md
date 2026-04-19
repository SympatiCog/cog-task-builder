# Cog Task Builder — Agent Guide

Web UI for authoring JSON task definitions that the
[cog-task-engine](https://github.com/SympatiCog/cog-task-engine) runs. The
builder is a **consumer** of the engine's schema — it has no runtime
dependency on Godot, and the engine does not depend on the builder. The
contract between them is the JSON in `docs/LLM_TASK_AUTHORING.md` (schema
1.1.0) and the canary fixtures in `tasks/examples/`. Both live inside the
`vendor/engine/` submodule and are the source-of-truth when anything here
seems ambiguous.

Stack: Vite 5 + React 18 + TypeScript strict + Tailwind 3 + Zustand 4 +
Vitest 2 + `@dnd-kit/core` (only used by the trial-template sortable list).

## Directory layout

```
src/
  actions/              pure (task, …args) → task functions, per section
                        plus cascades.ts — 8 rename cascades for the
                        cross-ref rules (see "Invariants").
  components/
    primitives/         Field, TextField, NumberField, Toggle, Select,
                        KeyedList, MultiSelect, AssetRefPicker,
                        CommaListField — every form control used by the
                        section panels.
    sections/           one panel per task-JSON section (Metadata, Theme,
                        Assets, Inputs, Responses, StimulusTypes,
                        TrialTemplate, Timing, Blocks, SessionEnd) +
                        Validation + Help + TimelineView (read-only SVG).
    Shell.tsx           Toolbar + left-nav + validation banner + preview.
    Toolbar.tsx         Import/export buttons, paste dialog trigger.
    PasteImportDialog.tsx, ImportDropZone.tsx,
    GenerateFromFolderDialog.tsx — modal flows.
  defaults/             newTask() factory for a blank schema-1.1 task.
  hooks/                useKeyboardShortcuts (mod-normalizing combo matcher).
  serde/                import.ts, export.ts, canonicalize.ts, keyOrder.ts
                        — the round-trip boundary between disk JSON and
                        the Zustand store.
  store/                taskStore.ts — Zustand + persist middleware →
                        localStorage under key "cog-task-builder:v1".
  types/                TS types for TaskJson schema 1.1.0.
  utils/                slugify, sha256, githubFolder (raw.github listing
                        + hash), overrides (per-field override summary).
  validator/            index.ts — pure port of the engine's cheap passes;
                        hooks.ts — useValidation + useIssuesAt with
                        prefix-boundary matching; serverValidate.ts — POST
                        to VITE_VALIDATOR_URL (stubbed without backend).
test/                   vitest. fixtures/ is the engine's example tasks;
                        every fixture there must validate clean and
                        round-trip byte-for-byte through canonical order.
vendor/engine/          git submodule → cog-task-engine. Update the pin
                        when the engine's schema or conventions change;
                        re-sync fixtures from vendor/engine/tasks/examples/
                        into test/fixtures/ afterward.
```

## Architecture principles

### Canonical state = `TaskJson`, not a proprietary IR

The Zustand store holds `TaskJson | null`. There is no intermediate
representation. Every action takes the current task and returns a new task;
every mutation is a shallow replace. This is load-bearing — it means:

- The builder can never drift from the engine's schema semantics.
- Round-trip is a pure-function contract (import → store → export =
  parse-equal to the original).
- Hand-edited JSON and generator-produced JSON (e.g.,
  `cog-task-engine/tools/build_symbols_task.py`) round-trip identically.

If you find yourself tempted to add a "normalized" intermediate type or a
richer in-memory shape, don't. The JSON is the truth.

### Actions are pure `(task, …args) => task`

Every store mutation routes through `updateTask(mutator)`:

```ts
update((t) => addImage(t, id, asset));
```

Actions live in `src/actions/` and must be:

- **Pure**: no side effects, no access to the store, no mutation of inputs.
- **Structurally immutable**: spread-return new objects so React
  memoization + dnd-kit identity comparisons stay intact.
- **Cascade-aware for renames**: renaming an id that other sections
  reference calls out to `src/actions/cascades.ts` to walk the whole
  document. See next.

### Rename cascades cover the 8 cross-ref rules

The rules are documented in `builder-plan/01-scope.md §"The eight
cross-reference rules"` (inside the engine repo, because that's where the
planning docs live). Renames must cascade across:

1. `responses.*.keyboard[]`   ⊆ `inputs.keyboard[]`
2. `responses.*.touchscreen[]` ⊆ `inputs.touchscreen_buttons[*].id`
3. `stimulus_types.*.correct_response` ∈ `responses` keys
4. `stimulus_types.*.items` keys ⊆ `trial_template[*].id`
5. `stimulus_types.*.items.*.asset` → `img:`, `img:pool:`, `aud:` refs
6. `assets.pools.*.members[]` ⊆ `assets.images` keys
7. `blocks.*.types[]` ⊆ `stimulus_types` keys
8. `trial_template[*].anchor` → `<peer_id>.{start,end,response}`

Each cascade helper lives in `src/actions/cascades.ts`. When you add a new
kind of reference (e.g., a future v1.2 field that references a pool), add
it to the rename helper for that referenced entity **and** add a test
under `test/cascades.test.ts` or the batch-3b equivalent.

Never use spread-merge for a rename — `{ ...oldItem, ...patch }` where
`patch` has `undefined` for a removed field will re-spread the old value,
defeating the delete. Prefer explicit `{ ...rest, [newKey]: value }` or
full replacement. See the `setOrdering` bug history in
`src/actions/blocks.ts` for why this matters.

### Validator error codes match the engine verbatim

`src/validator/index.ts` is a pure port of the cheap passes in the engine's
`schema/SchemaValidator.gd`. Error codes (`invalid_identifier`,
`asset_not_declared`, `pool_too_small`, `empty_types`, `asset_missing`,
etc.) come directly from `LLM_TASK_AUTHORING.md §10` and are the contract
between client- and server-side validation. When the engine introduces a
new validator code:

1. Bump the `vendor/engine` submodule pin.
2. Add the code to `src/validator/index.ts`.
3. Add a targeted test in `test/validator.test.ts`.
4. Check that every fixture in `test/fixtures/` still validates clean —
   the `validator: engine fixtures should be clean` test loop catches
   accidental over-reporting.

Do NOT invent codes. If a check doesn't fit any existing engine code,
raise it upstream in the engine first, then port.

**One documented exception.** `checkStimulusTypes` emits `unknown_label` on
`stimulus_types.<type>.items.<id>` when the id doesn't match any
`trial_template` item. The engine has no equivalent check — such overrides
are silently ignored at runtime, which is a real authoring bug (the author
wrote an override that will never fire). This is the only builder-only use
of an engine code; it reuses `unknown_label` because semantically it is
the same class of error ("this name isn't declared anywhere"). If this
check ever moves upstream, it should get its own code (e.g.
`unknown_item_override`) and this divergence should disappear.

### Canonical key order in `serde/keyOrder.ts`

Exported JSON keys are emitted in a lookup-table order that matches the
hand-edited style of the engine's example tasks (`schema_version` first,
`session_end` last, `task_id` before `task_version`, etc.). This is NOT
alphabetical. Unknown keys fall through in insertion order (forward-compat
for future schema versions).

The `test/canonical_order.test.ts` suite walks every nesting level of
every fixture and asserts the declared-known keys come out in the expected
sub-order. If you extend the schema (add a new top-level section, a new
block field, a new trial_item field), update `KEY_ORDER` in
`keyOrder.ts`, update the `canonicalize.ts` walker if the new field is a
dict, and the recursive test will either pass or point you at the mismatch.

**Byte-exact round-trip is not a contract.** Engine fixtures use author-
chosen inline compact dicts (`{"text": "ok", "style": "correct"}` on one
line) that `JSON.stringify(..., null, 2)` cannot reproduce without a
bespoke pretty-printer. Don't try to add one — the test battery already
covers the reachable contracts (semantic round-trip, export idempotence,
recursive canonical order, unknown-key preservation).

## Critical invariants (easy to break)

### `Pool.kind` is `"image"` only in the TS type

The engine's schema reserves `"audio"` syntactically but rejects it with
`unsupported_pool_kind`. The builder's `Pool.kind` type is tightened to
`"image"` so pickers can't emit an audio pool. If you change this (and
only if the engine gains audio pool support), update:

- `src/types/task.ts` Pool.kind
- `src/validator/index.ts` checkPools
- `src/components/GenerateFromFolderDialog.tsx` Source toggle

### `FeedbackCase.asset` never accepts pool refs

Engine error: `pool_in_cases_not_supported`. Enforced at the
`AssetRefPicker` call site (pools prop is `[]`) and by the validator.
Keep both.

### `expression-form correct_response` is not supported in v1.x runtime

The schema accepts `correct_response` as a Dictionary (for AX-CPT, n-back,
etc.), but the engine treats any non-literal as incorrect at runtime.
`StimulusTypesPanel` only exposes a literal `<Select>`. If a future schema
adds expression form, add a second-tier UI; do not accidentally import
expressions from hand-edited JSON and silently drop them — the unknown-
key preservation test catches dropped top-level keys but field-level
dropped values would slip through. If you add expression form, extend the
round-trip test coverage.

### Unknown keys must survive round-trip

`test/unknown_keys.test.ts` is the guarantee. Every new canonicalizer
helper must pass-through keys it doesn't recognize rather than silently
omit them. `orderKeys` in `keyOrder.ts` handles this correctly — it
iterates the known-key table first, then appends every remaining key in
insertion order. Don't bypass `orderKeys`.

### `webkitdirectory` + `directory` attrs require a `// @ts-expect-error`

The HTML input attributes for folder picking are non-standard but honored
by every major browser. There's no TS DOM type for them. The escape hatch
lives in `GenerateFromFolderDialog.tsx`. If React DOM types add these,
remove the suppression.

### `aria-describedby` belongs on the control, not the wrapper

Each primitive (`TextField`, `NumberField`, `Select`) computes its own
`aria-describedby` via the `describedBy(id, help, error)` helper in
`Field.tsx` and wires it onto the `<input>` / `<select>`. The wrapping
`<Field>` component is layout only. If you build a new primitive, follow
the same pattern — don't put `aria-describedby` on a wrapping `<div>` or
screen readers won't announce the help/error when the control is focused.

### Id-rename fields must commit on blur, not per keystroke

Renaming fires cross-ref cascades. Per-keystroke commit walks the whole
document for every letter the user types (and can collide mid-word). Use
the local-draft + commit-on-blur pattern from `KeyedList` and the id
inputs in `TrialTemplatePanel` / `BlocksPanel`.

### Comma-list fields use `CommaListField`, not `TextField`

Parsing `"f, j"` per-keystroke drops the trailing empty segment after the
comma and makes the character visibly disappear. `CommaListField` buffers
the draft text, commits on blur / Enter, and reverts on Escape. Keyboard
keys, allowed_refresh_hz, allowed_hosts all use it.

### Vitest excludes extend defaults, don't replace them

`vite.config.ts` sets `test.exclude` to the full default list plus
`vendor/**`. If you shrink this to just `["vendor/**"]`, Vitest will
start running tests inside `node_modules` and `dist`. The engine
submodule's embedded batch-1 scaffold has its own test suite — if we
didn't exclude `vendor/**`, every test run would pick those up twice.

### localStorage persist version is load-bearing

`cog-task-builder:v1` is the localStorage key. The store's `version: 1`
field is compared against the stored version — a mismatch **silently
discards the draft** (zustand persist default behavior) unless a
`migrate` callback is registered. Bump the version only in breaking
shape changes AND provide a migrate that either upgrades the draft or
explicitly throws it away with a visible warning. The comment in
`taskStore.ts` is the reminder.

## How to extend

### Add a new section panel

1. Build the pure actions under `src/actions/<section>.ts` — CRUD + any
   renames that need cascading (delegate cascades to `cascades.ts`).
2. Build the React panel under `src/components/sections/<Section>.tsx`.
   Use the primitives under `components/primitives/` — don't hand-roll
   `<input>` / `<select>` elements with bespoke styling.
3. Register the panel in `src/components/Shell.tsx`'s `SECTIONS` array
   and its `SectionBody` switch.
4. If the section introduces a new kind of reference between sections,
   add the rename cascade in `cascades.ts` and cover it in
   `test/cascades.test.ts`.
5. If the section introduces new validator rules, port the corresponding
   check from the engine's `SchemaValidator.gd` into
   `src/validator/index.ts` with a matching test.

### Add a new validator check

1. Add the pass function to `src/validator/index.ts` and call it from
   `validate()` — place it in the same ordinal position as the engine's
   `SchemaValidator.gd` so a merged report has consistent ordering.
2. Use the exact engine error code. If the engine doesn't yet have the
   code, propose it upstream first, then port.
3. Add a targeted test in `test/validator.test.ts`.
4. Re-run `npm run test` — the "fixtures should be clean" loop verifies
   you haven't over-reported.

### Add a new asset-ref kind

`src/utils/` and `src/components/primitives/AssetRefPicker.tsx` define
the builder's asset-ref model. The validator's `parseAssetRef` is the
source of truth for what's accepted. If the engine adds a new prefix
(e.g., `vid:<id>` for video), update:

- `parseAssetRef` (validator)
- `AssetRefPicker` suggestion list
- Per-panel `AssetRefPicker` invocations (which prefixes to offer per
  item kind)
- `src/actions/cascades.ts` rename helpers if it introduces a new ref
  pattern

### Bump the schema version

1. Update `SchemaVersion` in `src/types/task.ts`.
2. Update `_MAX_SCHEMA` check in `src/validator/index.ts`.
3. Update `newTask()` factory in `src/defaults/newTask.ts`.
4. Update the schema-version-bump logic in
   `src/actions/assets.ts addPool` and anywhere else that conditionally
   upgrades 1.0.0 → 1.1.0 → n.
5. Re-sync `test/fixtures/` from `vendor/engine/tasks/examples/`.
6. Run the full suite.

## Testing

```bash
npm run test          # vitest, ~140 tests
npm run test:watch    # iterative
npm run typecheck     # tsc -b --noEmit
npm run build         # typecheck + vite build
```

Every batch's contract is covered:

- **Round-trip** (`test/roundtrip.test.ts`): import → export parse-equals
  original.
- **Idempotence**: export twice = byte-identical.
- **Top-level canonical order**: every fixture's root keys emit in the
  canonical sequence.
- **Recursive canonical order** (`test/canonical_order.test.ts`): every
  nested dict matches its section's declared order.
- **Unknown-key preservation** (`test/unknown_keys.test.ts`): synthetic
  fixture with unknown keys at every nesting level round-trips intact.
- **Import edges** (`test/import_edges.test.ts`): BOM stripping,
  malformed JSON, non-object roots, missing schema_version.
- **Cascades** (`test/cascades.test.ts`, `test/batch3b_cascades.test.ts`,
  `test/trial_template.test.ts`): every rename (image, audio, pool,
  text_style, touchscreen button, response label, stimulus type, trial
  item) updates the referring sites.
- **Actions** (`test/assets_actions.test.ts`, `test/blocks.test.ts`,
  `test/trial_template.test.ts`, `test/poolFolder.test.ts`): CRUD
  semantics, no-ops on collisions, schema bumps.
- **Validator** (`test/validator.test.ts`): ~50 targeted error-code
  cases + all engine fixtures must validate clean + regression
  fixtures for known-bad shapes (empty_types, asset_missing,
  invalid_anchor_axis, remote-asset checks).
- **Utilities** (`test/slugify.test.ts`, `test/overrides.test.ts`,
  `test/githubFolder.test.ts`, `test/keyboard_shortcuts.test.ts`).

UI behavior that isn't a pure function (Zustand hooks, dnd-kit sortable,
the fetch path in `serverValidate`) isn't currently covered — would need
jsdom + `@testing-library/react`. Add that if the next batch needs it.

## Common pitfalls

- **Spread-merge vs delete**: `{ ...old, ...patch }` where patch has
  `undefined` values re-spreads the old value. For field removal, use
  object destructuring (`{ foo: _unused, ...rest } = old`) or replace
  the object wholesale. See `setOrdering` in `actions/blocks.ts`.
- **`File.webkitRelativePath` is `string` typed but unpopulated** when
  the input isn't a `webkitdirectory` folder pick. Always fall back to
  `.name`. When wrapping a `Blob` into a `File` for the GitHub scan
  path, set `webkitRelativePath` via `Object.defineProperty` — the
  constructor doesn't expose it.
- **`crypto.subtle.digest` + `File.arrayBuffer()` + fetch' CORS**:
  hashing locally works for any file the browser can read. Fetching
  from arbitrary origins for SHA computation requires
  `access-control-allow-origin: *` on the remote — GitHub raw sets
  this, most CDNs don't. Document in the asset field's help text.
- **Re-exporting a task with pools bumps its `schema_version` to
  1.1.0** via `addPool`. A task exported with only static `img:<id>`
  refs stays on whatever it was imported as. If an author declares a
  pool then removes it, schema_version does NOT auto-revert — this
  matches the engine's forgiving-forward posture.
- **`delete` on a frozen object**: store slices are not frozen, but if
  an action uses `Object.freeze` for defensiveness elsewhere, `delete`
  throws silently in strict mode. Shallow-clone before deleting.
- **dnd-kit's `SortableContext items` prop** must be a stable list of
  unique ids matching what each `useSortable({ id })` receives. If the
  item ids change mid-drag (via a rename), dnd-kit drops the drag.
  Rename inputs commit on blur specifically to avoid this.
- **Zustand persist during SSR** is not a concern (this is a pure SPA
  build), but if someone wires up Next.js or similar later, the
  persist middleware needs a `skipHydration: true` + manual rehydrate
  to avoid server/client mismatches.

## Data contract (what the exported JSON is)

The export is a **single JSON object** conforming to schema 1.1.0, with:

- Keys in canonical order at every nesting level (`keyOrder.ts`).
- Unknown keys passed through in their import-order position.
- 2-space indent, POSIX trailing newline.
- Round-trip guarantee: import-then-export parses deep-equal to the
  original; two consecutive exports are byte-identical.

The engine is the only authoritative validator. The builder's client-side
validator is a cheap convenience; the server endpoint (when configured
via `VITE_VALIDATOR_URL`) runs the full `SchemaValidator.gd` pass and is
the source of truth for export.

## Deferred (not bugs)

- **File-upload asset bundling** (v1.5): uploaded files → SHA-256 of
  uploaded bytes → "Export as kit" zip with `tasks/<id>.json` + asset
  tree. Schema needs no change; it's builder-only UX.
- **Inline-ordering `trial_list` table editor** (v1.5): currently
  authors use `csv` mode with a URL or hand-edit inline `trial_list`.
- **Drag-bar editing on the TimelineView**: the timeline is read-only.
  Editing lives in the list; drag-to-edit bars is a polish deferrable.
- **Remote-pool scan for non-GitHub hosts**: the scan path is
  GitHub-contents-API-specific. S3, generic HTTP indexes, etc. each
  need their own listing logic. Authors with other hosts use local
  folder + URL prefix (the dialog's left-hand path).
- **Session builder** (post-v1.0): composes tasks + questionnaires into
  a session.json. Will live in the same workspace whenever the
  questionnaire builder monorepo story is resolved. The task builder's
  dotted-path refs and action model are designed to let it reuse these.

## Cross-references

- `vendor/engine/docs/LLM_TASK_AUTHORING.md` — applied subset of the
  engine schema, the contract this builder serializes.
- `vendor/engine/docs/FRD_Draft.md` — full engine spec.
- `vendor/engine/docs/IMAGE_POOLS_PLAN.md` — v1.1 pool semantics.
- `vendor/engine/CLAUDE.md` — engine internals. Read when changing
  anything that touches runtime behavior (rare for the builder).
- `vendor/engine/builder-plan/` — the original scoping docs for this
  project. The "eight cross-reference rules" and the batch plan live
  there.
