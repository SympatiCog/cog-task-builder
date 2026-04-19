import type { TaskJson } from "../types/task";

export interface ImportResult {
  ok: boolean;
  task?: TaskJson;
  error?: string;
}

// Parse a JSON string into a TaskJson. v1 only does shape-level guards; deep
// schema validation is a later batch.
export function importTask(text: string): ImportResult {
  // Strip UTF-8 BOM — some editors (Notepad, older Excel exports) prepend
  // U+FEFF which JSON.parse rejects.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Top-level value must be an object." };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.schema_version !== "string") {
    return { ok: false, error: "Missing or non-string `schema_version`." };
  }
  return { ok: true, task: obj as unknown as TaskJson };
}
