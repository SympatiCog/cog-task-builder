import type { TaskJson } from "../types/task";
import { orderKeys } from "./keyOrder";

// Walk a task JSON and emit a new object with every nested dict in canonical
// key order. Unknown keys are preserved in insertion order after the known
// keys. Arrays and leaf values pass through unchanged.

type Dict = Record<string, unknown>;

function isDict(v: unknown): v is Dict {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function orderImageAsset(a: Dict): Dict {
  return a.source === "remote"
    ? orderKeys("image_asset_remote", a)
    : orderKeys("image_asset_bundled", a);
}

function orderPosition(p: unknown): unknown {
  return isDict(p) ? orderKeys("position_xy", p) : p;
}

function orderTouchscreenButton(b: Dict): Dict {
  const ordered = orderKeys("touchscreen_button", b);
  if ("position" in ordered) ordered.position = orderPosition(ordered.position);
  return ordered;
}

function orderAssetMap(
  map: Dict,
  orderOne: (v: Dict) => Dict,
): Dict {
  const out: Dict = {};
  for (const [id, v] of Object.entries(map)) {
    out[id] = isDict(v) ? orderOne(v) : v;
  }
  return out;
}

function orderStyleMap(styles: Dict): Dict {
  const out: Dict = {};
  for (const [name, v] of Object.entries(styles)) {
    out[name] = isDict(v) ? orderKeys("text_style", v) : v;
  }
  return out;
}

function orderTheme(t: Dict): Dict {
  const o = orderKeys("theme", t);
  if (isDict(o.text_styles)) o.text_styles = orderStyleMap(o.text_styles);
  return o;
}

function orderMetadata(m: Dict): Dict {
  const o = orderKeys("metadata", m);
  if (isDict(o.theme)) o.theme = orderTheme(o.theme);
  return o;
}

function orderAssets(a: Dict): Dict {
  const o = orderKeys("assets", a);
  if (isDict(o.images)) o.images = orderAssetMap(o.images, orderImageAsset);
  if (isDict(o.audio)) o.audio = orderAssetMap(o.audio, orderImageAsset);
  if (isDict(o.pools)) {
    o.pools = orderAssetMap(o.pools, (p) => orderKeys("pool", p));
  }
  return o;
}

function orderInputs(i: Dict): Dict {
  const o = orderKeys("inputs", i);
  if (Array.isArray(o.touchscreen_buttons)) {
    o.touchscreen_buttons = o.touchscreen_buttons.map((b) =>
      isDict(b) ? orderTouchscreenButton(b) : b,
    );
  }
  return o;
}

function orderResponses(r: Dict): Dict {
  const out: Dict = {};
  for (const [name, v] of Object.entries(r)) {
    out[name] = isDict(v) ? orderKeys("response", v) : v;
  }
  return out;
}

function orderItemOverrides(items: Dict): Dict {
  // Per-item override dicts share the trial_item key order for common keys,
  // and extras stays as-is since it's author-defined.
  const out: Dict = {};
  for (const [id, v] of Object.entries(items)) {
    out[id] = isDict(v) ? orderKeys("trial_item", v) : v;
  }
  return out;
}

function orderStimulusTypes(t: Dict): Dict {
  const out: Dict = {};
  for (const [id, v] of Object.entries(t)) {
    if (!isDict(v)) {
      out[id] = v;
      continue;
    }
    const ordered = orderKeys("stimulus_type", v);
    if (isDict(ordered.items)) ordered.items = orderItemOverrides(ordered.items);
    out[id] = ordered;
  }
  return out;
}

function orderCases(cases: Dict): Dict {
  const out: Dict = {};
  for (const [outcome, v] of Object.entries(cases)) {
    out[outcome] = isDict(v) ? orderKeys("feedback_case", v) : v;
  }
  return out;
}

function orderTrialItem(item: Dict): Dict {
  const o = orderKeys("trial_item", item);
  if (isDict(o.cases)) o.cases = orderCases(o.cases);
  return o;
}

function orderBlock(b: Dict): Dict {
  const o = orderKeys("block", b);
  if (isDict(o.constraints)) o.constraints = orderKeys("constraints", o.constraints);
  if (isDict(o.instructions)) o.instructions = orderKeys("instructions", o.instructions);
  if (Array.isArray(o.trial_list)) {
    o.trial_list = o.trial_list.map((e) =>
      isDict(e) ? orderKeys("trial_list_entry", e) : e,
    );
  }
  return o;
}

export function canonicalize(task: TaskJson): TaskJson {
  const raw = task as unknown as Dict;
  const o = orderKeys("root", raw);

  if (isDict(o.metadata)) o.metadata = orderMetadata(o.metadata);
  if (isDict(o.assets)) o.assets = orderAssets(o.assets);
  if (isDict(o.inputs)) o.inputs = orderInputs(o.inputs);
  if (isDict(o.responses)) o.responses = orderResponses(o.responses);
  if (isDict(o.stimulus_types)) o.stimulus_types = orderStimulusTypes(o.stimulus_types);
  if (Array.isArray(o.trial_template)) {
    o.trial_template = o.trial_template.map((it) =>
      isDict(it) ? orderTrialItem(it) : it,
    );
  }
  if (isDict(o.timing)) o.timing = orderKeys("timing", o.timing);
  if (Array.isArray(o.blocks)) {
    o.blocks = o.blocks.map((b) => (isDict(b) ? orderBlock(b) : b));
  }
  if (isDict(o.session_end)) o.session_end = orderKeys("session_end", o.session_end);

  return o as unknown as TaskJson;
}
