import { create } from "zustand";
import type { TaskJson } from "../types/task";

interface TaskStore {
  task: TaskJson | null;
  error: string | null;
  loadTask: (task: TaskJson) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  task: null,
  error: null,
  loadTask: (task) => set({ task, error: null }),
  setError: (error) => set({ error }),
  reset: () => set({ task: null, error: null }),
}));
