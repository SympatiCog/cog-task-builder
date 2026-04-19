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
HTTP wrapper for authoritative validation (the full validator pass list
is in the engine's `docs/FRD_Draft.md §5.2`):

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

## How timing works

Reaction-time paradigms live or die by timing precision. The short
version: **the display is the clock.** Everything else flows from
that.

### The display is the clock

Browsers (and Godot exported to HTML5) draw frames in lockstep with
the monitor's vertical sync. A 60 Hz display ticks once every 16.666…
ms; a 120 Hz display every 8.333… ms; a 144 Hz display every 6.944 ms.
The engine can't show a stimulus for 50 ms on a 60 Hz display — it can
only show it for whole-frame multiples near 50 ms (48 ms = 3 frames,
67 ms = 4 frames, etc.). Every duration you author is really a request
for "show this for approximately *N* frames on the actual display."

### Refresh-rate quantization at runtime

The engine's `FrameClock` measures the participant's display rate at
startup (`refresh_hz_measured`). Every authored `_ms` value is then
converted to an integer frame count via
`round(ms × refresh_hz / 1000)`. Presentation is frame-locked to that
count — not to a wall-clock deadline. This avoids drift from tab
throttling, background-tab pauses, and OS-scheduler jitter.

### What the builder does: 60 Hz reference snapping

Every ms field in the builder **snaps to the nearest multiple of
1/60 s (≈ 16.67 ms) on blur.** A hint below each field shows the
frame count at the 60 Hz reference:

- `duration_ms: 100` → `= 6 frames @ 60 Hz` (exact)
- `duration_ms: 250` → `= 15 frames @ 60 Hz` (exact)
- `duration_ms: 50` → `= 3 frames @ 60 Hz` (exact)
- `duration_ms: 17` → `≈ 1 frame @ 60 Hz` (snapped from 17 → 16.67)
- `duration_ms: 500` → `= 30 frames @ 60 Hz` (exact)

60 Hz is the authoring reference because it's the lowest-common
denominator for consumer displays. Authoring at a frame-aligned value
keeps the request "honest" — you're asking for an exact frame count
on a 60 Hz display, and the engine will re-quantize cleanly on faster
displays.

### Worst-case timing error

For an authored `100 ms` duration on a representative set of displays:

| Display rate | Frame period | Frames chosen | Actual       | Error    |
|--------------|--------------|---------------|--------------|----------|
| 60 Hz        | 16.67 ms     | 6             | 100.00 ms    | 0        |
| 90 Hz        | 11.11 ms     | 9             | 100.00 ms    | 0        |
| 120 Hz       | 8.33 ms      | 12            | 100.00 ms    | 0        |
| 75 Hz        | 13.33 ms     | 8 (7.5 → 8)   | 106.67 ms    | +6.67 ms |
| 144 Hz       | 6.94 ms      | 14 (14.4 → 14)| 97.22 ms     | −2.78 ms |

Worst-case error on any common display is bounded by **±½ frame** of
the actual refresh rate. At 60 Hz that's ±8.33 ms; at 144 Hz, ±3.47 ms.
These errors are deterministic per display — they don't drift across
trials — so within-subject comparisons stay unbiased even if absolute
ms values differ slightly from what was authored.

### What isn't controlled

Frame-locked timing guarantees the *stimulus* onset/offset land on
display frames. It does **not** control:

- **Input timing.** Keyboard and touchscreen events land on the
  browser's event loop, subject to OS / browser queuing. The engine
  timestamps responses at the next frame — response-time resolution
  is ~1 display frame, not sub-ms.
- **Perceptual latency.** LCD pixel-response times (4–20 ms typical)
  sit between the frame buffer flip and the photons reaching the eye.
  The engine can't compensate for this; budget for it in your
  paradigm design.
- **Audio.** Web Audio latency varies wildly across browsers and
  devices (~20–150 ms). Don't anchor critical timing to audio onsets
  without offline calibration.
- **Dropped frames.** The engine logs every drop to
  `timing_quality.dropped_frames_total` in the payload. Filter trials
  with drops in analysis if your paradigm is timing-sensitive.

### Engine invariants worth knowing

- `FrameClock.frame_number` is the canonical time axis — every event
  is logged as a frame number, not a wall-clock time. Analysis
  reconstructs real time by multiplying by `frame_period_us`.
- Page-visibility pauses (tab hide) freeze the event queue via
  `PageVisibility`; resumed trials pick up where they left off
  without inflating reported RTs.
- `min_refresh_hz` on the task metadata rejects displays below that
  threshold at startup — use it when your paradigm genuinely breaks
  on a 30 Hz / 50 Hz display.

See `cog-task-engine/docs/FRD_Draft.md §6` for the engine's full
timing spec.

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
  URL" field (if you haven't hosted yours yet, see the
  **Getting a GitHub URL for your stimuli** section below):
  ```
  https://raw.githubusercontent.com/<owner>/<repo>/<commit-sha>/symbols/slotA_left/
  ```
  Click **Scan**. The builder fetches the listing, downloads each
  image, computes SHA-256 locally, and pre-populates the preview table.
- Click **Apply**. Every image is registered in `assets.images`; the
  pool's `members[]` now lists them; `raw.githubusercontent.com` is
  added to `assets.allowed_hosts`.
- Repeat for `slotA_right`, `slotB_left`, `slotB_right`.

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

### Getting a GitHub URL for your stimuli

The scan expects a URL of this shape:

```
https://raw.githubusercontent.com/<owner>/<repo>/<commit-sha>/<path>/<folder>/
```

To get one for your own data:

**1. Host the folder on GitHub.** Create a public repo (private repos
won't work — the builder's fetch is anonymous), push your images, and
note the latest commit SHA:

```bash
cd path/to/my-stimuli
git init
git add symbols/            # your images
git commit -m "Initial stimulus set"
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
git rev-parse HEAD          # prints the commit SHA you'll need below
```

**2. Construct the raw URL.** The easy way from the GitHub UI:

1. Open the repo on github.com, navigate to the folder you want.
2. Click any image in it, then click **Raw** (top-right). Your browser
   lands on a URL like:
   ```
   https://raw.githubusercontent.com/<owner>/<repo>/main/symbols/slotA_left/slotA_left_12.png
   ```
3. Delete the filename from the end so you're left with the folder URL
   (trailing `/` recommended but not required):
   ```
   https://raw.githubusercontent.com/<owner>/<repo>/main/symbols/slotA_left/
   ```
4. Replace `main` with the commit SHA from step 1 (copy it from
   `git rev-parse HEAD` output, or from the commit page on github.com —
   click the commit hash next to "Latest commit" and the URL bar shows
   the full 40-char SHA):
   ```
   https://raw.githubusercontent.com/<owner>/<repo>/<commit-sha>/symbols/slotA_left/
   ```

That's the URL to paste into the scanner.

**Why commit SHA, not branch?** Branch-pinned URLs (`main`, `master`)
work for scanning today, but the task JSON will embed those URLs
verbatim. Any future push to the branch changes what the engine fetches
at runtime — silently. Commit SHAs are immutable; they guarantee the
participant sees the exact stimulus set you validated against. If you
add new stimuli, generate a new task JSON pinned to the new commit and
treat it as a new task version.

**URL forms that WILL NOT work**, and why:

| URL form | Problem |
|---|---|
| `https://github.com/.../blob/<ref>/...` | The HTML preview page, not the file bytes. SHA-256 won't match. |
| Any 302 redirect to a different host | The engine has `max_redirects = 0`. Use the canonical raw URL directly. |
| Branch URLs (`<ref>` = `main`) | Works but drifts — see above. |
| Private repos | Anonymous fetch returns 404. Mirror the files to a public repo or a CDN. |

**Rate limit.** Anonymous GitHub API allows ~60 requests/hour per IP
(one listing + N downloads per scan). For a lab with many concurrent
authors behind a shared IP, mirror stimuli to a CDN.

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
npm run test       # vitest — ~140 tests
npm run typecheck  # tsc -b --noEmit
npm run build      # typecheck + vite build → dist/
```

Stack: Vite 5 + React 18 + TypeScript strict + Tailwind 3 + Zustand 4 +
Vitest 2 + `@dnd-kit/core`.

Architecture, invariants, and extension recipes live in `CLAUDE.md` —
read that before adding a new section panel, validator rule, or rename
cascade.

### Repo layout

```
src/
  actions/             pure (task, ...args) → task mutators
                       + cascades.ts (8 rename cascades)
  components/
    primitives/        Field, TextField, NumberField, MsNumberField,
                       Toggle, Select, KeyedList, MultiSelect,
                       AssetRefPicker, CommaListField, CommitTextInput
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
- Error codes are the engine's, never invented locally. There is one
  documented site where the builder re-uses `unknown_label` on a check
  the engine doesn't run (the `stimulus_types.<type>.items.<id>`
  consistency check — see `CLAUDE.md`). If a check doesn't fit an
  existing code, open an issue on
  [cog-task-engine](https://github.com/SympatiCog/cog-task-engine)
  first.

See `CLAUDE.md` for the full extension guide.

---

## License

TBD — see `vendor/engine/` for the engine's license; the builder
follows the same terms unless otherwise noted.
