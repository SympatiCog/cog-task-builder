import { describe, it, expect } from "vitest";
import {
  renameAudio,
  renameImage,
  renamePool,
  renameTextStyle,
} from "../src/actions/cascades";
import type { TaskJson } from "../src/types/task";

function taskWithRefs(): TaskJson {
  return {
    schema_version: "1.1.0",
    metadata: {
      task_id: "t",
      task_version: "0.1.0",
      theme: {
        text_styles: {
          fix: { font_size_pct: 0.1, color: "#ccc" },
          stim: { font_size_pct: 0.14, color: "#fff" },
        },
      },
    },
    assets: {
      images: {
        left: { source: "bundled", path: "res://l.png" },
        right: { source: "bundled", path: "res://r.png" },
      },
      audio: { beep: { source: "bundled", path: "res://b.ogg" } },
      pools: {
        face: { kind: "image", members: ["left", "right"] },
      },
    },
    inputs: { keyboard: ["f", "j"], touchscreen_buttons: [] },
    responses: {
      L: { keyboard: ["f"] },
      R: { keyboard: ["j"] },
    },
    stimulus_types: {
      go_left: {
        correct_response: "L",
        items: {
          cs: { asset: "img:left", extras: { style: "stim" } },
        },
      },
      go_right: {
        correct_response: "R",
        items: {
          cs: { asset: "img:pool:face" },
        },
      },
    },
    trial_template: [
      {
        id: "fix",
        kind: "text",
        asset: "txt:+",
        extras: { style: "fix" },
      },
      {
        id: "cue",
        kind: "audio",
        asset: "aud:beep",
      },
      {
        id: "cs",
        kind: "image",
        captures_response: true,
      },
      {
        id: "fb",
        kind: "feedback",
        anchor: "cs.end",
        cases: {
          correct: { text: "ok", style: "stim", asset: "img:left" },
          incorrect: { text: "no", style: "fix" },
          timeout: { text: "slow", style: "fix" },
        },
      },
    ],
    timing: { mode: "self_paced" },
    blocks: [],
  };
}

describe("renameImage cascade", () => {
  it("rewrites img:<id> refs in stimulus_types and trial_template", () => {
    const next = renameImage(taskWithRefs(), "left", "left_v2");
    expect(next.stimulus_types.go_left.items.cs.asset).toBe("img:left_v2");
    expect(next.trial_template[3].cases?.correct?.asset).toBe("img:left_v2");
  });

  it("rewrites pool member references", () => {
    const next = renameImage(taskWithRefs(), "left", "left_v2");
    expect(next.assets.pools!.face.members).toEqual(["left_v2", "right"]);
  });

  it("leaves unrelated refs alone", () => {
    const next = renameImage(taskWithRefs(), "left", "left_v2");
    expect(next.stimulus_types.go_right.items.cs.asset).toBe("img:pool:face");
  });

  it("throws on target-id collision", () => {
    expect(() => renameImage(taskWithRefs(), "left", "right")).toThrow();
  });

  it("returns the same task when old === new", () => {
    const t = taskWithRefs();
    expect(renameImage(t, "left", "left")).toBe(t);
  });

  it("moves the entry in assets.images", () => {
    const next = renameImage(taskWithRefs(), "left", "left_v2");
    expect(next.assets.images!["left_v2"]).toEqual({ source: "bundled", path: "res://l.png" });
    expect(next.assets.images!["left"]).toBeUndefined();
  });
});

describe("renameAudio cascade", () => {
  it("rewrites aud:<id> refs", () => {
    const next = renameAudio(taskWithRefs(), "beep", "beep2");
    expect(next.trial_template[1].asset).toBe("aud:beep2");
    expect(next.assets.audio!["beep2"]).toBeDefined();
  });
});

describe("renamePool cascade", () => {
  it("rewrites img:pool:<name> refs", () => {
    const next = renamePool(taskWithRefs(), "face", "face2");
    expect(next.stimulus_types.go_right.items.cs.asset).toBe("img:pool:face2");
    expect(next.assets.pools!["face2"]).toBeDefined();
  });
});

describe("renameTextStyle cascade", () => {
  it("rewrites extras.style in types, template, and cases", () => {
    const next = renameTextStyle(taskWithRefs(), "stim", "stim_v2");
    expect(next.stimulus_types.go_left.items.cs.extras?.style).toBe("stim_v2");
    expect(next.trial_template[3].cases?.correct?.style).toBe("stim_v2");
    expect(next.metadata.theme?.text_styles?.["stim_v2"]).toBeDefined();
    expect(next.metadata.theme?.text_styles?.["stim"]).toBeUndefined();
  });

  it("leaves non-matching style refs intact", () => {
    const next = renameTextStyle(taskWithRefs(), "stim", "stim_v2");
    expect(next.trial_template[0].extras?.style).toBe("fix");
  });
});
