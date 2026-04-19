import type { TaskJson } from "../types/task";
import { canonicalize } from "./canonicalize";

// Serialize a TaskJson to a JSON string with canonical key order and 2-space
// indent. Trailing newline included for POSIX-friendly file output.
export function exportTask(task: TaskJson): string {
  return JSON.stringify(canonicalize(task), null, 2) + "\n";
}
