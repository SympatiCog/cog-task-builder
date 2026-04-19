import { describe, it, expect } from "vitest";
import {
  addTrialItem,
  deleteTrialItem,
  renameTrialItem,
  reorderTrialItems,
  setCapturesResponse,
  stubItem,
} from "../src/actions/trialTemplate";
import { newTask } from "../src/defaults/newTask";
import type { TaskJson } from "../src/types/task";

function tpl(ids: string[]): TaskJson {
  const t = newTask();
  t.trial_template = ids.map((id, i) => ({
    id, kind: "text", onset_ms: 0, duration_ms: 0, captures_response: i === ids.length - 1,
  }));
  return t;
}

describe("reorderTrialItems", () => {
  it("moves item and leaves others in relative order", () => {
    const next = reorderTrialItems(tpl(["a", "b", "c", "d"]), 0, 2);
    expect(next.trial_template.map((it) => it.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("is identity when oldIndex === newIndex", () => {
    const t = tpl(["a", "b"]);
    expect(reorderTrialItems(t, 0, 0)).toBe(t);
  });
});

describe("setCapturesResponse enforces uniqueness", () => {
  it("sets exactly one item's captures_response to true", () => {
    const next = setCapturesResponse(tpl(["a", "b", "c"]), 0);
    expect(next.trial_template.map((it) => it.captures_response)).toEqual([true, false, false]);
  });
});

describe("deleteTrialItem cascades into overrides and anchors", () => {
  it("drops overrides targeting the deleted id and null-outs anchors", () => {
    const t = newTask();
    t.trial_template = [
      { id: "fix", kind: "text" },
      { id: "cs", kind: "text", captures_response: true },
      { id: "fb", kind: "feedback", anchor: "cs.end" },
    ];
    t.stimulus_types = {
      go: { correct_response: "left", items: { cs: { asset: "txt:X" }, fix: { extras: { style: "fix" } } } },
    };
    const next = deleteTrialItem(t, 1); // delete cs
    expect(next.trial_template.find((it) => it.id === "cs")).toBeUndefined();
    expect(next.trial_template.find((it) => it.id === "fb")?.anchor).toBeUndefined();
    expect(next.stimulus_types.go.items.cs).toBeUndefined();
    expect(next.stimulus_types.go.items.fix).toBeDefined();
  });
});

describe("renameTrialItem rewrites anchors pointing at the old id", () => {
  it("rewrites anchor targets", () => {
    const t = newTask();
    t.trial_template = [
      { id: "cs", kind: "text", captures_response: true },
      { id: "fb", kind: "feedback", anchor: "cs.end" },
    ];
    t.stimulus_types = { go: { correct_response: "left", items: { cs: { asset: "txt:X" } } } };
    const next = renameTrialItem(t, "cs", "cs_v2");
    expect(next.trial_template.find((it) => it.id === "fb")?.anchor).toBe("cs_v2.end");
    expect(next.stimulus_types.go.items.cs_v2).toBeDefined();
    expect(next.stimulus_types.go.items.cs).toBeUndefined();
  });
});

describe("stubItem sensible defaults", () => {
  it("feedback stub includes all three cases anchored to cs.end", () => {
    const fb = stubItem("feedback", "fb");
    expect(fb.anchor).toBe("cs.end");
    expect(Object.keys(fb.cases ?? {}).sort()).toEqual(["correct", "incorrect", "timeout"]);
  });
});

describe("addTrialItem appends", () => {
  it("adds to end", () => {
    const next = addTrialItem(tpl(["a"]), { id: "b", kind: "text" });
    expect(next.trial_template.map((it) => it.id)).toEqual(["a", "b"]);
  });
});
