import { describe, it, expect } from "vitest";
import { parseGitHubRawFolderUrl, guessMimeFromName } from "../src/utils/githubFolder";

describe("parseGitHubRawFolderUrl", () => {
  it("parses the canonical form with trailing slash", () => {
    const r = parseGitHubRawFolderUrl(
      "https://raw.githubusercontent.com/SympatiCog/test-stim/da7af9a83b28b6cd8d735e7c87365101e36daad6/arc-symbols/slotA_left/",
    );
    expect(r).toEqual({
      owner: "SympatiCog",
      repo: "test-stim",
      ref: "da7af9a83b28b6cd8d735e7c87365101e36daad6",
      path: "arc-symbols/slotA_left",
    });
  });

  it("parses without trailing slash", () => {
    const r = parseGitHubRawFolderUrl(
      "https://raw.githubusercontent.com/o/r/main/sub/folder",
    );
    expect(r).toEqual({ owner: "o", repo: "r", ref: "main", path: "sub/folder" });
  });

  it("returns null for non-raw hosts", () => {
    expect(parseGitHubRawFolderUrl("https://github.com/o/r/blob/main/f.png")).toBeNull();
    expect(parseGitHubRawFolderUrl("https://stimuli.example.com/a/b")).toBeNull();
  });

  it("returns null for paths with too few segments", () => {
    expect(parseGitHubRawFolderUrl("https://raw.githubusercontent.com/o/r")).toBeNull();
    expect(parseGitHubRawFolderUrl("https://raw.githubusercontent.com/")).toBeNull();
  });

  it("returns null for non-URLs", () => {
    expect(parseGitHubRawFolderUrl("not a url")).toBeNull();
  });
});

describe("guessMimeFromName", () => {
  it("maps common image extensions", () => {
    expect(guessMimeFromName("a.png")).toBe("image/png");
    expect(guessMimeFromName("A.JPG")).toBe("image/jpeg");
    expect(guessMimeFromName("x.jpeg")).toBe("image/jpeg");
    expect(guessMimeFromName("x.webp")).toBe("image/webp");
    expect(guessMimeFromName("x.svg")).toBe("image/svg+xml");
  });

  it("falls back on unknown extensions", () => {
    expect(guessMimeFromName("x.xyz")).toBe("application/octet-stream");
    expect(guessMimeFromName("x.xyz", "")).toBe("");
  });
});
