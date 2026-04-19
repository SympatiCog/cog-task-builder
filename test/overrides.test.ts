import { describe, it, expect } from "vitest";
import { computeOverridesByField, typesOverridingItem } from "../src/utils/overrides";
import type { StimulusTypes, TrialItem } from "../src/types/task";

const cs: TrialItem = { id: "cs", kind: "image", captures_response: true };
const fb: TrialItem = { id: "fb", kind: "feedback" };

const types: StimulusTypes = {
  slotA_left: {
    correct_response: "A_left",
    items: { cs: { asset: "img:pool:slotA_left", extras: { style: "stim" } } },
  },
  slotA_right: {
    correct_response: "A_right",
    items: { cs: { asset: "img:pool:slotA_right" } },
  },
  slotB_left: {
    correct_response: "B_left",
    items: { cs: { asset: "img:pool:slotB_left" } },
  },
  slotB_right: {
    correct_response: "B_right",
    items: { cs: { asset: "img:pool:slotB_right" }, fb: { cases: { correct: { text: "A!" } } } },
  },
};

describe("computeOverridesByField", () => {
  it("collects every type overriding each specific field on the cs item", () => {
    const out = computeOverridesByField(cs, types);
    expect(out.asset?.sort()).toEqual(["slotA_left", "slotA_right", "slotB_left", "slotB_right"]);
    expect(out["extras.style"]).toEqual(["slotA_left"]);
  });

  it("expands cases.<outcome> into its own key", () => {
    const out = computeOverridesByField(fb, types);
    expect(out["cases.correct"]).toEqual(["slotB_right"]);
    expect(out["cases.incorrect"]).toBeUndefined();
  });

  it("returns empty object for an item no type overrides", () => {
    const ghost: TrialItem = { id: "ghost", kind: "text" };
    expect(computeOverridesByField(ghost, types)).toEqual({});
  });
});

describe("typesOverridingItem", () => {
  it("returns dedupe'd list of types touching the item id", () => {
    expect(typesOverridingItem(cs, types).sort()).toEqual([
      "slotA_left", "slotA_right", "slotB_left", "slotB_right",
    ]);
  });

  it("ignores types that don't touch the item", () => {
    expect(typesOverridingItem(fb, types)).toEqual(["slotB_right"]);
  });
});
