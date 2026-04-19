import type { ItemKind, TaskJson, TrialItem } from "../types/task";

export function addTrialItem(task: TaskJson, item: TrialItem): TaskJson {
  return { ...task, trial_template: [...task.trial_template, item] };
}

export function updateTrialItem(
  task: TaskJson,
  index: number,
  patch: Partial<TrialItem>,
): TaskJson {
  return {
    ...task,
    trial_template: task.trial_template.map((it, i) => (i === index ? { ...it, ...patch } : it)),
  };
}

export function deleteTrialItem(task: TaskJson, index: number): TaskJson {
  const item = task.trial_template[index];
  const next = task.trial_template.filter((_, i) => i !== index);
  if (!item) return task;
  // Cascade: drop per-item overrides on this id from every stimulus_type, and
  // null out any anchor that pointed at it.
  const id = item.id;
  const nextTypes = Object.fromEntries(
    Object.entries(task.stimulus_types).map(([typeId, t]) => {
      if (!t?.items || !(id in t.items)) return [typeId, t];
      const nextItems = { ...t.items };
      delete nextItems[id];
      return [typeId, { ...t, items: nextItems }];
    }),
  );
  const nextTemplate = next.map((it) => {
    if (typeof it.anchor !== "string") return it;
    const dot = it.anchor.lastIndexOf(".");
    if (dot <= 0) return it;
    const target = it.anchor.slice(0, dot);
    if (target === id) {
      const { anchor: _unused, ...rest } = it;
      return rest;
    }
    return it;
  });
  return { ...task, trial_template: nextTemplate, stimulus_types: nextTypes };
}

export function reorderTrialItems(
  task: TaskJson,
  oldIndex: number,
  newIndex: number,
): TaskJson {
  if (oldIndex === newIndex) return task;
  const items = [...task.trial_template];
  const [moved] = items.splice(oldIndex, 1);
  items.splice(newIndex, 0, moved);
  return { ...task, trial_template: items };
}

export function renameTrialItem(
  task: TaskJson,
  oldId: string,
  newId: string,
): TaskJson {
  if (oldId === newId) return task;
  const exists = task.trial_template.some((it) => it.id === newId);
  if (exists) throw new Error(`renameTrialItem: target id "${newId}" already exists`);
  const nextTemplate = task.trial_template.map((it) => {
    const out = it.id === oldId ? { ...it, id: newId } : { ...it };
    if (typeof out.anchor === "string") {
      const dot = out.anchor.lastIndexOf(".");
      if (dot > 0) {
        const target = out.anchor.slice(0, dot);
        const axis = out.anchor.slice(dot + 1);
        if (target === oldId) out.anchor = `${newId}.${axis}`;
      }
    }
    return out;
  });
  const nextTypes = Object.fromEntries(
    Object.entries(task.stimulus_types).map(([typeId, t]) => {
      if (!t?.items || !(oldId in t.items)) return [typeId, t];
      const nextItems: typeof t.items = {};
      for (const [k, v] of Object.entries(t.items)) {
        nextItems[k === oldId ? newId : k] = v;
      }
      return [typeId, { ...t, items: nextItems }];
    }),
  );
  return { ...task, trial_template: nextTemplate, stimulus_types: nextTypes };
}

export function setCapturesResponse(task: TaskJson, index: number): TaskJson {
  // Enforce uniqueness: turning this item on turns every other off.
  return {
    ...task,
    trial_template: task.trial_template.map((it, i) => ({
      ...it,
      captures_response: i === index ? true : false,
    })),
  };
}

export function stubItem(kind: ItemKind, id: string): TrialItem {
  const base: TrialItem = { id, kind, onset_ms: 0, duration_ms: 0 };
  if (kind === "text") return { ...base, asset: "txt:+", extras: { style: "fix" } };
  if (kind === "feedback") {
    return {
      ...base,
      anchor: "cs.end",
      cases: {
        correct: { text: "Correct", style: "correct" },
        incorrect: { text: "Incorrect", style: "incorrect" },
        timeout: { text: "Too slow", style: "slow" },
      },
    };
  }
  return base;
}
