import type { TaskJson } from "../types/task";

export interface ValidationIssue {
  path: string; // dotted JSONPath-ish, e.g. "metadata.task_id", "trial_template[0].asset"
  code: string; // matches engine SchemaValidator.gd error codes
  message: string;
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const MAX_SCHEMA = "1.1.0";
const ID_RE = /^[a-z0-9_]+$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const VALID_ANCHOR_AXES = new Set(["end", "response"]);

// Pure-functional port of the engine's SchemaValidator cheap passes. Error
// codes are verbatim from LLM_TASK_AUTHORING.md §10 so client- and server-
// side reports are directly interchangeable. Passes we DON'T run client-side:
//   - pass 9 csv-schedule collision detection (engine stub)
//   - remote-asset SHA-256 byte verification (engine runtime)
// Everything else is here.
export function validate(task: TaskJson | null | undefined): ValidationReport {
  const r: ValidationReport = { errors: [], warnings: [] };
  if (!task || typeof task !== "object") {
    r.errors.push({ path: "$", code: "wrong_type", message: "Task must be an object." });
    return r;
  }
  checkShape(task, r);
  // Engine (`SchemaValidator.gd:31-32`) early-returns on any shape error —
  // later passes assume basic shape is present. Without this, malformed
  // imports (e.g. stimulus_types as an array) cascade into noisy spurious
  // errors in identifier + downstream passes.
  if (r.errors.length > 0) return r;
  checkIdentifiers(task, r);
  checkKinds(task, r);
  checkTouchscreenButtons(task, r);
  checkPools(task, r);
  checkRemoteAssets(task, r);
  checkAssetRefs(task, r);
  checkResponses(task, r);
  checkStimulusTypes(task, r);
  checkCaptureUniqueness(task, r);
  checkAnchors(task, r);
  checkTiming(task, r);
  checkBlocks(task, r);
  checkAssetCoverage(task, r);
  checkPoolSizeBounds(task, r);
  return r;
}

function err(r: ValidationReport, path: string, code: string, message: string) {
  r.errors.push({ path, code, message });
}
function warn(r: ValidationReport, path: string, code: string, message: string) {
  r.warnings.push({ path, code, message });
}

// --- Pass 1: shape + schema version ---

function checkShape(task: TaskJson, r: ValidationReport): void {
  if (typeof task.schema_version !== "string") {
    err(r, "schema_version", "missing", "schema_version is required.");
  } else if (!VERSION_RE.test(task.schema_version)) {
    err(r, "schema_version", "schema_version_invalid", "Must be MAJOR.MINOR.PATCH.");
  } else if (compareVersion(task.schema_version, MAX_SCHEMA) > 0) {
    err(
      r,
      "schema_version",
      "schema_too_new",
      `Engine supports up to ${MAX_SCHEMA}; task declares ${task.schema_version}.`,
    );
  }

  const required: Array<[keyof TaskJson, string]> = [
    ["metadata", "object"],
    ["assets", "object"],
    ["inputs", "object"],
    ["responses", "object"],
    ["stimulus_types", "object"],
    ["trial_template", "array"],
    ["timing", "object"],
    ["blocks", "array"],
  ];
  for (const [key, kind] of required) {
    const v = task[key];
    if (v === undefined) {
      err(r, String(key), "missing", `${String(key)} is required.`);
      continue;
    }
    if (kind === "object" && (typeof v !== "object" || Array.isArray(v) || v === null)) {
      err(r, String(key), "wrong_type", `${String(key)} must be an object.`);
    }
    if (kind === "array" && !Array.isArray(v)) {
      err(r, String(key), "wrong_type", `${String(key)} must be an array.`);
    }
  }

  if (task.trial_template !== undefined && Array.isArray(task.trial_template) && task.trial_template.length === 0) {
    err(r, "trial_template", "missing", "trial_template must be non-empty.");
  }
  if (task.blocks !== undefined && Array.isArray(task.blocks) && task.blocks.length === 0) {
    err(r, "blocks", "missing", "At least one block is required.");
  }

  if (task.metadata && typeof task.metadata === "object") {
    if (!task.metadata.task_id) err(r, "metadata.task_id", "missing", "task_id is required.");
    if (!task.metadata.task_version) err(r, "metadata.task_version", "missing", "task_version is required.");
  }
}

function compareVersion(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// --- Pass 2: identifiers ---

function checkIdentifiers(task: TaskJson, r: ValidationReport): void {
  if (task.metadata?.task_id) {
    checkId(task.metadata.task_id, "metadata.task_id", r);
  }

  const tplIds = new Set<string>();
  if (Array.isArray(task.trial_template)) {
    task.trial_template.forEach((it, i) => {
      if (!it || typeof it !== "object") return;
      const id = (it as { id?: string }).id;
      if (id === undefined) {
        err(r, `trial_template[${i}].id`, "missing", "item id is required.");
        return;
      }
      checkId(id, `trial_template[${i}].id`, r);
      if (tplIds.has(id)) err(r, `trial_template[${i}].id`, "duplicate", `item id '${id}' is not unique.`);
      tplIds.add(id);
    });
  }

  if (task.stimulus_types && typeof task.stimulus_types === "object") {
    for (const id of Object.keys(task.stimulus_types)) {
      checkId(id, `stimulus_types.${id}`, r);
    }
  }

  if (Array.isArray(task.blocks)) {
    const blockIds = new Set<string>();
    task.blocks.forEach((b, i) => {
      const id = (b as { id?: string })?.id;
      if (!id) {
        err(r, `blocks[${i}].id`, "missing", "block id is required.");
        return;
      }
      checkId(id, `blocks[${i}].id`, r);
      if (blockIds.has(id)) err(r, `blocks[${i}].id`, "duplicate", `block id '${id}' is not unique.`);
      blockIds.add(id);
    });
  }

  if (task.assets?.images) {
    for (const id of Object.keys(task.assets.images)) {
      checkId(id, `assets.images.${id}`, r);
    }
  }
  if (task.assets?.audio) {
    for (const id of Object.keys(task.assets.audio)) {
      checkId(id, `assets.audio.${id}`, r);
    }
  }
  if (task.assets?.pools) {
    for (const name of Object.keys(task.assets.pools)) {
      checkId(name, `assets.pools.${name}`, r);
    }
  }
}

function checkId(value: string, path: string, r: ValidationReport): void {
  if (!ID_RE.test(value)) {
    err(r, path, "invalid_identifier", `'${value}' must match ^[a-z0-9_]+$.`);
  }
}

// --- Pass 2b: trial-item kind allowlist (engine pass 7b) ---

const ALLOWED_KINDS = new Set(["image", "text", "audio", "feedback", "blank"]);

function checkKinds(task: TaskJson, r: ValidationReport): void {
  if (!Array.isArray(task.trial_template)) return;
  task.trial_template.forEach((it, i) => {
    if (!it || typeof it !== "object") return;
    const kind = (it as { kind?: unknown }).kind;
    if (kind === undefined || kind === null || kind === "") {
      err(r, `trial_template[${i}].kind`, "missing", "kind is required.");
      return;
    }
    if (typeof kind !== "string" || !ALLOWED_KINDS.has(kind)) {
      err(
        r,
        `trial_template[${i}].kind`,
        "unknown_kind",
        `kind '${String(kind)}' is not one of image | text | audio | feedback | blank.`,
      );
    }
  });
}

// --- Pass 2c: touchscreen button id uniqueness (engine pass 7c) ---

function checkTouchscreenButtons(task: TaskJson, r: ValidationReport): void {
  const btns = task.inputs?.touchscreen_buttons;
  if (!Array.isArray(btns)) return;
  const seen = new Set<string>();
  btns.forEach((b, i) => {
    if (!b || typeof b !== "object") return;
    const id = (b as { id?: unknown }).id;
    if (typeof id !== "string" || id === "") return; // identifier pass handles shape
    if (seen.has(id)) {
      err(
        r,
        `inputs.touchscreen_buttons[${i}].id`,
        "duplicate",
        `touchscreen button id '${id}' is not unique.`,
      );
    }
    seen.add(id);
  });
}

// --- Pass 3: pools (schema 1.1) ---

function checkPools(task: TaskJson, r: ValidationReport): void {
  const pools = task.assets?.pools;
  if (!pools) return;
  if (typeof pools !== "object" || Array.isArray(pools)) {
    err(r, "assets.pools", "wrong_type", "assets.pools must be an object.");
    return;
  }
  for (const [name, p] of Object.entries(pools)) {
    const path = `assets.pools.${name}`;
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      err(r, path, "wrong_type", "pool definition must be an object.");
      continue;
    }
    if ((p as { kind?: unknown }).kind !== "image") {
      err(
        r,
        `${path}.kind`,
        "unsupported_pool_kind",
        `Only kind: "image" is supported (got ${(p as { kind?: unknown }).kind}).`,
      );
    }
    if ((p as { share_across_types?: unknown }).share_across_types !== undefined &&
        typeof (p as { share_across_types?: unknown }).share_across_types !== "boolean") {
      err(r, `${path}.share_across_types`, "wrong_type", "share_across_types must be a boolean.");
    }
    const members = (p as { members?: unknown }).members;
    if (!Array.isArray(members) || members.length === 0) {
      err(r, `${path}.members`, "pool_empty", "members must be a non-empty array.");
      continue;
    }
    const seen = new Set<string>();
    members.forEach((m, j) => {
      if (typeof m !== "string") {
        err(r, `${path}.members[${j}]`, "pool_member_wrong_type", "member must be a string id.");
        return;
      }
      if (!task.assets?.images || !(m in task.assets.images)) {
        err(r, `${path}.members[${j}]`, "pool_member_missing", `'${m}' is not declared in assets.images.`);
      }
      if (seen.has(m)) {
        warn(r, `${path}.members[${j}]`, "pool_member_duplicated", `'${m}' is listed more than once.`);
      }
      seen.add(m);
    });
  }
}

// --- Pass 3b: remote assets (engine pass 4) ---
//
// Remote entries need an https URL whose host is whitelisted and a sha256
// digest. If any asset in images/audio declares source:"remote",
// allowed_hosts must be non-empty.

function extractHost(url: string): string {
  if (!url.startsWith("https://")) return "";
  const afterScheme = url.slice("https://".length);
  const hostAndPort = afterScheme.split("/")[0].split("?")[0].split("#")[0];
  if (hostAndPort.includes("@")) return ""; // userinfo in authority — reject
  return hostAndPort.split(":")[0];
}

function checkRemoteAssets(task: TaskJson, r: ValidationReport): void {
  const assets = task.assets;
  if (!assets || typeof assets !== "object") return;
  const allowedHosts = Array.isArray(assets.allowed_hosts) ? assets.allowed_hosts : [];
  let anyRemote = false;

  for (const kind of ["images", "audio"] as const) {
    const bucket = assets[kind];
    if (!bucket || typeof bucket !== "object") continue;
    for (const [id, spec] of Object.entries(bucket)) {
      if (!spec || typeof spec !== "object") continue;
      const src = (spec as { source?: unknown }).source;
      if (src !== "remote") continue;
      anyRemote = true;
      const urlPath = `assets.${kind}.${id}.url`;
      const shaPath = `assets.${kind}.${id}.sha256`;
      const url = (spec as { url?: unknown }).url;
      const sha = (spec as { sha256?: unknown }).sha256;
      if (typeof url !== "string" || url === "") {
        err(r, urlPath, "missing", "remote asset requires a url.");
      } else if (!url.startsWith("https://")) {
        err(r, urlPath, "non_https", "remote asset url must use https://.");
      } else {
        const host = extractHost(url);
        if (!allowedHosts.includes(host)) {
          err(r, urlPath, "host_not_whitelisted", `host '${host}' is not in assets.allowed_hosts.`);
        }
      }
      if (typeof sha !== "string" || sha === "") {
        err(r, shaPath, "missing", "remote asset requires a sha256 digest.");
      }
    }
  }

  if (anyRemote && allowedHosts.length === 0) {
    err(
      r,
      "assets.allowed_hosts",
      "missing",
      "allowed_hosts is required when any asset source is 'remote'.",
    );
  }
}

// --- Pass 4: asset-ref parsing ---

function parseAssetRef(ref: string):
  | { kind: "img"; id: string }
  | { kind: "aud"; id: string }
  | { kind: "txt"; literal: string }
  | { kind: "img_pool"; name: string }
  | { kind: "aud_pool"; name: string }
  | { kind: "invalid"; reason: string } {
  if (ref.startsWith("img:pool:")) return { kind: "img_pool", name: ref.slice("img:pool:".length) };
  if (ref.startsWith("aud:pool:")) return { kind: "aud_pool", name: ref.slice("aud:pool:".length) };
  if (ref.startsWith("img:")) return { kind: "img", id: ref.slice("img:".length) };
  if (ref.startsWith("aud:")) return { kind: "aud", id: ref.slice("aud:".length) };
  if (ref.startsWith("txt:")) return { kind: "txt", literal: ref.slice("txt:".length) };
  return { kind: "invalid", reason: ref };
}

function checkAssetRef(ref: string, path: string, task: TaskJson, r: ValidationReport): void {
  const parsed = parseAssetRef(ref);
  if (parsed.kind === "invalid") {
    err(r, path, "invalid_asset_prefix", `asset must start with img:, aud:, txt:, img:pool:, or aud:pool: (got '${ref}').`);
    return;
  }
  if (parsed.kind === "img_pool") {
    const pool = task.assets?.pools?.[parsed.name];
    if (!pool) err(r, path, "pool_not_declared", `img:pool:${parsed.name} is not declared.`);
    else if (pool.kind !== "image") err(r, path, "pool_kind_mismatch", "img:pool: refs must target an image pool.");
    return;
  }
  if (parsed.kind === "aud_pool") {
    const pool = task.assets?.pools?.[parsed.name];
    if (!pool) err(r, path, "pool_not_declared", `aud:pool:${parsed.name} is not declared.`);
    else err(r, path, "pool_kind_mismatch", "aud:pool: targets a non-audio pool (audio pools are not yet supported).");
    return;
  }
  if (parsed.kind === "img") {
    if (!task.assets?.images?.[parsed.id]) {
      err(r, path, "asset_not_declared", `'${parsed.id}' is not declared in assets.images.`);
    }
    return;
  }
  if (parsed.kind === "aud") {
    if (!task.assets?.audio?.[parsed.id]) {
      err(r, path, "asset_not_declared", `'${parsed.id}' is not declared in assets.audio.`);
    }
    return;
  }
}

function checkAssetRefs(task: TaskJson, r: ValidationReport): void {
  if (Array.isArray(task.trial_template)) {
    task.trial_template.forEach((it, i) => {
      if (typeof it?.asset === "string") {
        checkAssetRef(it.asset, `trial_template[${i}].asset`, task, r);
      }
      if (it?.cases) {
        for (const outcome of ["correct", "incorrect", "timeout"] as const) {
          const c = it.cases[outcome];
          if (c && typeof c.asset === "string") {
            const path = `trial_template[${i}].cases.${outcome}.asset`;
            const parsed = parseAssetRef(c.asset);
            if (parsed.kind === "img_pool" || parsed.kind === "aud_pool") {
              err(r, path, "pool_in_cases_not_supported", "Pool refs inside cases.<outcome>.asset are not supported.");
            } else {
              checkAssetRef(c.asset, path, task, r);
            }
          }
        }
      }
    });
  }
  if (task.stimulus_types && typeof task.stimulus_types === "object") {
    for (const [typeId, t] of Object.entries(task.stimulus_types)) {
      if (!t?.items) continue;
      for (const [itemId, item] of Object.entries(t.items)) {
        if (typeof item?.asset === "string") {
          checkAssetRef(item.asset, `stimulus_types.${typeId}.items.${itemId}.asset`, task, r);
        }
      }
    }
  }
}

// --- Pass 5: responses + stimulus_types ---

function checkResponses(task: TaskJson, r: ValidationReport): void {
  if (!task.responses || typeof task.responses !== "object") return;
  const kbSet = new Set(task.inputs?.keyboard ?? []);
  const touchIds = new Set((task.inputs?.touchscreen_buttons ?? []).map((b) => b.id));

  for (const [label, binding] of Object.entries(task.responses)) {
    const kb = binding?.keyboard;
    if (Array.isArray(kb)) {
      kb.forEach((k, j) => {
        if (!kbSet.has(k)) {
          err(
            r,
            `responses.${label}.keyboard[${j}]`,
            "unknown_label",
            `'${k}' is not in inputs.keyboard.`,
          );
        }
      });
    }
    const ts = binding?.touchscreen;
    if (Array.isArray(ts)) {
      ts.forEach((t, j) => {
        if (!touchIds.has(t)) {
          err(
            r,
            `responses.${label}.touchscreen[${j}]`,
            "unknown_label",
            `'${t}' is not a declared touchscreen button id.`,
          );
        }
      });
    }
  }
}

function checkStimulusTypes(task: TaskJson, r: ValidationReport): void {
  if (!task.stimulus_types || typeof task.stimulus_types !== "object") return;
  const responseKeys = new Set(Object.keys(task.responses ?? {}));
  const templateIds = new Set((task.trial_template ?? []).map((it) => it?.id).filter(Boolean));

  for (const [typeId, t] of Object.entries(task.stimulus_types)) {
    const cr = t?.correct_response;
    if (cr === undefined || cr === null) {
      err(
        r,
        `stimulus_types.${typeId}.correct_response`,
        "missing",
        "correct_response is required.",
      );
    } else if (typeof cr === "object" && !Array.isArray(cr)) {
      // Engine pass 11: expression-form is accepted but v1 evaluates only
      // literal correct_response. We can't run the evaluator client-side, so
      // treat every expression-form as potentially non-constant and warn.
      warn(
        r,
        `stimulus_types.${typeId}.correct_response`,
        "non_constant_expression",
        "expression-form correct_response is a v2 feature; v1 evaluates literals only.",
      );
    } else if (typeof cr !== "string") {
      err(
        r,
        `stimulus_types.${typeId}.correct_response`,
        "missing",
        "correct_response must be a string literal or expression object.",
      );
    } else if (!responseKeys.has(cr)) {
      err(
        r,
        `stimulus_types.${typeId}.correct_response`,
        "unknown_label",
        `'${cr}' is not declared in responses.`,
      );
    }
    if (t?.items) {
      for (const itemId of Object.keys(t.items)) {
        if (!templateIds.has(itemId)) {
          err(
            r,
            `stimulus_types.${typeId}.items.${itemId}`,
            "unknown_label",
            `'${itemId}' does not match any trial_template item.`,
          );
        }
      }
    }
  }
}

// --- Pass 6: captures_response uniqueness ---

function checkCaptureUniqueness(task: TaskJson, r: ValidationReport): void {
  if (!Array.isArray(task.trial_template)) return;
  const capturers = task.trial_template
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it?.captures_response === true);
  if (capturers.length === 0) {
    err(r, "trial_template", "no_capture", "Exactly one item must have captures_response: true.");
  } else if (capturers.length > 1) {
    for (const { i } of capturers) {
      err(
        r,
        `trial_template[${i}].captures_response`,
        "multiple_capture",
        "Only one item may have captures_response: true.",
      );
    }
  }
}

// --- Pass 7: anchors (parse, target existence, cycles, response-target validity) ---

// Matches engine `_parse_anchor` (SchemaValidator.gd:616-647). Returns null
// for structurally-bad anchors (missing dot, too many parts, empty target) →
// caller emits `invalid_anchor`. Returns `axisValid: false` for anchors that
// parse but carry an unsupported axis → caller emits `invalid_anchor_axis`
// (but only after target existence is confirmed, to match engine order).
function parseAnchor(anchor: string): { target: string; axis: string; axisValid: boolean } | null {
  if (anchor === "trial_start") return { target: "trial_start", axis: "", axisValid: true };
  const parts = anchor.split(".");
  if (parts.length !== 2) return null;
  const [target, axis] = parts;
  if (target.length === 0 || axis.length === 0) return null;
  return { target, axis, axisValid: VALID_ANCHOR_AXES.has(axis) };
}

function checkAnchors(task: TaskJson, r: ValidationReport): void {
  if (!Array.isArray(task.trial_template)) return;
  const items = task.trial_template;
  const byId = new Map<string, { i: number; captures: boolean }>();
  items.forEach((it, i) => {
    if (it?.id) byId.set(it.id, { i, captures: it.captures_response === true });
  });

  // Parse + validate each anchor.
  items.forEach((it, i) => {
    if (it?.anchor === undefined) return;
    if (typeof it.anchor !== "string") {
      err(r, `trial_template[${i}].anchor`, "invalid_anchor", "anchor must be a string.");
      return;
    }
    const parsed = parseAnchor(it.anchor);
    if (!parsed) {
      err(r, `trial_template[${i}].anchor`, "invalid_anchor", `'${it.anchor}' must be trial_start or <id>.(end|response).`);
      return;
    }
    if (parsed.target === "trial_start") return;
    // Engine order (SchemaValidator.gd:635-642): target existence is checked
    // BEFORE axis validity. An anchor like "ghost.start" emits
    // `anchor_target_missing`, not `invalid_anchor_axis`.
    const tgt = byId.get(parsed.target);
    if (!tgt) {
      err(
        r,
        `trial_template[${i}].anchor`,
        "anchor_target_missing",
        `Anchor references item '${parsed.target}' which is not in the template.`,
      );
      return;
    }
    if (!parsed.axisValid) {
      err(
        r,
        `trial_template[${i}].anchor`,
        "invalid_anchor_axis",
        `anchor axis must be 'end' or 'response', got '${parsed.axis}'.`,
      );
      return;
    }
    if (parsed.axis === "response" && !tgt.captures) {
      err(
        r,
        `trial_template[${i}].anchor`,
        "response_anchor_invalid",
        `Anchor targets '${parsed.target}.response' but that item has captures_response: false.`,
      );
    }
  });

  // Cycle detection on the anchor graph (non-trial_start edges only).
  const edges = new Map<string, string>();
  items.forEach((it) => {
    if (!it?.id || typeof it.anchor !== "string") return;
    const parsed = parseAnchor(it.anchor);
    if (parsed && parsed.axisValid && parsed.target !== "trial_start" && byId.has(parsed.target)) {
      edges.set(it.id, parsed.target);
    }
  });
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of byId.keys()) color.set(id, WHITE);
  const dfs = (id: string): string | null => {
    color.set(id, GRAY);
    const next = edges.get(id);
    if (next) {
      const c = color.get(next);
      if (c === GRAY) return next;
      if (c === WHITE) {
        const hit = dfs(next);
        if (hit) return hit;
      }
    }
    color.set(id, BLACK);
    return null;
  };
  for (const id of byId.keys()) {
    if (color.get(id) === WHITE) {
      const hit = dfs(id);
      if (hit) {
        const idx = byId.get(hit)!.i;
        err(r, `trial_template[${idx}].anchor`, "anchor_cycle", `Anchor chain forms a cycle at '${hit}'.`);
        break;
      }
    }
  }
}

// --- Pass 8: timing ---

function checkTiming(task: TaskJson, r: ValidationReport): void {
  const t = task.timing;
  if (!t) return;
  if (t.mode !== "self_paced" && t.mode !== "fixed_schedule" && t.mode !== "csv_schedule") {
    err(r, "timing.mode", "invalid_mode", `timing.mode must be self_paced | fixed_schedule | csv_schedule.`);
    return;
  }
  if (t.mode === "fixed_schedule" && (typeof t.soa_ms !== "number" || t.soa_ms <= 0)) {
    err(r, "timing.soa_ms", "missing", "soa_ms (> 0) is required for timing.mode = fixed_schedule.");
  }
  if (t.mode === "csv_schedule") {
    const anyCsvBlock = (task.blocks ?? []).some(
      (b) => b?.ordering === "csv" && (b.trial_list || b.trial_list_url),
    );
    if (!anyCsvBlock) {
      err(r, "timing.mode", "missing_csv_source", "csv_schedule requires at least one block with ordering: csv and a trial_list / trial_list_url.");
    }
  }
}

// --- Pass 9: blocks ---

const VALID_ORDERINGS = new Set(["factorial_random", "fixed", "csv", "inline"]);

function checkBlocks(task: TaskJson, r: ValidationReport): void {
  if (!Array.isArray(task.blocks)) return;
  const typeKeys = new Set(Object.keys(task.stimulus_types ?? {}));

  task.blocks.forEach((b, i) => {
    if (!b) return;
    const path = `blocks[${i}]`;

    // Engine pass 10b: ordering is required and must be in the allowed set.
    // `b.ordering` is typed as `OrderingMode` but imports can carry anything —
    // cast through unknown so the runtime guard is not shortcut by the type.
    // We DO NOT early-return on ordering errors — the engine (SchemaValidator
    // .gd:777-792) reports them alongside `unknown_type`, `unbalanced`, etc.
    // so authors see every problem in one pass.
    const ordering = (b as { ordering?: unknown }).ordering;
    if (typeof ordering !== "string" || ordering === "") {
      err(r, `${path}.ordering`, "missing", "ordering is required.");
    } else if (!VALID_ORDERINGS.has(ordering)) {
      err(
        r,
        `${path}.ordering`,
        "invalid_ordering",
        `ordering must be factorial_random | fixed | csv | inline (got '${ordering}').`,
      );
    }

    // Engine pass 10b: factorial_random / fixed require n_trials > 0.
    if (b.ordering === "factorial_random" || b.ordering === "fixed") {
      if (typeof b.n_trials !== "number" || b.n_trials <= 0) {
        err(
          r,
          `${path}.n_trials`,
          "missing",
          `${b.ordering} ordering requires n_trials > 0.`,
        );
      }
    }

    if (Array.isArray(b.types)) {
      b.types.forEach((tp) => {
        if (!typeKeys.has(tp)) {
          // Engine path format: `blocks[%d].types` (no index) at
          // SchemaValidator.gd:791. Match verbatim.
          err(r, `${path}.types`, "unknown_type", `'${tp}' is not a declared stimulus_type.`);
        }
      });
    }
    // factorial_random and fixed draw trials from `types`; an empty list
    // means the block has no stimulus material to produce trials from.
    // inline and csv mode get trials from trial_list / trial_list_url and
    // may legitimately have `types` empty.
    if ((b.ordering === "factorial_random" || b.ordering === "fixed") &&
        (!Array.isArray(b.types) || b.types.length === 0)) {
      err(r, `${path}.types`, "empty_types", `${b.ordering} ordering requires at least one stimulus_type in types[].`);
    }
    if (b.ordering === "factorial_random" && b.constraints?.balanced === true) {
      const n = b.n_trials ?? 0;
      const k = (b.types ?? []).length;
      if (k > 0 && n % k !== 0) {
        err(r, `${path}.n_trials`, "unbalanced", `balanced: true requires n_trials % len(types) === 0 (got ${n} % ${k}).`);
      }
    }
    if (b.ordering === "csv" && !b.trial_list && !b.trial_list_url) {
      err(r, path, "missing_csv_source", "csv ordering requires trial_list or trial_list_url.");
    }
  });
}

// --- Pass 9b: trial_template items must end up with an asset by the time a
// trial fires. An image/text/audio item may omit `asset` on the base *only*
// if every stimulus_type used in some block provides an override. If any
// such type leaves it unset, the runtime will try to render with no asset.
// (feedback + blank items legitimately have no asset and are skipped.)
//
// Known limitation: blocks with `ordering: "csv"` and `trial_list_url` pull
// the type list from a CSV the browser can't read at authoring time, so
// those types won't appear in `usedTypeIds` and we under-report
// `asset_missing` for tasks that rely on them. Authors using csv-via-URL
// with no inline `trial_list` today should run the engine's validator
// server-side as the authoritative check. Inline `trial_list` is covered.

function checkAssetCoverage(task: TaskJson, r: ValidationReport): void {
  if (!Array.isArray(task.trial_template)) return;
  const types = task.stimulus_types ?? {};
  const usedTypeIds = new Set<string>();
  for (const b of task.blocks ?? []) {
    for (const t of b?.types ?? []) usedTypeIds.add(t);
    for (const tle of b?.trial_list ?? []) {
      if (typeof tle?.type === "string") usedTypeIds.add(tle.type);
    }
    // NB: b.trial_list_url is intentionally NOT resolved. See caveat above.
  }

  task.trial_template.forEach((it, i) => {
    if (!it) return;
    if (it.kind === "feedback" || it.kind === "blank") return;
    const hasBaseAsset = typeof it.asset === "string" && it.asset.length > 0;
    if (hasBaseAsset) return;

    // Base lacks asset — every *used* stimulus_type must override it.
    const missing: string[] = [];
    for (const typeId of usedTypeIds) {
      const type = types[typeId];
      if (!type) continue; // unknown-label errors are separately reported
      const override = type.items?.[it.id];
      const overrideAsset = override && typeof override.asset === "string" && override.asset.length > 0;
      if (!overrideAsset) missing.push(typeId);
    }
    if (missing.length > 0) {
      err(
        r,
        `trial_template[${i}].asset`,
        "asset_missing",
        `Item '${it.id}' has no asset on the base and the following stimulus_type(s) don't override it: ${missing.join(", ")}.`,
      );
    }
  });
}

// --- Pass 10: pool size bounds (subset — tight balanced case only) ---

function checkPoolSizeBounds(task: TaskJson, r: ValidationReport): void {
  const pools = task.assets?.pools;
  if (!pools) return;
  const types = task.stimulus_types ?? {};
  // Map (pool, type) → how many items per trial draw from this pool.
  // When share_across_types is false (default), each type has its own queue.
  // Worst-case draws per (pool, group) per block is n_trials-of-that-type ×
  // items-per-trial-drawing-from-this-pool.
  const blocks = Array.isArray(task.blocks) ? task.blocks : [];

  for (const block of blocks) {
    if (!block?.types || !Array.isArray(block.types)) continue;
    const n = block.n_trials ?? 0;
    if (n <= 0) continue;
    const balanced = block.ordering === "factorial_random" && block.constraints?.balanced === true;
    const k = block.types.length;
    const perType = balanced && k > 0 && n % k === 0 ? n / k : n; // worst case when unbalanced
    const severity: "error" | "warning" = balanced ? "error" : "warning";
    const code = balanced ? "pool_too_small" : "pool_size_below_worst_case";

    for (const poolName of Object.keys(pools)) {
      const pool = pools[poolName];
      if (!pool?.members || pool.kind !== "image") continue;
      const size = pool.members.length;
      if (size === 0) continue;

      // Aggregate draws by group: (pool, type) or (pool, shared) if share_across_types.
      const drawsByGroup = new Map<string, number>();
      for (const typeId of block.types) {
        const type = types[typeId];
        if (!type?.items) continue;
        // How many items in this type reference this pool?
        let itemsUsingPool = 0;
        for (const item of Object.values(type.items)) {
          if (typeof item?.asset === "string" && item.asset === `img:pool:${poolName}`) {
            itemsUsingPool++;
          }
        }
        if (itemsUsingPool === 0) continue;
        const groupKey = pool.share_across_types ? "__shared__" : typeId;
        const prev = drawsByGroup.get(groupKey) ?? 0;
        drawsByGroup.set(groupKey, prev + perType * itemsUsingPool);
      }

      for (const [groupKey, draws] of drawsByGroup) {
        if (draws > size) {
          const path = `assets.pools.${poolName}.members`;
          const msg = `Pool '${poolName}' has ${size} members but block '${block.id}' draws ${draws} from group '${groupKey}'.`;
          if (severity === "error") err(r, path, code, msg);
          else warn(r, path, code, msg);
        }
      }
    }
  }
}
