import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseGitHubRawFolderUrl,
  guessMimeFromName,
  scanGitHubRawFolder,
  type GitHubScanProgress,
} from "../src/utils/githubFolder";

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

// End-to-end with a mocked fetch. Covers the listing → download → hash
// pipeline including the progress-reporting contract (three phase events
// minimum: listing, downloading-start, one per downloaded file) and one
// download failure mid-scan.

describe("scanGitHubRawFolder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(
    routes: Record<string, (url: string) => Promise<Response> | Response>,
  ): void {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        for (const [matcher, handler] of Object.entries(routes)) {
          if (url.startsWith(matcher)) return Promise.resolve(handler(url));
        }
        return Promise.resolve(new Response("not mocked", { status: 404 }));
      }) as unknown as typeof fetch,
    );
  }

  it("lists, downloads, hashes, and emits progress events", async () => {
    const folder =
      "https://raw.githubusercontent.com/o/r/main/arc/slotA_left/";
    const listing = [
      {
        name: "a.png",
        type: "file",
        download_url: "https://raw.githubusercontent.com/o/r/main/arc/slotA_left/a.png",
      },
      {
        name: "b.jpg",
        type: "file",
        download_url: "https://raw.githubusercontent.com/o/r/main/arc/slotA_left/b.jpg",
      },
      // Non-image: filtered out by isImageName.
      {
        name: "notes.txt",
        type: "file",
        download_url: "https://raw.githubusercontent.com/o/r/main/arc/slotA_left/notes.txt",
      },
      // Directory: filtered out by type check.
      {
        name: "sub",
        type: "dir",
        download_url: "",
      },
    ];
    mockFetch({
      "https://api.github.com/repos/o/r/contents/arc/slotA_left": () =>
        new Response(JSON.stringify(listing), { status: 200 }),
      "https://raw.githubusercontent.com/o/r/main/arc/slotA_left/a.png": () =>
        new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
      "https://raw.githubusercontent.com/o/r/main/arc/slotA_left/b.jpg": () =>
        new Response(new Uint8Array([4, 5, 6, 7]), { status: 200 }),
    });

    const progress: GitHubScanProgress[] = [];
    const res = await scanGitHubRawFolder(folder, (p) => progress.push(p));

    expect(res.urlPrefix).toBe(folder);
    expect(res.files).toHaveLength(2);
    expect(res.files.map((f) => f.name).sort()).toEqual(["a.png", "b.jpg"]);
    // SHA-256 hash format: 64 lowercase hex chars.
    expect(res.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    // Distinct payloads → distinct hashes.
    expect(res.files[0].sha256).not.toBe(res.files[1].sha256);

    // Progress: listing first, then downloading ticks monotonically from
    // 0 (start) through 2 (final). Pin the exact ordering — a future
    // regression that emits done=1 before done=0 (or reorders listing
    // vs. downloading) would slip past a looser "some" assertion.
    expect(progress[0]).toEqual({ phase: "listing", done: 0, total: 1 });
    const downloads = progress
      .filter((p) => p.phase === "downloading")
      .map((p) => p.done);
    expect(downloads).toEqual([0, 1, 2]);
    expect(progress.at(-1)).toEqual({ phase: "downloading", done: 2, total: 2 });
  });

  it("throws on 404 listing with a friendly message", async () => {
    mockFetch({
      "https://api.github.com/": () => new Response("{}", { status: 404 }),
    });
    await expect(
      scanGitHubRawFolder("https://raw.githubusercontent.com/o/r/main/ghost/"),
    ).rejects.toThrow(/Folder not found/);
  });

  it("throws on 403 listing with a rate-limit hint", async () => {
    mockFetch({
      "https://api.github.com/": () => new Response("{}", { status: 403 }),
    });
    await expect(
      scanGitHubRawFolder("https://raw.githubusercontent.com/o/r/main/busy/"),
    ).rejects.toThrow(/rate limit/);
  });

  it("throws when listing resolves to a file, not a folder", async () => {
    mockFetch({
      "https://api.github.com/": () =>
        new Response(JSON.stringify({ name: "f.png", type: "file" }), { status: 200 }),
    });
    await expect(
      scanGitHubRawFolder("https://raw.githubusercontent.com/o/r/main/f.png"),
    ).rejects.toThrow(/file, not a folder/);
  });

  it("throws when the folder has no images", async () => {
    mockFetch({
      "https://api.github.com/": () =>
        new Response(
          JSON.stringify([
            { name: "readme.md", type: "file", download_url: "u" },
          ]),
          { status: 200 },
        ),
    });
    await expect(
      scanGitHubRawFolder("https://raw.githubusercontent.com/o/r/main/docs/"),
    ).rejects.toThrow(/No image files/);
  });

  it("throws and stops when a download fails mid-scan", async () => {
    const listing = [
      {
        name: "a.png",
        type: "file",
        download_url: "https://cdn/a.png",
      },
      {
        name: "b.png",
        type: "file",
        download_url: "https://cdn/b.png",
      },
    ];
    mockFetch({
      "https://api.github.com/": () => new Response(JSON.stringify(listing), { status: 200 }),
      "https://cdn/a.png": () => new Response(new Uint8Array([0]), { status: 200 }),
      "https://cdn/b.png": () => new Response("gone", { status: 404 }),
    });
    await expect(
      scanGitHubRawFolder("https://raw.githubusercontent.com/o/r/main/folder/"),
    ).rejects.toThrow(/Download failed: b\.png/);
  });

  it("rejects non-raw URLs up-front (no fetch call)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await expect(
      scanGitHubRawFolder("https://stimuli.example.com/a/b"),
    ).rejects.toThrow(/raw\.githubusercontent\.com/);
    expect(fetchMock).not.toHaveBeenCalled();
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
