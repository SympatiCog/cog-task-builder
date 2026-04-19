import { describe, it, expect } from "vitest";
import { importTask } from "../src/serde/import";

const MINIMAL = {
  schema_version: "1.0.0",
  metadata: { task_id: "t", task_version: "1.0.0" },
  assets: { images: {}, audio: {} },
  inputs: { keyboard: ["f"], touchscreen_buttons: [] },
  responses: { left: { keyboard: ["f"] } },
  stimulus_types: { left: { correct_response: "left", items: { cs: { asset: "txt:L" } } } },
  trial_template: [
    { id: "cs", kind: "text", onset_ms: 0, duration_ms: 0, captures_response: true },
  ],
  timing: { mode: "self_paced" },
  blocks: [{ id: "main", n_trials: 2, types: ["left"], ordering: "fixed" }],
};

describe("import edge cases", () => {
  it("strips UTF-8 BOM", () => {
    const text = "\uFEFF" + JSON.stringify(MINIMAL);
    const r = importTask(text);
    expect(r.ok).toBe(true);
    expect(r.task?.metadata.task_id).toBe("t");
  });

  it("rejects malformed JSON with a useful message", () => {
    const r = importTask("{ not: json }");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Invalid JSON/);
  });

  it("rejects non-object top-level value", () => {
    const r = importTask("[1,2,3]");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/must be an object/);
  });

  it("rejects missing schema_version", () => {
    const r = importTask(JSON.stringify({ metadata: {} }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/schema_version/);
  });
});
