import { useMemo } from "react";
import { useTaskStore } from "../store/taskStore";
import { exportTask } from "../serde/export";

export function JsonPreview() {
  const task = useTaskStore((s) => s.task);
  const error = useTaskStore((s) => s.error);

  const text = useMemo(() => (task ? exportTask(task) : ""), [task]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <div className="mb-1 font-medium">Import failed</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }
  if (!task) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
        Import a task JSON to begin.
      </div>
    );
  }
  return (
    <pre className="h-full overflow-auto bg-slate-900 p-4 font-mono text-xs text-slate-100">
      {text}
    </pre>
  );
}
