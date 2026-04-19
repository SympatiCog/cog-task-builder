// Normalize an arbitrary filename into an identifier matching ^[a-z0-9_]+$
// (the engine's id regex). Strips the extension, lowercases, replaces any
// non-[a-z0-9] run with a single underscore, and trims leading/trailing
// underscores. Falls back to a deterministic `img_<hex>` when nothing usable
// remains (e.g., filenames made entirely of punctuation).
export function slugifyFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const lower = base.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (cleaned.length > 0) return cleaned;
  // Deterministic fallback: first 6 chars of a simple hash of the original
  // name so two passes over the same folder produce the same ids.
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return `img_${(h >>> 0).toString(16).slice(0, 6)}`;
}

// Apply slugifyFilename and resolve collisions by appending `_2`, `_3`, etc.
// The caller passes a seed set of ids already in use (e.g., existing
// assets.images keys) and gets back both the final id and the updated set.
export function slugifyUnique(
  name: string,
  used: Set<string>,
): { id: string; taken: boolean } {
  const base = slugifyFilename(name);
  if (!used.has(base)) {
    used.add(base);
    return { id: base, taken: false };
  }
  let i = 2;
  let candidate = `${base}_${i}`;
  while (used.has(candidate)) {
    i++;
    candidate = `${base}_${i}`;
  }
  used.add(candidate);
  return { id: candidate, taken: true };
}
