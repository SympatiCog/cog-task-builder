import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/validator";
import { newTask } from "../src/defaults/newTask";
import type { TaskJson } from "../src/types/task";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures", import.meta.url));

function fixture(name: string): TaskJson {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8"));
}

describe("validator: engine fixtures should be clean", () => {
  for (const name of readdirSync(FIXTURES_DIR).filter((n) => n.endsWith(".json")).sort()) {
    it(`${name} has zero errors`, () => {
      const r = validate(fixture(name));
      expect(r.errors, r.errors.map((e) => `${e.path}: ${e.code}`).join("\n")).toEqual([]);
    });
  }
});

describe("validator: targeted error codes", () => {
  function base(): TaskJson {
    // newTask() is intentionally incomplete — it has no stimulus_types,
    // no trial_template, no blocks. Build a minimal VALID task here.
    const t = newTask();
    t.stimulus_types = {
      left: { correct_response: "left", items: { cs: { asset: "txt:L" } } },
    };
    t.trial_template = [
      { id: "cs", kind: "text", onset_ms: 0, duration_ms: 0, captures_response: true },
    ];
    t.blocks = [
      { id: "main", n_trials: 2, types: ["left"], ordering: "fixed" },
    ];
    return t;
  }

  it("clean baseline", () => {
    expect(validate(base()).errors).toEqual([]);
  });

  it("schema_too_new", () => {
    const t = { ...base(), schema_version: "2.0.0" as unknown as typeof base extends () => { schema_version: infer S } ? S : never };
    const r = validate(t as TaskJson);
    expect(r.errors.some((e) => e.code === "schema_too_new")).toBe(true);
  });

  it("invalid_identifier on task_id", () => {
    const t = base();
    t.metadata.task_id = "Bad-ID";
    expect(validate(t).errors.some((e) => e.code === "invalid_identifier")).toBe(true);
  });

  it("asset_not_declared for img:<id>", () => {
    const t = base();
    t.stimulus_types.left.items.cs.asset = "img:missing";
    expect(validate(t).errors.some((e) => e.code === "asset_not_declared")).toBe(true);
  });

  it("pool_not_declared for img:pool:<name>", () => {
    const t = base();
    t.stimulus_types.left.items.cs.asset = "img:pool:missing";
    expect(validate(t).errors.some((e) => e.code === "pool_not_declared")).toBe(true);
  });

  it("pool_in_cases_not_supported", () => {
    const t = base();
    t.assets.pools = { face: { kind: "image", members: [] } };
    t.assets.images = { left: { source: "bundled", path: "res://l.png" } };
    t.assets.pools.face.members = ["left"];
    t.trial_template.push({
      id: "fb", kind: "feedback", anchor: "cs.end",
      cases: { correct: { text: "ok", asset: "img:pool:face" } },
    });
    expect(validate(t).errors.some((e) => e.code === "pool_in_cases_not_supported")).toBe(true);
  });

  it("invalid_asset_prefix", () => {
    const t = base();
    t.stimulus_types.left.items.cs.asset = "foo:bar";
    expect(validate(t).errors.some((e) => e.code === "invalid_asset_prefix")).toBe(true);
  });

  it("no_capture and multiple_capture", () => {
    const t1 = base();
    t1.trial_template[0].captures_response = false;
    expect(validate(t1).errors.some((e) => e.code === "no_capture")).toBe(true);

    const t2 = base();
    t2.trial_template.push({ id: "cs2", kind: "text", captures_response: true });
    expect(validate(t2).errors.some((e) => e.code === "multiple_capture")).toBe(true);
  });

  it("unknown_label on correct_response", () => {
    const t = base();
    t.stimulus_types.left.correct_response = "nonexistent";
    expect(validate(t).errors.some((e) => e.code === "unknown_label")).toBe(true);
  });

  it("response_anchor_invalid", () => {
    const t = base();
    t.trial_template.push({ id: "fix", kind: "text", anchor: "cs.response" });
    // cs has captures_response: true so cs.response IS valid — flip to target a non-capturer instead.
    t.trial_template = [
      { id: "fix", kind: "text", onset_ms: 0 },
      { id: "cs", kind: "text", captures_response: true },
      { id: "late", kind: "text", anchor: "fix.response" },
    ];
    expect(validate(t).errors.some((e) => e.code === "response_anchor_invalid")).toBe(true);
  });

  it("anchor_target_missing", () => {
    const t = base();
    t.trial_template[0].anchor = "ghost.end";
    expect(validate(t).errors.some((e) => e.code === "anchor_target_missing")).toBe(true);
  });

  it("anchor_cycle", () => {
    const t = base();
    t.trial_template = [
      { id: "a", kind: "text", anchor: "b.end" },
      { id: "b", kind: "text", anchor: "a.end", captures_response: true },
    ];
    expect(validate(t).errors.some((e) => e.code === "anchor_cycle")).toBe(true);
  });

  it("invalid_mode on timing", () => {
    const t = base();
    // @ts-expect-error intentional bad mode
    t.timing.mode = "instant";
    expect(validate(t).errors.some((e) => e.code === "invalid_mode")).toBe(true);
  });

  it("soa_ms missing on fixed_schedule", () => {
    const t = base();
    t.timing = { mode: "fixed_schedule" };
    expect(validate(t).errors.some((e) => e.path === "timing.soa_ms" && e.code === "missing")).toBe(true);
  });

  it("unbalanced factorial_random with balanced: true", () => {
    const t = base();
    t.stimulus_types.right = { correct_response: "right", items: { cs: { asset: "txt:R" } } };
    t.blocks[0] = {
      id: "main", n_trials: 3, types: ["left", "right"],
      ordering: "factorial_random", constraints: { balanced: true },
    };
    expect(validate(t).errors.some((e) => e.code === "unbalanced")).toBe(true);
  });

  it("pool_too_small in tight balanced mode", () => {
    const t = base();
    t.assets.images = {
      i1: { source: "bundled", path: "res://1.png" },
      i2: { source: "bundled", path: "res://2.png" },
    };
    t.assets.pools = { small: { kind: "image", members: ["i1", "i2"] } };
    t.stimulus_types.left.items.cs.asset = "img:pool:small";
    t.blocks[0] = {
      id: "main", n_trials: 10, types: ["left"],
      ordering: "factorial_random", constraints: { balanced: true },
    };
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "pool_too_small")).toBe(true);
  });

  it("pool_size_below_worst_case in unbounded mode (warning only)", () => {
    const t = base();
    t.assets.images = {
      i1: { source: "bundled", path: "res://1.png" },
      i2: { source: "bundled", path: "res://2.png" },
    };
    t.assets.pools = { small: { kind: "image", members: ["i1", "i2"] } };
    t.stimulus_types.left.items.cs.asset = "img:pool:small";
    t.blocks[0] = { id: "main", n_trials: 10, types: ["left"], ordering: "fixed" };
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "pool_size_below_worst_case")).toBe(false);
    expect(r.warnings.some((w) => w.code === "pool_size_below_worst_case")).toBe(true);
  });

  it("unsupported_pool_kind", () => {
    const t = base();
    t.assets.pools = {
      // @ts-expect-error intentional bad kind
      snd: { kind: "audio", members: [] },
    };
    expect(validate(t).errors.some((e) => e.code === "unsupported_pool_kind")).toBe(true);
  });

  it("pool_empty", () => {
    const t = base();
    t.assets.pools = { empty: { kind: "image", members: [] } };
    expect(validate(t).errors.some((e) => e.code === "pool_empty")).toBe(true);
  });

  it("pool_member_missing", () => {
    const t = base();
    t.assets.pools = { p: { kind: "image", members: ["ghost"] } };
    expect(validate(t).errors.some((e) => e.code === "pool_member_missing")).toBe(true);
  });

  it("pool_member_duplicated (warning)", () => {
    const t = base();
    t.assets.images = { i1: { source: "bundled", path: "res://1.png" } };
    t.assets.pools = { p: { kind: "image", members: ["i1", "i1"] } };
    expect(validate(t).warnings.some((w) => w.code === "pool_member_duplicated")).toBe(true);
  });

  it("empty_types on factorial_random block", () => {
    const t = base();
    t.blocks[0] = {
      id: "main",
      n_trials: 2,
      types: [],
      ordering: "factorial_random",
    };
    expect(validate(t).errors.some((e) => e.code === "empty_types")).toBe(true);
  });

  it("empty_types on fixed block", () => {
    const t = base();
    t.blocks[0] = { id: "main", n_trials: 2, types: [], ordering: "fixed" };
    expect(validate(t).errors.some((e) => e.code === "empty_types")).toBe(true);
  });

  it("empty_types allows inline/csv (trial_list supplies trials)", () => {
    const t = base();
    t.blocks[0] = {
      id: "main",
      ordering: "inline",
      trial_list: [{ type: "left" }, { type: "left" }],
    };
    expect(validate(t).errors.some((e) => e.code === "empty_types")).toBe(false);
  });

  it("asset_missing when base lacks asset and a used type doesn't override", () => {
    const t = base();
    // Template item has no asset; stimulus_type 'left' doesn't override.
    t.trial_template = [
      { id: "cs", kind: "image", onset_ms: 0, duration_ms: 0, captures_response: true },
    ];
    t.stimulus_types.left = { correct_response: "left", items: {} };
    t.blocks[0] = { id: "main", n_trials: 2, types: ["left"], ordering: "fixed" };
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "asset_missing")).toBe(true);
  });

  it("asset_missing is silent when every used type overrides", () => {
    const t = base();
    t.assets.images = { im: { source: "bundled", path: "res://x.png" } };
    t.trial_template = [
      { id: "cs", kind: "image", captures_response: true },
    ];
    t.stimulus_types = {
      L: { correct_response: "left", items: { cs: { asset: "img:im" } } },
      R: { correct_response: "left", items: { cs: { asset: "img:im" } } },
    };
    t.responses = { left: { keyboard: ["f"] } };
    t.blocks[0] = {
      id: "main", n_trials: 4, types: ["L", "R"], ordering: "factorial_random",
      constraints: { balanced: true },
    };
    expect(validate(t).errors.some((e) => e.code === "asset_missing")).toBe(false);
  });

  it("asset_missing is silent for feedback / blank items with no asset", () => {
    const t = base();
    t.trial_template = [
      { id: "cs", kind: "text", asset: "txt:+", captures_response: true },
      { id: "fb", kind: "feedback", anchor: "cs.end" },
      { id: "gap", kind: "blank", anchor: "cs.end", onset_ms: 100, duration_ms: 100 },
    ];
    expect(validate(t).errors.some((e) => e.code === "asset_missing")).toBe(false);
  });

  // Regression: shape of the "broken" task the user submitted on 2026-04-19,
  // which passed pre-fix validation. Block types was [] and slota_left had an
  // empty items map while the base cs item had no asset. Both classes of bug
  // should light up as errors now.
  it("broken_empty_types regression: empty block.types AND asset_missing", () => {
    const t = base();
    t.trial_template = [
      { id: "cs", kind: "image", captures_response: true },
    ];
    t.stimulus_types = {
      slota_left: { correct_response: "left", items: {} },
      slota_right: { correct_response: "left", items: { cs: { asset: "img:pool:slota_right" } } },
    };
    t.assets.images = { a: { source: "bundled", path: "res://a.png" } };
    t.assets.pools = { slota_right: { kind: "image", members: ["a"] } };
    t.blocks[0] = {
      id: "main", n_trials: 12, types: [], ordering: "factorial_random",
      constraints: { balanced: true },
    };
    const codes = validate(t).errors.map((e) => e.code);
    expect(codes).toContain("empty_types");
    // asset_missing only fires for TYPES THE BLOCK USES; empty types[] means
    // no types are "used", so asset_missing is silent. Once the user fixes
    // empty_types by adding ["slota_left", "slota_right"], asset_missing
    // should fire on the next run — covered by the next test.
  });

  it("broken task once types are populated: asset_missing lights up for slota_left", () => {
    const t = base();
    t.trial_template = [
      { id: "cs", kind: "image", captures_response: true },
    ];
    t.stimulus_types = {
      slota_left: { correct_response: "left", items: {} },
      slota_right: { correct_response: "left", items: { cs: { asset: "img:pool:slota_right" } } },
    };
    t.assets.images = { a: { source: "bundled", path: "res://a.png" } };
    t.assets.pools = { slota_right: { kind: "image", members: ["a"] } };
    t.blocks[0] = {
      id: "main", n_trials: 12, types: ["slota_left", "slota_right"], ordering: "factorial_random",
      constraints: { balanced: true },
    };
    const errs = validate(t).errors;
    expect(errs.some((e) => e.code === "asset_missing" && e.message.includes("slota_left"))).toBe(true);
    expect(errs.some((e) => e.code === "asset_missing" && e.message.includes("slota_right"))).toBe(false);
  });
});
