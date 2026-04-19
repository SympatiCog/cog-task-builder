import type { ResponseBinding, TaskJson } from "../types/task";
import { renameResponse as cascadeRename } from "./cascades";

export function addResponse(task: TaskJson, label: string): TaskJson {
  if (label in task.responses) return task;
  return { ...task, responses: { ...task.responses, [label]: {} } };
}

export function setResponse(
  task: TaskJson,
  label: string,
  binding: ResponseBinding,
): TaskJson {
  return { ...task, responses: { ...task.responses, [label]: binding } };
}

export function deleteResponse(task: TaskJson, label: string): TaskJson {
  if (!(label in task.responses)) return task;
  const next = { ...task.responses };
  delete next[label];
  // Cascade: any stimulus_type whose correct_response was this label becomes
  // unset (left as the dangling ref). The validator will surface unknown_label
  // so the author can decide whether to remap or delete the type.
  return { ...task, responses: next };
}

export function renameResponse(task: TaskJson, oldLabel: string, newLabel: string): TaskJson {
  return cascadeRename(task, oldLabel, newLabel);
}
