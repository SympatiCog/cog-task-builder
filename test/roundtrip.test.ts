import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { importTask } from "../src/serde/import";
import { exportTask } from "../src/serde/export";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures", import.meta.url));

function fixtureNames(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

describe("import/export round-trip", () => {
  for (const name of fixtureNames()) {
    it(`${name} round-trips semantically`, () => {
      const text = readFileSync(join(FIXTURES_DIR, name), "utf-8");
      const imported = importTask(text);
      expect(imported.ok).toBe(true);
      expect(imported.task).toBeDefined();

      const exported = exportTask(imported.task!);
      const reparsed = JSON.parse(exported);
      const original = JSON.parse(text);
      expect(reparsed).toEqual(original);
    });

    it(`${name} export is idempotent (double export equals single)`, () => {
      const text = readFileSync(join(FIXTURES_DIR, name), "utf-8");
      const first = exportTask(importTask(text).task!);
      const second = exportTask(importTask(first).task!);
      expect(second).toBe(first);
    });

    it(`${name} exports with canonical top-level key order`, () => {
      const text = readFileSync(join(FIXTURES_DIR, name), "utf-8");
      const exported = exportTask(importTask(text).task!);
      const reparsed = JSON.parse(exported) as Record<string, unknown>;
      const topKeys = Object.keys(reparsed);
      const canonical = [
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
      ];
      // Every top-level key from the fixture should appear; the ones we
      // know should be in canonical order.
      const known = topKeys.filter((k) => canonical.includes(k));
      const expected = canonical.filter((k) => known.includes(k));
      expect(known).toEqual(expected);
    });
  }
});

// Regression: MsNumberField snaps authored ms to 2-decimal floats
// (16.67, 33.33, 66.67, 83.33). Verify these round-trip cleanly through
// import → export without precision drift, and that the canonical-order
// pipeline tolerates float ms values. All four engine fixtures use
// integer ms today, so this coverage would be invisible without an
// explicit synthetic case.
describe("fractional-ms round-trip (MsNumberField snap output)", () => {
  const task = {
    schema_version: "1.1.0",
    metadata: { task_id: "frac_ms", task_version: "0.1.0" },
    assets: { images: {}, audio: {} },
    inputs: { keyboard: ["f"] },
    responses: { left: { keyboard: ["f"] } },
    stimulus_types: {
      a: { correct_response: "left", items: { cs: { asset: "txt:L" } } },
    },
    trial_template: [
      {
        id: "cs",
        kind: "text",
        onset_ms: 16.67,
        duration_ms: 33.33,
        jitter_ms: 66.67,
        response_window_ms: 83.33,
        captures_response: true,
      },
    ],
    timing: { mode: "self_paced", iti_ms: 116.67 },
    blocks: [{ id: "main", n_trials: 2, types: ["a"], ordering: "fixed" }],
  };

  it("snapped floats survive import → export deep-equal", () => {
    const text = JSON.stringify(task, null, 2);
    const imported = importTask(text);
    expect(imported.ok).toBe(true);
    const exported = exportTask(imported.task!);
    const reparsed = JSON.parse(exported);
    expect(reparsed.trial_template[0].onset_ms).toBe(16.67);
    expect(reparsed.trial_template[0].duration_ms).toBe(33.33);
    expect(reparsed.trial_template[0].jitter_ms).toBe(66.67);
    expect(reparsed.trial_template[0].response_window_ms).toBe(83.33);
    expect(reparsed.timing.iti_ms).toBe(116.67);
  });

  it("export is idempotent for snapped-float ms values", () => {
    const text = JSON.stringify(task, null, 2);
    const first = exportTask(importTask(text).task!);
    const second = exportTask(importTask(first).task!);
    expect(second).toBe(first);
  });
});
