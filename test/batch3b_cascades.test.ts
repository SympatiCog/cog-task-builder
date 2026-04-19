import { describe, it, expect } from "vitest";
import {
  renameResponse,
  renameStimulusType,
  renameTouchscreenButton,
} from "../src/actions/cascades";
import { deleteTouchButton } from "../src/actions/inputs";
import { deleteStimulusType } from "../src/actions/stimulusTypes";
import type { TaskJson } from "../src/types/task";

function baseline(): TaskJson {
  return {
    schema_version: "1.1.0",
    metadata: { task_id: "t", task_version: "0.1.0" },
    assets: { images: {}, audio: {} },
    inputs: {
      keyboard: ["f", "j"],
      touchscreen_buttons: [
        { id: "btn_left", label: "◀", position: "bottom_left", size_px: 140 },
        { id: "btn_right", label: "▶", position: "bottom_right", size_px: 140 },
      ],
    },
    responses: {
      left: { keyboard: ["f"], touchscreen: ["btn_left"] },
      right: { keyboard: ["j"], touchscreen: ["btn_right"] },
    },
    stimulus_types: {
      go_left: { correct_response: "left", items: { cs: { asset: "txt:L" } } },
      go_right: { correct_response: "right", items: { cs: { asset: "txt:R" } } },
    },
    trial_template: [{ id: "cs", kind: "text", captures_response: true }],
    timing: { mode: "self_paced" },
    blocks: [
      {
        id: "main",
        n_trials: 4,
        types: ["go_left", "go_right"],
        ordering: "factorial_random",
      },
    ],
  };
}

describe("renameResponse cascades into stimulus_types.correct_response", () => {
  it("updates every referring type", () => {
    const next = renameResponse(baseline(), "left", "L2");
    expect(next.responses["L2"]).toBeDefined();
    expect(next.responses["left"]).toBeUndefined();
    expect(next.stimulus_types.go_left.correct_response).toBe("L2");
    expect(next.stimulus_types.go_right.correct_response).toBe("right");
  });
});

describe("renameStimulusType cascades into blocks.types and trial_list", () => {
  it("updates block.types", () => {
    const next = renameStimulusType(baseline(), "go_left", "left_v2");
    expect(next.blocks[0].types).toEqual(["left_v2", "go_right"]);
  });
});

describe("renameTouchscreenButton cascades into responses.touchscreen", () => {
  it("updates every response binding", () => {
    const next = renameTouchscreenButton(baseline(), "btn_left", "btn_l2");
    expect(next.responses.left.touchscreen).toEqual(["btn_l2"]);
    expect(next.responses.right.touchscreen).toEqual(["btn_right"]);
  });
});

describe("deleteTouchButton drops id from response bindings", () => {
  it("removes the deleted id", () => {
    const next = deleteTouchButton(baseline(), "btn_left");
    expect(next.inputs.touchscreen_buttons).toEqual([
      { id: "btn_right", label: "▶", position: "bottom_right", size_px: 140 },
    ]);
    expect(next.responses.left.touchscreen).toEqual([]);
  });
});

describe("deleteStimulusType drops id from blocks", () => {
  it("removes the deleted id from block.types", () => {
    const next = deleteStimulusType(baseline(), "go_left");
    expect(next.blocks[0].types).toEqual(["go_right"]);
    expect(next.stimulus_types.go_left).toBeUndefined();
  });
});
