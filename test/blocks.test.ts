import { describe, it, expect } from "vitest";
import {
  addBlock,
  deleteBlock,
  moveBlock,
  setOrdering,
  updateBlock,
} from "../src/actions/blocks";
import { newTask } from "../src/defaults/newTask";

describe("addBlock", () => {
  it("appends a new block with default ordering", () => {
    const next = addBlock(newTask(), "practice");
    expect(next.blocks[next.blocks.length - 1].id).toBe("practice");
    expect(next.blocks[next.blocks.length - 1].ordering).toBe("factorial_random");
  });

  it("is idempotent on existing id", () => {
    const t = addBlock(newTask(), "practice");
    const next = addBlock(t, "practice");
    expect(next).toBe(t);
  });
});

describe("moveBlock", () => {
  it("swaps with neighbor", () => {
    let t = newTask();
    t = addBlock(t, "a");
    t = addBlock(t, "b");
    t = addBlock(t, "c");
    const next = moveBlock(t, 2, -1);
    expect(next.blocks.map((b) => b.id)).toEqual(["a", "c", "b"]);
  });

  it("is identity at the boundaries", () => {
    let t = newTask();
    t = addBlock(t, "a");
    expect(moveBlock(t, 0, -1)).toBe(t);
    expect(moveBlock(t, 0, 1)).toBe(t);
  });
});

describe("deleteBlock", () => {
  it("removes by index", () => {
    let t = newTask();
    t = addBlock(t, "a");
    t = addBlock(t, "b");
    const next = deleteBlock(t, 0);
    expect(next.blocks.map((b) => b.id)).toEqual(["b"]);
  });
});

describe("setOrdering drops irrelevant fields", () => {
  it("removes constraints when switching from factorial_random", () => {
    let t = newTask();
    t = addBlock(t, "a");
    t = updateBlock(t, 0, { constraints: { max_type_repeat: 3, balanced: true } });
    const next = setOrdering(t, 0, "fixed");
    expect(next.blocks[0].constraints).toBeUndefined();
    expect(next.blocks[0].ordering).toBe("fixed");
  });

  it("removes trial_list_url when leaving csv", () => {
    let t = newTask();
    t = addBlock(t, "a");
    t = updateBlock(t, 0, { trial_list_url: "https://example.com/t.csv", ordering: "csv" });
    const next = setOrdering(t, 0, "fixed");
    expect(next.blocks[0].trial_list_url).toBeUndefined();
  });
});
