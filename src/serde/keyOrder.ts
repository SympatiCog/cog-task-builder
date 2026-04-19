// Canonical key order per task-JSON section. Emitting in a stable order makes
// exports diff-friendly and matches the stylistic convention used in the
// engine's example tasks. Unknown keys fall through in their existing order.
export const KEY_ORDER: Record<string, readonly string[]> = {
  root: [
    "schema_version",
    "metadata",
    "assets",
    "inputs",
    "responses",
    "stimulus_types",
    "trial_template",
    "timing",
    "blocks",
    "session_end",
  ],
  metadata: [
    "task_id",
    "task_version",
    "name",
    "author",
    "notes",
    "target_devices",
    "min_refresh_hz",
    "allowed_refresh_hz",
    "log_frames",
    "theme",
  ],
  theme: [
    "background_color",
    "default_text_color",
    "default_text_size_pct",
    "text_styles",
  ],
  text_style: ["font_size_pct", "color"],
  assets: ["allowed_hosts", "images", "audio", "pools"],
  image_asset_bundled: ["source", "path"],
  image_asset_remote: ["source", "url", "sha256"],
  pool: ["kind", "members", "share_across_types"],
  inputs: ["keyboard", "touchscreen_buttons"],
  touchscreen_button: ["id", "label", "position", "size_px"],
  position_xy: ["x_pct", "y_pct"],
  response: ["keyboard", "touchscreen", "mouse"],
  stimulus_type: ["correct_response", "items"],
  trial_item: [
    "id",
    "kind",
    "asset",
    "anchor",
    "onset_ms",
    "duration_ms",
    "jitter_ms",
    "wait_for_response",
    "response_window_ms",
    "captures_response",
    "extras",
    "cases",
  ],
  feedback_case: ["text", "style", "asset"],
  timing: ["mode", "iti_ms", "iti_jitter_ms", "allow_overlap", "soa_ms"],
  block: [
    "id",
    "n_trials",
    "types",
    "ordering",
    "constraints",
    "seed",
    "instructions",
    "feedback_enabled",
    "trial_list",
    "trial_list_url",
  ],
  constraints: ["max_type_repeat", "balanced"],
  instructions: ["text", "duration_ms", "dismissable"],
  trial_list_entry: ["type", "trial_onset_ms"],
  session_end: ["text"],
};

export function orderKeys(
  section: keyof typeof KEY_ORDER | string,
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const order = KEY_ORDER[section] ?? [];
  const out: Record<string, unknown> = {};
  for (const k of order) {
    if (k in obj) out[k] = obj[k];
  }
  for (const k of Object.keys(obj)) {
    if (!(k in out)) out[k] = obj[k];
  }
  return out;
}
