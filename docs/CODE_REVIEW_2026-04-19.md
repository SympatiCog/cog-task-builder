# Code review — cog-task-builder

**Date:** 2026-04-19
**Reviewer context:** full-quality review run via `/octo:review`. Priorities per the reviewer brief: correctness → maintainability → test coverage. Audience: author (self-improvement, not a release gate).

**Reviewed:** 58 source files + 14 test files under `src/` and `test/`. 120 tests pass. Cross-referenced against `vendor/engine/schema/SchemaValidator.gd` and `vendor/engine/docs/LLM_TASK_AUTHORING.md`.

**Summary:** nothing is a release blocker given the audience, but findings 1–8 are real divergences from the engine's behavior and violate `CLAUDE.md`'s own "error codes match engine verbatim" invariant. Rename cascades, canonical-order + unknown-key round-trip contracts, and input-handling safety are all intact.

---

## P0 — Correctness bugs (do these first)

### 1. Validator accepts `.start` anchor axis; engine rejects it

`src/validator/index.ts:17` declares `VALID_ANCHOR_AXES = new Set(["start", "end", "response"])`, and `src/components/sections/TrialTemplatePanel.tsx:403` offers `${it.id}.start` in the anchor picker. The engine's `schema/SchemaValidator.gd:639` checks `if axis not in ["end", "response"]` and emits `invalid_anchor_axis`. `LLM_TASK_AUTHORING.md §7.3` documents only `trial_start`, `.end`, `.response`.

**Impact:** a task authored with a `.start` anchor passes client validation, exports, then fails when the engine loads it.

**Fix:**
```ts
const VALID_ANCHOR_AXES = new Set(["end", "response"]);
```
Drop the `.start` option from `TrialTemplatePanel.tsx:403`. Add a test case.

---

### 2. `unknown_label` used where engine emits `unknown_type`

`src/validator/index.ts:534` fires `unknown_label` for a block's `types[]` entry that isn't a declared stimulus type. The engine (`SchemaValidator.gd:791`) emits `unknown_type` for the same condition. Violates CLAUDE.md's "error codes match the engine verbatim" invariant.

**Fix:** rename the code at that site to `unknown_type`. Update the relevant test case.

---

### 3. Missing entire pass 4 — remote-asset checks

`SchemaValidator.gd:519–551` checks remote assets for:
- `missing` on `url`, `sha256`
- `non_https` on URL
- `host_not_whitelisted` on URL host
- `missing` on `allowed_hosts` when any source is remote

None of these are in `src/validator/index.ts`. The AssetsPanel's inline UI checks some of them but emits free-text messages, not validator codes — so the Validation panel silently accepts a broken remote-asset task.

**Impact:** exported task validates clean client-side, fails at engine runtime. This is exactly the class of bug the "empty_types" / "asset_missing" additions were meant to close.

**Fix:** port `_check_remote_assets` as a new pass. ~50 lines.

---

### 4. Missing `unknown_kind` check

`SchemaValidator.gd:681–692` validates `item.kind ∈ {image,text,audio,feedback,blank}`. `src/validator/index.ts` relies on the TS union type — but imported JSON with `kind: "video"` slips through the shape check unflagged.

**Fix:** add a pass. ~10 lines.

---

### 5. Missing block-level checks

`SchemaValidator.gd:772–792` (`_check_blocks`) emits:
- `missing` when `ordering` is absent
- `invalid_ordering` when ordering isn't in the valid set
- `missing` when `n_trials <= 0` for factorial_random/fixed

`src/validator/index.ts:524` does none of these three. It only checks types membership + unbalanced + csv-source.

**Impact:** a block with no `ordering` field or `n_trials: 0` passes client validation.

**Fix:** extend `checkBlocks`. ~15 lines.

---

### 6. Validator doesn't early-return on broken shape

Engine's `validate()` at `SchemaValidator.gd:31-32`:
```gdscript
_check_shape(task, r)
if not r.ok():
    return r  # further passes assume basic shape is present
```

`src/validator/index.ts:32` only early-returns on `schema_too_new`. If someone imports `{stimulus_types: [1,2,3]}` (array not object), `checkShape` fires `wrong_type`, then `checkIdentifiers` runs `Object.keys(task.stimulus_types)` → `["0","1","2"]` → three spurious `invalid_identifier` errors.

**Impact:** noisy cascading errors on malformed imports. Confusing for authors.

**Fix:**
```ts
checkShape(task, r);
if (r.errors.length > 0) return r;
```

---

### 7. Missing `non_constant_expression` warning

`SchemaValidator.gd:797–809` warns on expression-form `correct_response` (v2 feature; v1 evaluates literals only). `src/validator/index.ts:358` fires `missing` when `correct_response` isn't a string — wrong code when the value is a Dictionary. Should be `non_constant_expression` warning.

---

### 8. Missing `duplicate` check on touchscreen button ids

`SchemaValidator.gd:697–715` catches duplicate button ids. Builder's InputsPanel auto-generates unique ids so UI-authored tasks are fine, but imported JSON with duplicates passes. ~15 lines to port.

---

## P1 — Other correctness notes

### 9. `stimulus_types.*.items.<id>` check uses a code the engine doesn't emit

`src/validator/index.ts:378` fires `unknown_label` when a stimulus type's `items` key doesn't match any `trial_template` id. The engine has no such check. This IS a useful check (catches a real authoring bug — the override is silently ignored at runtime), but the code is invented. Either:
- Propose the check upstream in the engine with a dedicated code like `unknown_item_override`, then sync.
- Or document it as a builder-only code in `CLAUDE.md`.

### 10. `checkAssetCoverage` miscounts `csv`-via-URL types

`src/validator/index.ts:568-573` collects "used types" from `block.types` + `block.trial_list[].type`. Correct for inline. But when a block has `ordering: "csv"` with `trial_list_url`, the types are only known at runtime — `checkAssetCoverage` will miss them, possibly under-reporting `asset_missing`. Low impact (csv-via-URL is rare in v1 authoring), but worth a code comment and a test that documents the limitation.

---

## P2 — Test coverage gaps

### 11. No test for broken-shape early-return

Once P0#6 lands:
```ts
it("early-returns on shape violations", () => {
  const r = validate({ schema_version: "1.1.0", stimulus_types: [1, 2] } as any);
  expect(r.errors.some(e => e.code === "wrong_type")).toBe(true);
  expect(r.errors.some(e => e.code === "invalid_identifier")).toBe(false);
});
```

### 12. `serverValidate` fetch path untested

`src/validator/serverValidate.ts:26-56` — the `fetch` path exists for production use but has no test. A `vi.mock(fetch, ...)` test covering (a) happy-path JSON, (b) HTTP error, (c) network error, (d) malformed response → `normalize()` fallback, would be ~30 lines and guard against regressions.

### 13. GitHub scan live path untested end-to-end

`src/utils/githubFolder.ts:71` `scanGitHubRawFolder` — only parser + MIME guesser are tested. The listing → download → hash pipeline isn't. A mocked-`fetch` test covering listing success + download success + one download failure would lock the progress-reporting contract.

### 14. Validator fixture-clean loop doesn't exercise P0-bug fixtures

Once P0 fixes land, the `validator: engine fixtures should be clean` loop still only tests 4 known-clean fixtures. The inline-test regression fixtures (`broken_empty_types`, `broken task once types are populated`) are good but synthetic. Consider copying a validated real task (the slotA task once fixed) into `test/fixtures/` as a fifth canary.

---

## P3 — Maintainability

### 15. `TrialTemplatePanel.tsx` is 479 lines

Mixes five concerns: the sortable list, `SortableItem`, `TrialItemEditor` (~250 lines of form fields), `OverrideHint`, `AnchorPicker`, `FeedbackCasesEditor`. Split into:

```
src/components/sections/trial-template/
  TrialTemplatePanel.tsx    (~100 lines: outer panel + DndContext)
  SortableItem.tsx          (~25 lines)
  TrialItemEditor.tsx       (~200 lines)
  AnchorPicker.tsx          (~40 lines)
  FeedbackCasesEditor.tsx   (~55 lines)
  OverrideHint.tsx          (~20 lines)
```

No behavior change; diffs become readable.

### 16. `GenerateFromFolderDialog.tsx` is 409 lines

Extract `<PreviewTable>` (~40 lines) and `<GitHubScanSection>` (~50 lines) components. The main dialog drops to ~300 lines. Moderate improvement.

### 17. Rename-id-on-blur pattern duplicated

Same draft-state + `onBlur` + `Enter commits` + `Escape reverts` pattern in:
- `KeyedList.tsx:80` (KeyedRow) — already extracted here; others don't reuse it
- `TrialTemplatePanel.tsx:204`
- `BlocksPanel.tsx:109`

Extract a `<CommitTextInput>` primitive (`src/components/primitives/CommitTextInput.tsx`, ~40 lines) and route both panels through it. Kills ~60 lines of duplicated state-and-handler logic.

### 18. Verbose narrowing casts in validator pools section

`src/validator/index.ts:197-210` has 8 instances of `(p as { kind?: unknown })` for the same `p`. Extract once:
```ts
const pool = p as Partial<Pool> & Record<string, unknown>;
```
Then `pool.kind`, `pool.share_across_types`, `pool.members` without the re-cast noise.

### 19. Dead code: `issueClass` in `hooks.ts`

`src/validator/hooks.ts:30` — `issueClass` is exported but never imported anywhere. Delete.

### 20. Comments on trivial pure functions

Violates the "no comments unless WHY is non-obvious" rule:

- `src/utils/sha256.ts:6` — three-line comment on `sha256File` saying "computes SHA-256 of a File's bytes…" — obvious from name + signature. Trim to 1 line about the specific reason for sequential hashing (memory) or drop entirely.
- `src/actions/poolFolder.ts:11-19` — 9-line walk-through of steps 1–3 that are obvious from code. Keep the last sentence ("Pure: takes and returns TaskJson without mutation") and drop the enumeration.
- `src/defaults/newTask.ts:3-9` — 7 lines explaining what a blank task factory is. Trim to the one non-obvious sentence about "validator will still flag incomplete fields — this is a starting point".

### 21. Outdated / inaccurate claims in `CLAUDE.md` and `README.md`

**CLAUDE.md:**
- "Validator error codes match the engine verbatim" — contradicted by findings P0#1, P0#2, P0#7. Update after fixes land.
- "Use the primitives under `components/primitives/` — don't hand-roll `<input>`" — contradicted by TrialTemplatePanel and BlocksPanel rename fields (P3#17). Either fix the sections or loosen the claim to "use primitives where possible; the rename-id idiom is a shared exception pending extraction."

**README.md:**
- "~120 tests currently pass" — matches reality today. Keep accurate as tests land.

---

## Prioritized summary

| # | Item | File:line | Impact |
|---|------|-----------|--------|
| P0-1 | Drop `.start` from axes + anchor picker | `validator/index.ts:17`, `TrialTemplatePanel.tsx:403` | Wrong-task exports |
| P0-3 | Port `_check_remote_assets` | `validator/index.ts` (+new pass) | Wrong-task exports |
| P0-6 | Early-return on shape failure | `validator/index.ts:32` | Noisy errors |
| P0-2, P0-5, P0-7, P0-8, P0-4 | Error-code + missing-code fixes | `validator/index.ts:534` + ~4 new passes | Wrong codes / silent miss |
| P1-9, P1-10 | Document builder-only codes + csv-URL caveat | `validator/index.ts` + `CLAUDE.md` | Clarity |
| P2-11…14 | Fill test gaps | `test/validator.test.ts`, new `test/serverValidate.test.ts`, `test/githubFolder.test.ts` | Guard future drift |
| P3-15, P3-16 | Split `TrialTemplatePanel` + `GenerateFromFolderDialog` | new subdirs | Maintainability |
| P3-17 | Extract `<CommitTextInput>` primitive | new primitives file | Maintainability |
| P3-18, P3-19, P3-20 | Type narrowing cleanup, delete dead code, trim docstrings | various | Readability |
| P3-21 | Sync `CLAUDE.md` + `README.md` with actual state after fixes | both | Doc accuracy |

**Estimated effort:** P0 cluster ~1 focused session (2–3 hours incl. tests); P2 another ~1 session; P3 split-and-extract refactors another ~1 session. All independent — no dependency chain.

---

## What the review did NOT find (intentionally flagged as clean)

- **Rename cascades** are complete for v1.1. All 8 cross-ref rules covered, including the trial-item rename's anchor + items-key rewrite.
- **Canonical-order and unknown-key round-trip** contracts hold. Every fixture in `test/fixtures/` validates clean and round-trips through `canonicalize.ts` byte-stably after import.
- **No security issues** in input handling: BOM-strip + type guards on `src/serde/import.ts`; no eval, no dangerouslySetInnerHTML, no SSR surface.
- **No obvious React re-render traps:** Zustand selectors narrow cleanly; `useMemo` deps are honest.
