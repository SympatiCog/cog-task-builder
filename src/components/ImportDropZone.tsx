import { useCallback, useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { importTask } from "../serde/import";

// Full-window drop target. Active only when the user drags over the window;
// absorbs a dropped .json file and imports it via the same path as the
// toolbar's file picker.
export function ImportDropZone() {
  const loadTask = useTaskStore((s) => s.loadTask);
  const setError = useTaskStore((s) => s.setError);
  const [dragging, setDragging] = useState(false);

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      let text: string;
      try {
        text = await file.text();
      } catch (err) {
        setError(`Could not read file: ${(err as Error).message}`);
        return;
      }
      const result = importTask(text);
      if (result.ok && result.task) loadTask(result.task);
      else setError(result.error ?? "Import failed.");
    },
    [loadTask, setError],
  );

  return (
    <div
      className={
        "absolute inset-0 " +
        (dragging ? "pointer-events-auto bg-blue-500/10" : "pointer-events-none")
      }
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        // Only clear if we're leaving the window, not moving between children.
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => void onDrop(e)}
    >
      {dragging && (
        <div className="pointer-events-none flex h-full items-center justify-center">
          <div className="rounded border-2 border-dashed border-blue-500 bg-white/90 p-6 text-sm font-medium text-blue-700">
            Drop a task JSON to import
          </div>
        </div>
      )}
    </div>
  );
}
