import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TaskJson } from "../types/task";
import { newTask } from "../defaults/newTask";

interface TaskStore {
  task: TaskJson | null;
  error: string | null;
  loadTask: (task: TaskJson) => void;
  newTask: () => void;
  updateTask: (mutator: (task: TaskJson) => TaskJson) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Persists only the `task` document (not transient error state) to localStorage
// so a page reload during authoring doesn't discard the draft. `version` lets
// us invalidate stored drafts when the schema shape changes in a non-backward-
// compatible way; bump it when TaskJson's top-level keys change. Add a
// `migrate` callback if the new shape can carry forward prior drafts — bumping
// version without a migrate silently discards any stored draft.
export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      task: null,
      error: null,
      loadTask: (task) => set({ task, error: null }),
      newTask: () => set({ task: newTask(), error: null }),
      updateTask: (mutator) => {
        const current = get().task;
        if (!current) return;
        set({ task: mutator(current) });
      },
      setError: (error) => set({ error }),
      reset: () => set({ task: null, error: null }),
    }),
    {
      name: "cog-task-builder:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ task: s.task }),
      version: 1,
    },
  ),
);
