// Resolve a raw.githubusercontent.com folder URL into a list of image files,
// each with its bytes already fetched and SHA-256 hashed. Uses GitHub's
// contents API (CORS-enabled, anonymous-access within rate limits). Handles
// trailing slashes, URL-encoded path segments, and non-image entries.
//
// URL form expected:
//   https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>[/]
// <ref> is usually a branch name or a full commit SHA. A commit SHA is
// strongly recommended — branch-pinned URLs can silently drift.

export interface GitHubScanProgress {
  phase: "listing" | "downloading";
  done: number;
  total: number;
}

export interface ScannedFile {
  name: string;
  blob: Blob;
  sha256: string;
  downloadUrl: string; // canonical https:// URL for engine registration
}

export interface GitHubScanResult {
  files: ScannedFile[];
  urlPrefix: string;  // the scanned folder URL normalized to end with "/"
}

export function parseGitHubRawFolderUrl(url: string): {
  owner: string; repo: string; ref: string; path: string;
} | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.host !== "raw.githubusercontent.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 4) return null;
  const [owner, repo, ref, ...rest] = parts;
  return { owner, repo, ref, path: rest.join("/") };
}

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function isImageName(name: string): boolean {
  return EXT_MIME[extOf(name)] !== undefined;
}

export function guessMimeFromName(name: string, fallback = "application/octet-stream"): string {
  return EXT_MIME[extOf(name)] ?? fallback;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export async function scanGitHubRawFolder(
  url: string,
  onProgress?: (p: GitHubScanProgress) => void,
): Promise<GitHubScanResult> {
  const parsed = parseGitHubRawFolderUrl(url);
  if (!parsed) throw new Error("Only raw.githubusercontent.com folder URLs are supported.");

  onProgress?.({ phase: "listing", done: 0, total: 1 });
  const encodedPath = parsed.path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(parsed.ref)}`;
  const listRes = await fetch(apiUrl, { headers: { accept: "application/vnd.github+json" } });
  if (!listRes.ok) {
    if (listRes.status === 404) throw new Error("Folder not found on GitHub.");
    if (listRes.status === 403) throw new Error("GitHub anonymous rate limit hit (~60/hr per IP). Try again later or use a smaller folder.");
    throw new Error(`GitHub listing failed: ${listRes.status} ${listRes.statusText}`);
  }
  const entries: unknown = await listRes.json();
  if (!Array.isArray(entries)) throw new Error("URL resolves to a file, not a folder.");

  const imageEntries = entries.filter(
    (e): e is { name: string; type: string; download_url: string } =>
      typeof e === "object" && e !== null &&
      (e as { type?: unknown }).type === "file" &&
      typeof (e as { name?: unknown }).name === "string" &&
      typeof (e as { download_url?: unknown }).download_url === "string" &&
      isImageName((e as { name: string }).name),
  );
  if (imageEntries.length === 0) throw new Error("No image files in that folder.");

  const files: ScannedFile[] = [];
  onProgress?.({ phase: "downloading", done: 0, total: imageEntries.length });
  for (let i = 0; i < imageEntries.length; i++) {
    const e = imageEntries[i];
    const res = await fetch(e.download_url);
    if (!res.ok) throw new Error(`Download failed: ${e.name} (${res.status})`);
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    files.push({
      name: e.name,
      blob: new Blob([blob], { type: blob.type || guessMimeFromName(e.name) }),
      sha256: toHex(new Uint8Array(hash)),
      downloadUrl: e.download_url,
    });
    onProgress?.({ phase: "downloading", done: i + 1, total: imageEntries.length });
  }

  const urlPrefix = url.endsWith("/") ? url : url + "/";
  return { files, urlPrefix };
}
