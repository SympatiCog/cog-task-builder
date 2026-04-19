import type { TaskJson } from "../types/task";

export interface ImportResult {
  ok: boolean;
  task?: TaskJson;
  error?: string;
}

// Parse a JSON string into a TaskJson. v1 only does shape-level guards; deep
// schema validation is a later batch.
export function importTask(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
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
