import type { Block, TaskJson, Timing, SessionEnd, OrderingMode } from "../types/task";

const DEFAULT_BLOCK: Block = {
  id: "block_new",
  n_trials: 10,
  types: [],
  ordering: "factorial_random",
};

export function addBlock(task: TaskJson, id: string): TaskJson {
  if (task.blocks.some((b) => b.id === id)) return task;
  return { ...task, blocks: [...task.blocks, { ...DEFAULT_BLOCK, id }] };
}

export function updateBlock(task: TaskJson, index: number, patch: Partial<Block>): TaskJson {
  return { ...task, blocks: task.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) };
}

export function deleteBlock(task: TaskJson, index: number): TaskJson {
  return { ...task, blocks: task.blocks.filter((_, i) => i !== index) };
}

export function moveBlock(task: TaskJson, index: number, direction: -1 | 1): TaskJson {
  const next = [...task.blocks];
  const target = index + direction;
  if (target < 0 || target >= next.length) return task;
  [next[index], next[target]] = [next[target], next[index]];
  return { ...task, blocks: next };
}

export function renameBlock(task: TaskJson, oldId: string, newId: string): TaskJson {
  if (oldId === newId) return task;
  if (task.blocks.some((b) => b.id === newId)) {
    throw new Error(`renameBlock: target id "${newId}" already exists`);
  }
  return {
    ...task,
    blocks: task.blocks.map((b) => (b.id === oldId ? { ...b, id: newId } : b)),
  };
}

export function setOrdering(task: TaskJson, index: number, ordering: OrderingMode): TaskJson {
  // Switching ordering drops fields that don't apply to the new mode so they
  // don't ride along in the exported JSON. Replaces the block wholesale —
  // merging via updateBlock would re-spread the old block's now-irrelevant
  // fields over the cleaned one (JS spread applies undefined, not delete).
  const b = task.blocks[index];
  if (!b) return task;
  const cleaned: Block = { ...b, ordering };
  if (ordering !== "factorial_random") delete cleaned.constraints;
  if (ordering !== "inline" && ordering !== "csv") delete cleaned.trial_list;
  if (ordering !== "csv") delete cleaned.trial_list_url;
  return { ...task, blocks: task.blocks.map((it, i) => (i === index ? cleaned : it)) };
}

export function setTiming(task: TaskJson, patch: Partial<Timing>): TaskJson {
  return { ...task, timing: { ...task.timing, ...patch } };
}

export function setSessionEnd(task: TaskJson, value: SessionEnd | undefined): TaskJson {
  return { ...task, session_end: value };
}
