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

  // ---- P0 fix regressions (2026-04-19 code review) ----

  it("early-returns on shape failure (no cascading errors from later passes)", () => {
    // stimulus_types as an array (not object) is a shape failure. Without the
    // early-return, identifier pass would run Object.keys on the array and
    // emit a swarm of invalid_identifier errors for "0","1","2".
    const r = validate({ schema_version: "1.1.0", stimulus_types: [1, 2, 3] } as unknown as TaskJson);
    expect(r.errors.some((e) => e.code === "wrong_type")).toBe(true);
    expect(r.errors.some((e) => e.code === "invalid_identifier")).toBe(false);
  });

  it("invalid_anchor_axis for .start axis (engine rejects)", () => {
    const t = base();
    t.trial_template = [
      { id: "fix", kind: "text" },
      { id: "cs", kind: "text", anchor: "fix.start", captures_response: true },
    ];
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "invalid_anchor_axis")).toBe(true);
    expect(r.errors.some((e) => e.code === "invalid_anchor")).toBe(false);
    expect(r.errors.some((e) => e.code === "anchor_target_missing")).toBe(false);
  });

  it("invalid_anchor (not invalid_anchor_axis) for 3-part anchor", () => {
    // Engine SchemaValidator.gd:624-628 emits invalid_anchor when
    // split('.').size() != 2. We must match — a 3-part anchor like "a.b.end"
    // must NOT slip through as invalid_anchor_axis.
    const t = base();
    t.trial_template = [
      { id: "fix", kind: "text" },
      { id: "cs", kind: "text", anchor: "fix.inner.end", captures_response: true },
    ];
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "invalid_anchor")).toBe(true);
    expect(r.errors.some((e) => e.code === "invalid_anchor_axis")).toBe(false);
  });

  it("anchor_target_missing (not invalid_anchor_axis) for missing target with bad axis", () => {
    // Engine checks target existence BEFORE axis validity. An anchor like
    // "ghost.start" should emit `anchor_target_missing`, not
    // `invalid_anchor_axis`.
    const t = base();
    t.trial_template[0].anchor = "ghost.start";
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "anchor_target_missing")).toBe(true);
    expect(r.errors.some((e) => e.code === "invalid_anchor_axis")).toBe(false);
  });

  it("unknown_type (not unknown_label) for undeclared block.types[] entry", () => {
    const t = base();
    t.blocks[0] = { id: "main", n_trials: 2, types: ["ghost"], ordering: "fixed" };
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "unknown_type")).toBe(true);
    expect(r.errors.some((e) => e.code === "unknown_label" && e.path.startsWith("blocks["))).toBe(false);
  });

  it("unknown_kind on trial_template item", () => {
    const t = base();
    // @ts-expect-error intentional bad kind
    t.trial_template[0].kind = "video";
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "unknown_kind")).toBe(true);
  });

  it("missing kind on trial_template item", () => {
    const t = base();
    // @ts-expect-error deliberately absent
    delete t.trial_template[0].kind;
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "missing" && e.path.endsWith(".kind"))).toBe(true);
  });

  it("missing ordering on block", () => {
    const t = base();
    // @ts-expect-error deliberately absent
    delete t.blocks[0].ordering;
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "missing" && e.path === "blocks[0].ordering")).toBe(true);
  });

  it("invalid_ordering on block", () => {
    const t = base();
    // @ts-expect-error intentional bad value
    t.blocks[0].ordering = "shuffle";
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "invalid_ordering")).toBe(true);
  });

  it("invalid_ordering does not suppress unknown_type on the same block", () => {
    // Engine SchemaValidator.gd:777-792 uses sequential ifs — never returns.
    // The client must not early-return after an ordering error, or authors
    // miss simultaneous type-name bugs.
    const t = base();
    t.blocks[0] = {
      id: "main",
      n_trials: 2,
      types: ["ghost"],
      // @ts-expect-error intentional bad value
      ordering: "shuffle",
    };
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "invalid_ordering")).toBe(true);
    expect(r.errors.some((e) => e.code === "unknown_type")).toBe(true);
  });

  it("missing n_trials on factorial_random / fixed block", () => {
    const t = base();
    // Remove n_trials entirely
    delete t.blocks[0].n_trials;
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "missing" && e.path === "blocks[0].n_trials")).toBe(true);

    const t2 = base();
    t2.blocks[0] = { id: "main", n_trials: 0, types: ["left"], ordering: "fixed" };
    const r2 = validate(t2);
    expect(r2.errors.some((e) => e.code === "missing" && e.path === "blocks[0].n_trials")).toBe(true);
  });

  it("non_constant_expression warning for object correct_response", () => {
    const t = base();
    // @ts-expect-error intentional expression form
    t.stimulus_types.left.correct_response = { ref: "something" };
    const r = validate(t);
    expect(r.warnings.some((w) => w.code === "non_constant_expression")).toBe(true);
    // Should NOT fire `missing` — the expression form is accepted-with-warning.
    expect(r.errors.some((e) => e.code === "missing" && e.path.endsWith(".correct_response"))).toBe(false);
  });

  it("expression-form correct_response doesn't block unknown_label on sibling types", () => {
    // Guards against an over-eager early-return: the non_constant_expression
    // warning on one stimulus_type must not suppress the unknown_label error
    // that the next type's literal-string correct_response would raise.
    const t = base();
    t.stimulus_types = {
      // @ts-expect-error intentional expression form
      left: { correct_response: { ref: "x" }, items: { cs: { asset: "txt:L" } } },
      right: { correct_response: "ghost", items: { cs: { asset: "txt:R" } } },
    };
    const r = validate(t);
    expect(r.warnings.some((w) => w.code === "non_constant_expression")).toBe(true);
    expect(r.errors.some((e) => e.code === "unknown_label" && e.path.includes("right.correct_response"))).toBe(true);
  });

  it("duplicate touchscreen button id", () => {
    const t = base();
    t.inputs = {
      keyboard: ["f"],
      touchscreen_buttons: [
        { id: "left", label: "L", position: "middle_left" },
        { id: "left", label: "L2", position: "middle_right" },
      ],
    };
    const r = validate(t);
    expect(r.errors.some((e) => e.code === "duplicate" && e.path.includes("touchscreen_buttons"))).toBe(true);
  });

  describe("remote asset checks", () => {
    function remoteBase(): TaskJson {
      const t = base();
      t.assets.allowed_hosts = ["cdn.example.org"];
      t.assets.images = {
        im: {
          source: "remote",
          url: "https://cdn.example.org/x.png",
          sha256: "a".repeat(64),
        },
      };
      return t;
    }

    it("clean remote asset passes", () => {
      const r = validate(remoteBase());
      expect(r.errors).toEqual([]);
    });

    it("missing url on remote asset", () => {
      const t = remoteBase();
      // @ts-expect-error deliberately absent
      delete t.assets.images!.im.url;
      const r = validate(t);
      expect(r.errors.some((e) => e.code === "missing" && e.path.endsWith(".url"))).toBe(true);
    });

    it("missing sha256 on remote asset", () => {
      const t = remoteBase();
      // @ts-expect-error deliberately absent
      delete t.assets.images!.im.sha256;
      const r = validate(t);
      expect(r.errors.some((e) => e.code === "missing" && e.path.endsWith(".sha256"))).toBe(true);
    });

    it("non_https URL on remote asset", () => {
      const t = remoteBase();
      // @ts-expect-error intentional insecure URL
      t.assets.images!.im.url = "http://cdn.example.org/x.png";
      const r = validate(t);
      expect(r.errors.some((e) => e.code === "non_https")).toBe(true);
    });

    it("host_not_whitelisted on remote asset", () => {
      const t = remoteBase();
      t.assets.allowed_hosts = ["other.example.org"];
      const r = validate(t);
      expect(r.errors.some((e) => e.code === "host_not_whitelisted")).toBe(true);
    });

    it("missing allowed_hosts when any asset is remote", () => {
      const t = remoteBase();
      delete t.assets.allowed_hosts;
      const r = validate(t);
      expect(r.errors.some((e) => e.code === "missing" && e.path === "assets.allowed_hosts")).toBe(true);
    });

    it("bundled-only task tolerates absent allowed_hosts", () => {
      const t = base();
      t.assets.images = { im: { source: "bundled", path: "res://x.png" } };
      const r = validate(t);
      expect(r.errors.some((e) => e.code === "missing" && e.path === "assets.allowed_hosts")).toBe(false);
    });
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
