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
