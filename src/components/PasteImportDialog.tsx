import { useEffect, useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { importTask } from "../serde/import";

interface Props {
  onClose: () => void;
}

export function PasteImportDialog({ onClose }: Props) {
  const loadTask = useTaskStore((s) => s.loadTask);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleImport = () => {
    const result = importTask(text);
    if (result.ok && result.task) {
      loadTask(result.task);
      onClose();
    } else {
      setError(result.error ?? "Import failed.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paste task JSON"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[80vh] w-full max-w-3xl flex-col gap-3 rounded bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Paste task JSON</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="flex-1 resize-none rounded border border-slate-300 bg-slate-50 p-3 font-mono text-xs"
          placeholder='{"schema_version": "1.1.0", ...}'
        />
        {error && (
          <div role="alert" className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={text.trim().length === 0}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
