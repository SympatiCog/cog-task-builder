import { describe, it, expect } from "vitest";
import { newTask } from "../src/defaults/newTask";
import {
  addImage,
  addPool,
  deleteImage,
  setImage,
} from "../src/actions/assets";

describe("addPool bumps schema_version to 1.1.0", () => {
  it("bumps 1.0.0 → 1.1.0 on pool creation", () => {
    const t = { ...newTask(), schema_version: "1.0.0" as const };
    const next = addPool(t, "face");
    expect(next.schema_version).toBe("1.1.0");
  });

  it("leaves 1.1.0 unchanged", () => {
    const t = newTask();
    const next = addPool(t, "face");
    expect(next.schema_version).toBe("1.1.0");
  });
});

describe("deleteImage removes pool memberships", () => {
  it("drops the deleted id from every pool's members", () => {
    let t = newTask();
    t = addImage(t, "left");
    t = addImage(t, "right");
    t = addPool(t, "face");
    t = setImage(t, "left", { source: "bundled", path: "res://l.png" });
    // Add left+right to pool
    t = {
      ...t,
      assets: {
        ...t.assets,
        pools: { face: { kind: "image", members: ["left", "right"] } },
      },
    };

    const next = deleteImage(t, "left");
    expect(next.assets.pools!.face.members).toEqual(["right"]);
    expect(next.assets.images!["left"]).toBeUndefined();
  });
});

describe("addImage is idempotent on existing id", () => {
  it("returns the same task when id already exists", () => {
    let t = newTask();
    t = addImage(t, "left");
    const next = addImage(t, "left");
    expect(next).toBe(t);
  });
});
