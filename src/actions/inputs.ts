import type { TaskJson, TouchscreenButton } from "../types/task";
import { renameTouchscreenButton as cascadeRename } from "./cascades";

export function setKeyboardKeys(task: TaskJson, keys: string[]): TaskJson {
  return { ...task, inputs: { ...task.inputs, keyboard: keys } };
}

const DEFAULT_BUTTON: TouchscreenButton = {
  id: "btn_new",
  label: "•",
  position: "bottom_center",
  size_px: 140,
};

export function addTouchButton(task: TaskJson, id: string): TaskJson {
  const buttons = task.inputs.touchscreen_buttons ?? [];
  if (buttons.some((b) => b.id === id)) return task;
  return {
    ...task,
    inputs: {
      ...task.inputs,
      touchscreen_buttons: [...buttons, { ...DEFAULT_BUTTON, id }],
    },
  };
}

export function updateTouchButton(
  task: TaskJson,
  id: string,
  patch: Partial<TouchscreenButton>,
): TaskJson {
  const buttons = task.inputs.touchscreen_buttons ?? [];
  return {
    ...task,
    inputs: {
      ...task.inputs,
      touchscreen_buttons: buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    },
  };
}

export function deleteTouchButton(task: TaskJson, id: string): TaskJson {
  const buttons = task.inputs.touchscreen_buttons ?? [];
  if (!buttons.some((b) => b.id === id)) return task;
  const nextButtons = buttons.filter((b) => b.id !== id);
  // Cascade: drop the id from any response binding's touchscreen list.
  const nextResponses: typeof task.responses = {};
  for (const [label, binding] of Object.entries(task.responses)) {
    nextResponses[label] = binding.touchscreen
      ? { ...binding, touchscreen: binding.touchscreen.filter((t) => t !== id) }
      : binding;
  }
  return {
    ...task,
    inputs: { ...task.inputs, touchscreen_buttons: nextButtons },
    responses: nextResponses,
  };
}

export function renameTouchButton(task: TaskJson, oldId: string, newId: string): TaskJson {
  return cascadeRename(task, oldId, newId);
}
