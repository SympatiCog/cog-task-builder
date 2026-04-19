# cog-task-builder

Web-based authoring UI for
[cog-task-engine](https://github.com/SympatiCog/cog-task-engine) task JSON.

Write cognitive-task JSON (Stroop, Flanker, AX-CPT-class, image
classification, 2AFC with stimulus pools, PVT) with live validation and
round-trip guarantees against the engine's schema. Exports a single
`<task_id>.json` that drops into the engine's `tasks/default.json` slot
or into WARP's per-session `config.task_definition`.

Schema 1.1.0. Source-of-truth spec: `vendor/engine/docs/LLM_TASK_AUTHORING.md`.

---

## Quick start

```bash
git clone --recurse-submodules https://github.com/SympatiCog/cog-task-builder.git
cd cog-task-builder
npm install
npm run dev
# open http://localhost:5173
```

If you cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

The builder is entirely local — no backend required for v1. Drafts are
auto-saved to `localStorage` under `cog-task-builder:v1`.

Optional: point the **Run server validation** button at a Godot-headless
HTTP wrapper for authoritative validation (see
[docs/FRD_Draft.md §5.2](vendor/engine/docs/FRD_Draft.md) for the full
validator pass list):

```bash
VITE_VALIDATOR_URL=http://localhost:8080/validate npm run dev
```

---

## How the engine's model maps to the UI

A single task JSON has ten top-level sections, each a panel in the left
nav. Two concepts trip up most authors early:

### 1. Trial template = the timeline of *one* trial

A flat ordered list of items — `fixation`, `critical_stimulus`,
`feedback`, etc. — with onsets, durations, and anchor relationships.
Exactly one item has `captures_response: true`.

### 2. Stimulus types = the *conditions* that vary across trials

One `cs` item in the template, but four stimulus types might override
its asset with four different images (or four pools of images) — one
type per condition. The block's `types[]` picks which conditions to
draw trials from.

The in-panel **"Overridden by N types"** chips and per-field override
hints are there to keep that relationship visible while you author.

### When to use pools

Declare a pool in `assets.pools` when you want **per-session sampling**
from a larger image set — e.g., 40 face exemplars, 10 shown per
participant, seeded from `block.seed` for reproducibility. Stimulus
types reference a pool with `img:pool:<name>` instead of `img:<id>`.

When every participant should see the same images, use static
`img:<id>` refs and skip pools.

---

## Worked example: 2AFC with per-condition pools

Goal: participants decide whether a symbol matches the **left** or
**right** target. Four conditions (`slotA_left`, `slotA_right`,
`slotB_left`, `slotB_right`), each with ~50 exemplars hosted on
GitHub. Each session draws a subset.

**1. Assets → Pools**

- **+ Add pool** → `slotA_left`.
- Click **Generate from folder...**.
- In the dialog, paste the raw GitHub URL into the "From GitHub folder
  URL" field:
  ```
  https://raw.githubusercontent.com/<owner>/<repo>/<commit-sha>/symbols/slotA_left/
  ```
  Click **Scan**. The builder fetches the listing, downloads each
  image, computes SHA-256 locally, and pre-populates the preview table.
- Click **Apply**. Every image is registered in `assets.images`; the
  pool's `members[]` now lists them; `raw.githubusercontent.com` is
  added to `assets.allowed_hosts`.
- Repeat for `slotA_right`, `slotB_left`, `slotB_right`.

Tip: pin the URL to a full commit SHA, not a branch name. Branches
silently drift; commit SHAs are reproducible.

**2. Inputs + Responses**

Already seeded with `f` / `j` and two touchscreen buttons from the
blank-task template. Nothing to change.

**3. Trial template** (the timeline)

```
fixation (text, txt:+, 0–500 ms, extras.style=fix)
critical_stimulus (image, 500 ms anchored to fixation.end,
                   response_window_ms=2500, captures_response=true,
                   asset BLANK — overridden per type below)
isi (text, txt:+, anchored to critical_stimulus.end, 500±250 ms)
```

Leave `critical_stimulus.asset` empty on purpose — each stimulus type
fills it in. The **"Overridden by 4 types"** chip appears next to the
item id once you've set up the types.

**4. Stimulus types**

Four types, each with a per-item override on `critical_stimulus`:

| Type           | correct_response | critical_stimulus.asset     |
|----------------|------------------|------------------------------|
| `slotA_left`   | `left`           | `img:pool:slotA_left`        |
| `slotA_right`  | `right`          | `img:pool:slotA_right`       |
| `slotB_left`   | `left`           | `img:pool:slotB_left`        |
| `slotB_right`  | `right`          | `img:pool:slotB_right`       |

The asset field autocompletes `img:pool:<name>` once the pools are
declared.

**5. Timing**

Default `self_paced`, `iti_ms: 800`, `iti_jitter_ms: 100` is fine for
most forced-choice RT paradigms. See
`vendor/engine/docs/LLM_TASK_AUTHORING.md §12a` for per-paradigm
defaults.

**6. Blocks**

- **+ Add block** → `main`.
- `n_trials: 12`, `ordering: factorial_random`,
  `constraints: { max_type_repeat: 2, balanced: true }`.
- **types**: tick all four.
- `feedback_enabled: true` if the trial template has a feedback item.

**7. Validate + export**

Switch to **Validation** (`⌘/Ctrl+/`). All errors resolved? Click
**Export** (`⌘/Ctrl+E`). The JSON downloads as
`<task_id>.json`.

---

## Running the exported task in the engine

```bash
cp ~/Downloads/my_task.json \
   /path/to/cog-task-engine/tasks/default.json
```

Open the engine project in Godot, reload (the palette → "Reload
Current Project"), press F5. With `Main.debug_skip_warp = true` the
task runs end-to-end locally and the final payload prints to the
console.

For per-participant dispatch via WARP, leave the bundled default
alone and pass the task JSON in `config.task_definition` — see
`cog-task-engine/docs/FRD_Draft.md §3.8`.

---

## Feature tour

### Validation that matches the engine

The **Validation** panel runs the engine's cheap validator passes
locally on every edit, using identical error codes
(`asset_missing`, `empty_types`, `pool_too_small`, `unbalanced`,
`response_anchor_invalid`, ...). The top-of-panel banner shows a
live count; clicking jumps to the Validation panel with the full
list. Inline, affected form fields show the specific error message
under them.

Export is gated on zero errors (with a confirm-and-override path).

### Import / export

- **File picker** — single-file import.
- **Drag-drop** — drop a `.json` anywhere on the window before a
  task is loaded.
- **Paste JSON** — toolbar button opens a modal with a textarea.
- **Canonical export** — JSON keys emit in a stable, diff-friendly
  order matching the engine's hand-edited fixtures. Unknown keys
  round-trip intact.
- Drafts auto-save to `localStorage`.

### Asset pools from a folder

On every pool row, **Generate from folder...** opens a dialog with
two entry points:

- **Local folder**: `<input webkitdirectory>` enumerates images,
  slugifies filenames to valid ids, and offers bundled (res:// paths)
  or remote (URL + SHA-256 hashed in-browser).
- **GitHub URL scan**: paste a `raw.githubusercontent.com` folder
  URL. The builder hits GitHub's contents API, downloads each file,
  computes SHA-256. Applied to the pool in one click; the host is
  auto-added to `allowed_hosts`.

Both modes preview every row (id, path/URL, sha256) before Apply,
flag id collisions with existing images in amber, and auto-suffix
colliding ids (`_2`, `_3`, ...).

### Rename cascades

Renaming anything that other sections reference walks the whole
document:

- Image / audio / pool / stimulus-type / touchscreen-button / response
  label / text-style id renames cascade into every referring
  `asset`, `members[]`, `correct_response`, `types[]`, `extras.style`,
  etc.
- Trial-template item renames also rewrite `anchor` targets and
  stimulus-type per-item override keys.

### Override hints in the trial-template editor

Next to each item id: "Overridden by N type(s)" chip. Under each
overridable field (`asset`, `extras.style`, `extras.size_pct`,
`cases.correct`, etc.): a small blue hint naming the specific types
that override that field. Keeps the trial-template ↔ stimulus-types
relationship visible without having to hop tabs.

### Sticky timeline

The SectionHeader + timeline preview stay pinned at the top of the
Trial template panel while the item list scrolls under them — so the
**+ Add item** button and the timeline are always in reach for
longer templates.

### Keyboard shortcuts

| Combo           | Action                            |
|-----------------|-----------------------------------|
| `⌘/Ctrl+E`      | Export JSON (validator-gated)     |
| `⌘/Ctrl+/`      | Jump to Validation                |
| `Esc`           | Close the paste-import dialog     |

Drag-reorder in the trial template is keyboard-accessible via
`@dnd-kit`'s keyboard sensor (Tab to focus the drag handle, Space
to pick up, arrow keys to move, Space to drop).

---

## Development

```bash
npm install
npm run dev        # localhost:5173, HMR
npm run test       # vitest — ~120 tests
npm run typecheck  # tsc -b --noEmit
npm run build      # typecheck + vite build → dist/
```

Stack: Vite 5 + React 18 + TypeScript strict + Tailwind 3 + Zustand 4 +
Vitest 2 + `@dnd-kit/core`.

Architecture, invariants, and extension recipes live in
[`CLAUDE.md`](./CLAUDE.md) — read that before adding a new section
panel, validator rule, or rename cascade.

### Repo layout

```
src/
  actions/             pure (task, ...args) → task mutators
                       + cascades.ts (8 rename cascades)
  components/
    primitives/        Field, TextField, NumberField, Toggle, Select,
                       KeyedList, MultiSelect, AssetRefPicker,
                       CommaListField
    sections/          one panel per task-JSON section + Validation +
                       Help + TimelineView
    Shell, Toolbar, PasteImportDialog, ImportDropZone,
    GenerateFromFolderDialog, ValidationBanner, JsonPreview
  defaults/            newTask() factory
  hooks/               useKeyboardShortcuts
  serde/               import / export / canonicalize / keyOrder
  store/               Zustand + persist → localStorage
  types/               TS types for schema 1.1.0
  utils/               slugify, sha256, githubFolder, overrides
  validator/           client-side pure validator + server wrapper +
                       React hooks
test/                  vitest; fixtures/ mirrors
                       vendor/engine/tasks/examples/
vendor/engine/         git submodule → cog-task-engine
                       (spec + canary fixtures)
```

### Engine submodule

`vendor/engine/` pins a specific commit of cog-task-engine. To update:

```bash
git submodule update --remote vendor/engine
# Then re-sync test/fixtures/ from vendor/engine/tasks/examples/ if
# the engine's canary set changed, and bump the vendor pin in the
# commit message.
```

Any validator or schema change in the engine must be mirrored here —
see `CLAUDE.md` → "How to extend" → "Add a new validator check".

---

## Troubleshooting

### The task "validates clean" but the engine rejects it

Likely you're on an older commit of the validator and the engine
added a new check. Bump the `vendor/engine` submodule pin and re-run
`npm run test` — the "fixtures should be clean" loop flags any
over-reporting, and targeted tests cover each engine error code.

### `no_task_definition` on engine startup

`schema/TaskLoader.gd` looks for a task in this order: WARP inline →
WARP URL (v1: unsupported) → `res://tasks/default.json` → `--task-def=`
CLI arg. For local testing, copy the exported JSON to
`cog-task-engine/tasks/default.json` and reload the Godot project so
ResourceLoader picks it up.

### "Computing SHA-256..." hangs on a large folder

The hasher runs sequentially per file to avoid pinning the whole
folder in memory. A 200-image folder of ~500 KB each takes a few
seconds. The progress indicator shows live counts; if it genuinely
stalls, check the browser devtools for fetch failures (download URL
404, CORS) or SubtleCrypto errors.

### GitHub scan returns "Rate-limited by GitHub"

Anonymous GitHub API is capped at ~60 requests/hour per IP (one list
+ N downloads). Wait an hour or mirror the folder to a CDN / S3
bucket with an index that the builder can parse (currently
GitHub-only — see `src/utils/githubFolder.ts`).

### Draft disappeared after a reload

Only `localStorage` is consulted. Check devtools → Application →
Local Storage for the key `cog-task-builder:v1`. The persist
middleware's `version: 1` field protects against breaking-shape
changes — if you see a version mismatch, the stored draft is
intentionally discarded (a `migrate` callback would be the way to
carry it forward; see `CLAUDE.md`).

---

## Contributing

- Every PR that adds a UI-visible behavior should add a test — pure
  actions go in `test/<section>.test.ts`; validator rules in
  `test/validator.test.ts`.
- Never drop unknown keys on round-trip. The
  `test/unknown_keys.test.ts` and the recursive-canonical-order test
  are load-bearing.
- If you add a new reference between sections, the 8 rename cascades
  grow to 9 — update `src/actions/cascades.ts` and its tests.
- Error codes are the engine's, never invented locally. If a check
  doesn't fit an existing code, open an issue on
  [cog-task-engine](https://github.com/SympatiCog/cog-task-engine)
  first.

See [`CLAUDE.md`](./CLAUDE.md) for the full extension guide.

---

## License

TBD — see `vendor/engine/` for the engine's license; the builder
follows the same terms unless otherwise noted.
