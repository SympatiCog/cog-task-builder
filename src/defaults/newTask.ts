import type { TaskJson } from "../types/task";

// Factory for a blank schema-1.1 task. The minimum set of keys that parses
// against the engine's shape check; every section filled from the "conventional
// defaults" in LLM_TASK_AUTHORING.md §12a so authors start from a reasonable
// baseline. Validator passes will still flag incomplete fields (missing
// stimulus_types, etc.) — this factory is a starting point, not a finished
// task.
export function newTask(): TaskJson {
  return {
    schema_version: "1.1.0",
    metadata: {
      task_id: "new_task",
      task_version: "0.1.0",
      name: "Untitled task",
      min_refresh_hz: 55,
      theme: {
        background_color: "#000000",
        default_text_color: "#ffffff",
        default_text_size_pct: 0.08,
        text_styles: {
          fix: { font_size_pct: 0.1, color: "#cccccc" },
          stim: { font_size_pct: 0.14, color: "#ffffff" },
          correct: { font_size_pct: 0.06, color: "#33ff33" },
          incorrect: { font_size_pct: 0.06, color: "#ff4444" },
          slow: { font_size_pct: 0.06, color: "#ffcc00" },
        },
      },
    },
    assets: { images: {}, audio: {} },
    inputs: { keyboard: ["f", "j"], touchscreen_buttons: [] },
    responses: {
      left: { keyboard: ["f"] },
      right: { keyboard: ["j"] },
    },
    stimulus_types: {},
    trial_template: [],
    timing: { mode: "self_paced", iti_ms: 800, iti_jitter_ms: 100, allow_overlap: false },
    blocks: [],
    session_end: { text: "Done. Thanks!" },
  };
}
