import type { ItemOverrides, StimulusType, TaskJson } from "../types/task";
import { renameStimulusType as cascadeRename } from "./cascades";

export function addStimulusType(task: TaskJson, id: string): TaskJson {
  if (id in task.stimulus_types) return task;
  const stub: StimulusType = { correct_response: "", items: {} };
  return { ...task, stimulus_types: { ...task.stimulus_types, [id]: stub } };
}

export function setStimulusType(
  task: TaskJson,
  id: string,
  value: StimulusType,
): TaskJson {
  return { ...task, stimulus_types: { ...task.stimulus_types, [id]: value } };
}

export function deleteStimulusType(task: TaskJson, id: string): TaskJson {
  if (!(id in task.stimulus_types)) return task;
  const next = { ...task.stimulus_types };
  delete next[id];
  // Cascade: drop this type id from any block's types list.
  const nextBlocks = task.blocks.map((b) => ({
    ...b,
    types: b.types?.filter((t) => t !== id),
  }));
  return { ...task, stimulus_types: next, blocks: nextBlocks };
}

export function renameStimulusType(task: TaskJson, oldId: string, newId: string): TaskJson {
  return cascadeRename(task, oldId, newId);
}

export function setItemOverride(
  task: TaskJson,
  typeId: string,
  itemId: string,
  overrides: ItemOverrides,
): TaskJson {
  const type = task.stimulus_types[typeId];
  if (!type) return task;
  return {
    ...task,
    stimulus_types: {
      ...task.stimulus_types,
      [typeId]: { ...type, items: { ...type.items, [itemId]: overrides } },
    },
  };
}

export function deleteItemOverride(
  task: TaskJson,
  typeId: string,
  itemId: string,
): TaskJson {
  const type = task.stimulus_types[typeId];
  if (!type?.items || !(itemId in type.items)) return task;
  const nextItems = { ...type.items };
  delete nextItems[itemId];
  return setStimulusType(task, typeId, { ...type, items: nextItems });
}
