import { describe, it, expect } from "vitest";
import { importTask } from "../src/serde/import";
import { exportTask } from "../src/serde/export";

// The plan's forward-compat contract: import must preserve keys the builder
// doesn't know about, and export must emit them (after the known canonical
// keys). Tests an engine-like fixture augmented with unknown keys at every
// nesting level the canonicalizer walks.

const FIXTURE = {
  schema_version: "1.1.0",
  metadata: {
    task_id: "unknown_keys_probe",
    task_version: "1.0.0",
    future_top_level_meta_key: "should survive",
    theme: {
      background_color: "#000000",
      future_theme_key: 42,
      text_styles: {
        fix: { font_size_pct: 0.1, color: "#fff", future_style_key: true },
      },
    },
  },
  assets: {
    images: {
      img1: {
        source: "bundled",
        path: "res://a.png",
        future_asset_key: [1, 2, 3],
      },
    },
    future_assets_key: "yes",
  },
  inputs: { keyboard: ["f"], touchscreen_buttons: [] },
  responses: {
    left: { keyboard: ["f"], future_response_key: "ok" },
  },
  stimulus_types: {
    left: {
      correct_response: "left",
      items: { cs: { asset: "txt:L", future_item_key: 1 } },
      future_type_key: "x",
    },
  },
  trial_template: [
    {
      id: "cs",
      kind: "text",
      asset: "txt:+",
      onset_ms: 0,
      duration_ms: 0,
      captures_response: true,
      future_trial_key: [],
    },
  ],
  timing: { mode: "self_paced", iti_ms: 600, future_timing_key: "ok" },
  blocks: [
    {
      id: "main",
      n_trials: 2,
      types: ["left"],
      ordering: "fixed",
      future_block_key: "ok",
    },
  ],
  session_end: { text: "Done.", future_session_end_key: "ok" },
  future_root_key: { nested: "also ok" },
};

describe("unknown-key preservation", () => {
  it("preserves unknown keys across import → export → parse", () => {
    const text = JSON.stringify(FIXTURE);
    const result = importTask(text);
    expect(result.ok).toBe(true);
    const exported = exportTask(result.task!);
    const reparsed = JSON.parse(exported);
    expect(reparsed).toEqual(FIXTURE);
  });

  it("emits unknown keys after known canonical keys at the root", () => {
    const text = JSON.stringify(FIXTURE);
    const exported = exportTask(importTask(text).task!);
    const rootKeys = Object.keys(JSON.parse(exported));
    const knownTail = rootKeys.indexOf("session_end");
    const unknownIdx = rootKeys.indexOf("future_root_key");
    expect(knownTail).toBeGreaterThanOrEqual(0);
    expect(unknownIdx).toBeGreaterThan(knownTail);
  });
});
