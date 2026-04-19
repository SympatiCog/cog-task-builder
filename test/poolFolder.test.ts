import { describe, it, expect } from "vitest";
import { applyFolderToPool, type PreparedEntry } from "../src/actions/poolFolder";
import { addPool } from "../src/actions/assets";
import { newTask } from "../src/defaults/newTask";

function entry(id: string, path: string): PreparedEntry {
  return {
    id,
    originalName: `${id}.png`,
    relativePath: `${id}.png`,
    asset: { source: "bundled", path },
  };
}

function remoteEntry(id: string, url: string, sha: string): PreparedEntry {
  return {
    id,
    originalName: `${id}.png`,
    relativePath: `${id}.png`,
    asset: { source: "remote", url, sha256: sha },
  };
}

describe("applyFolderToPool — bundled", () => {
  it("registers images and unions members into the named pool", () => {
    let t = newTask();
    t = addPool(t, "face");
    const next = applyFolderToPool(t, "face", [
      entry("m_h_01", "res://assets/faces/m_h_01.png"),
      entry("m_h_02", "res://assets/faces/m_h_02.png"),
    ]);
    expect(next.assets.images!["m_h_01"]).toEqual({
      source: "bundled",
      path: "res://assets/faces/m_h_01.png",
    });
    expect(next.assets.pools!["face"].members).toEqual(["m_h_01", "m_h_02"]);
  });

  it("preserves existing pool members and appends without duplication", () => {
    let t = newTask();
    t = addPool(t, "face");
    t = applyFolderToPool(t, "face", [entry("a", "res://a.png")]);
    const next = applyFolderToPool(t, "face", [
      entry("a", "res://a.png"),
      entry("b", "res://b.png"),
    ]);
    expect(next.assets.pools!["face"].members).toEqual(["a", "b"]);
  });

  it("is a no-op when entries is empty", () => {
    let t = newTask();
    t = addPool(t, "face");
    expect(applyFolderToPool(t, "face", [])).toBe(t);
  });

  it("bumps schema_version to 1.1.0 if it was 1.0.0", () => {
    // addPool already bumps 1.0.0 → 1.1.0; this test exercises the
    // applyFolderToPool fallback path on an already-bumped task. A direct
    // 1.0.0-with-pools input would be malformed per the engine's own rules.
    let t = newTask();
    t = addPool(t, "face");
    const next = applyFolderToPool(t, "face", [entry("a", "res://a.png")]);
    expect(next.schema_version).toBe("1.1.0");
  });

  it("is a no-op when the named pool doesn't exist", () => {
    const t = newTask();
    expect(applyFolderToPool(t, "ghost", [entry("a", "res://a.png")])).toBe(t);
  });
});

describe("applyFolderToPool — remote", () => {
  it("adds the URL host to allowed_hosts when not already present", () => {
    let t = newTask();
    t = addPool(t, "face");
    const next = applyFolderToPool(t, "face", [
      remoteEntry("a", "https://stimuli.example.com/a.png", "0".repeat(64)),
      remoteEntry("b", "https://stimuli.example.com/b.png", "1".repeat(64)),
    ]);
    expect(next.assets.allowed_hosts).toEqual(["stimuli.example.com"]);
  });

  it("doesn't duplicate an already-allowed host", () => {
    let t = newTask();
    t = { ...t, assets: { ...t.assets, allowed_hosts: ["stimuli.example.com"] } };
    t = addPool(t, "face");
    const next = applyFolderToPool(t, "face", [
      remoteEntry("a", "https://stimuli.example.com/a.png", "0".repeat(64)),
    ]);
    expect(next.assets.allowed_hosts).toEqual(["stimuli.example.com"]);
  });

  it("merges multiple distinct hosts", () => {
    let t = newTask();
    t = addPool(t, "face");
    const next = applyFolderToPool(t, "face", [
      remoteEntry("a", "https://a.example.com/a.png", "0".repeat(64)),
      remoteEntry("b", "https://b.example.com/b.png", "1".repeat(64)),
    ]);
    expect(next.assets.allowed_hosts?.sort()).toEqual(["a.example.com", "b.example.com"]);
  });
});
