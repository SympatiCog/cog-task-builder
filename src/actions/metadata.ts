import type { Metadata, TaskJson, Theme, TextStyle } from "../types/task";
import { renameTextStyle as renameTextStyleCascade } from "./cascades";

export function setMetadata<K extends keyof Metadata>(
  task: TaskJson,
  key: K,
  value: Metadata[K],
): TaskJson {
  return { ...task, metadata: { ...task.metadata, [key]: value } };
}

export function setTheme<K extends keyof Theme>(
  task: TaskJson,
  key: K,
  value: Theme[K],
): TaskJson {
  return {
    ...task,
    metadata: {
      ...task.metadata,
      theme: { ...task.metadata.theme, [key]: value },
    },
  };
}

export function setTextStyle(
  task: TaskJson,
  name: string,
  style: TextStyle,
): TaskJson {
  const existing = task.metadata.theme?.text_styles ?? {};
  return setTheme(task, "text_styles", { ...existing, [name]: style });
}

export function deleteTextStyle(task: TaskJson, name: string): TaskJson {
  const existing = task.metadata.theme?.text_styles ?? {};
  if (!(name in existing)) return task;
  const next = { ...existing };
  delete next[name];
  return setTheme(task, "text_styles", next);
}

export function renameTextStyle(
  task: TaskJson,
  oldName: string,
  newName: string,
): TaskJson {
  return renameTextStyleCascade(task, oldName, newName);
}

export function addTextStyle(task: TaskJson, name: string): TaskJson {
  const existing = task.metadata.theme?.text_styles ?? {};
  if (name in existing) return task;
  return setTextStyle(task, name, { font_size_pct: 0.08, color: "#ffffff" });
}
