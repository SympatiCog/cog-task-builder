import { useRef, useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { importTask } from "../serde/import";
import { exportTask } from "../serde/export";
import { PasteImportDialog } from "./PasteImportDialog";

interface ToolbarProps {
  onTogglePreview?: () => void;
  previewOpen?: boolean;
}

export function Toolbar({ onTogglePreview, previewOpen }: ToolbarProps = {}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const task = useTaskStore((s) => s.task);
  const error = useTaskStore((s) => s.error);
  const loadTask = useTaskStore((s) => s.loadTask);
  const loadNew = useTaskStore((s) => s.newTask);
  const setError = useTaskStore((s) => s.setError);
  const reset = useTaskStore((s) => s.reset);

  const handleFile = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch (e) {
      setError(`Could not read file: ${(e as Error).message}`);
      return;
    }
    const result = importTask(text);
    if (result.ok && result.task) loadTask(result.task);
    else setError(result.error ?? "Import failed.");
  };

  const handleExport = () => {
    if (!task) return;
    const json = exportTask(task);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${task.metadata?.task_id ?? "task"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleReset = () => {
    if (task && !window.confirm("Discard the current draft? This cannot be undone.")) return;
    reset();
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-800">Cog Task Builder</h1>
        <div className="flex-1" />
        <button
          type="button"
          className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          onClick={() => {
            if (task && !window.confirm("Discard the current draft and start a blank task?")) return;
            loadNew();
          }}
        >
          New
        </button>
        <button
          type="button"
          className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          onClick={() => fileInput.current?.click()}
        >
          Import file
        </button>
        <button
          type="button"
          className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          onClick={() => setPasteOpen(true)}
        >
          Paste JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {onTogglePreview && (
          <button
            type="button"
            aria-pressed={previewOpen}
            className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 aria-[pressed=true]:bg-slate-800 aria-[pressed=true]:text-white"
            onClick={onTogglePreview}
          >
            Preview
          </button>
        )}
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          onClick={handleExport}
          disabled={!task}
        >
          Export
        </button>
        <button
          type="button"
          className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          onClick={handleReset}
          disabled={!task && !error}
        >
          Reset
        </button>
      </div>
      {pasteOpen && <PasteImportDialog onClose={() => setPasteOpen(false)} />}
    </>
  );
}
