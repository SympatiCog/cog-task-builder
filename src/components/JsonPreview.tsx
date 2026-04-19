import { useMemo, useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { exportTask } from "../serde/export";

export function JsonPreview() {
  const task = useTaskStore((s) => s.task);
  const error = useTaskStore((s) => s.error);
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => (task ? exportTask(task) : ""), [task]);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard API may reject under sandboxed iframes; silently ignore.
    }
  };

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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Preview
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-100 hover:bg-slate-600"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="flex-1 overflow-auto bg-slate-900 p-4 font-mono text-xs text-slate-100">
        {text}
      </pre>
    </div>
  );
}
