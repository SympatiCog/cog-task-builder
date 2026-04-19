import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { importTask } from "../src/serde/import";
import { exportTask } from "../src/serde/export";
import { KEY_ORDER } from "../src/serde/keyOrder";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures", import.meta.url));

function fixtureNames(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

// Walk an object and assert that every dict matching a known canonical section
// emits its known keys in the declared order (unknown keys may follow). We map
// structural location → section name rather than inferring from the dict's own
// fields so we don't accidentally coerce, say, a `theme.text_styles.fix` into
// `theme` key order.
type SectionName = keyof typeof KEY_ORDER;

function checkKeyOrder(
  obj: unknown,
  section: SectionName,
  path: string,
  failures: string[],
): void {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  const known = KEY_ORDER[section] ?? [];
  const actual = Object.keys(obj as Record<string, unknown>);
  const knownActual = actual.filter((k) => known.includes(k));
  const expected = known.filter((k) => knownActual.includes(k));
  if (knownActual.join(",") !== expected.join(",")) {
    failures.push(
      `${path} [section=${section}] actual=[${knownActual.join(",")}] expected=[${expected.join(",")}]`,
    );
  }
}

function walk(task: Record<string, unknown>, failures: string[]): void {
  checkKeyOrder(task, "root", "$", failures);

  const md = task.metadata;
  if (md && typeof md === "object") {
    checkKeyOrder(md, "metadata", "$.metadata", failures);
    const theme = (md as Record<string, unknown>).theme;
    if (theme && typeof theme === "object") {
      checkKeyOrder(theme, "theme", "$.metadata.theme", failures);
      const styles = (theme as Record<string, unknown>).text_styles;
      if (styles && typeof styles === "object") {
        for (const [name, v] of Object.entries(styles)) {
          checkKeyOrder(v, "text_style", `$.metadata.theme.text_styles.${name}`, failures);
        }
      }
    }
  }

  const assets = task.assets;
  if (assets && typeof assets === "object") {
    checkKeyOrder(assets, "assets", "$.assets", failures);
    for (const group of ["images", "audio"] as const) {
      const m = (assets as Record<string, unknown>)[group];
      if (m && typeof m === "object") {
        for (const [id, v] of Object.entries(m)) {
          const sec: SectionName =
            (v as Record<string, unknown> | null)?.source === "remote"
              ? "image_asset_remote"
              : "image_asset_bundled";
          checkKeyOrder(v, sec, `$.assets.${group}.${id}`, failures);
        }
      }
    }
    const pools = (assets as Record<string, unknown>).pools;
    if (pools && typeof pools === "object") {
      for (const [name, v] of Object.entries(pools)) {
        checkKeyOrder(v, "pool", `$.assets.pools.${name}`, failures);
      }
    }
  }

  const inputs = task.inputs;
  if (inputs && typeof inputs === "object") {
    checkKeyOrder(inputs, "inputs", "$.inputs", failures);
    const btns = (inputs as Record<string, unknown>).touchscreen_buttons;
    if (Array.isArray(btns)) {
      btns.forEach((b, i) => {
        checkKeyOrder(b, "touchscreen_button", `$.inputs.touchscreen_buttons[${i}]`, failures);
        const pos = (b as Record<string, unknown>)?.position;
        if (pos && typeof pos === "object") {
          checkKeyOrder(pos, "position_xy", `$.inputs.touchscreen_buttons[${i}].position`, failures);
        }
      });
    }
  }

  const responses = task.responses;
  if (responses && typeof responses === "object") {
    for (const [name, v] of Object.entries(responses)) {
      checkKeyOrder(v, "response", `$.responses.${name}`, failures);
    }
  }

  const stypes = task.stimulus_types;
  if (stypes && typeof stypes === "object") {
    for (const [id, v] of Object.entries(stypes)) {
      checkKeyOrder(v, "stimulus_type", `$.stimulus_types.${id}`, failures);
      const items = (v as Record<string, unknown>)?.items;
      if (items && typeof items === "object") {
        for (const [iid, iv] of Object.entries(items)) {
          checkKeyOrder(iv, "trial_item", `$.stimulus_types.${id}.items.${iid}`, failures);
        }
      }
    }
  }

  const tt = task.trial_template;
  if (Array.isArray(tt)) {
    tt.forEach((item, i) => {
      checkKeyOrder(item, "trial_item", `$.trial_template[${i}]`, failures);
      const cases = (item as Record<string, unknown>)?.cases;
      if (cases && typeof cases === "object") {
        for (const [outcome, cv] of Object.entries(cases)) {
          checkKeyOrder(cv, "feedback_case", `$.trial_template[${i}].cases.${outcome}`, failures);
        }
      }
    });
  }

  const timing = task.timing;
  if (timing && typeof timing === "object") {
    checkKeyOrder(timing, "timing", "$.timing", failures);
  }

  const blocks = task.blocks;
  if (Array.isArray(blocks)) {
    blocks.forEach((b, i) => {
      checkKeyOrder(b, "block", `$.blocks[${i}]`, failures);
      const c = (b as Record<string, unknown>)?.constraints;
      if (c && typeof c === "object") {
        checkKeyOrder(c, "constraints", `$.blocks[${i}].constraints`, failures);
      }
      const instr = (b as Record<string, unknown>)?.instructions;
      if (instr && typeof instr === "object") {
        checkKeyOrder(instr, "instructions", `$.blocks[${i}].instructions`, failures);
      }
      const tl = (b as Record<string, unknown>)?.trial_list;
      if (Array.isArray(tl)) {
        tl.forEach((e, j) => {
          checkKeyOrder(e, "trial_list_entry", `$.blocks[${i}].trial_list[${j}]`, failures);
        });
      }
    });
  }

  const se = task.session_end;
  if (se && typeof se === "object") {
    checkKeyOrder(se, "session_end", "$.session_end", failures);
  }
}

// Recursive canonical-key-order check across every engine fixture. Byte-exact
// round-trip isn't reachable without a bespoke pretty-printer (fixtures use
// author-chosen compact inline dicts that JSON.stringify(..., null, 2) can't
// reproduce); this test covers the next-strongest contract — key order at
// every nesting level — which is what actually matters for diff friendliness.
describe("recursive canonical key order", () => {
  for (const name of fixtureNames()) {
    it(`${name} re-exports with canonical key order at every nesting level`, () => {
      const original = readFileSync(join(FIXTURES_DIR, name), "utf-8");
      const result = importTask(original);
      expect(result.ok).toBe(true);
      const exported = exportTask(result.task!);
      const reparsed = JSON.parse(exported) as Record<string, unknown>;
      const failures: string[] = [];
      walk(reparsed, failures);
      expect(failures, failures.join("\n")).toEqual([]);
    });
  }
});
