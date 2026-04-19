import { useTaskStore } from "../../store/taskStore";
import { TextField } from "../primitives";
import { SectionHeader } from "./SectionHeader";
import { setSessionEnd } from "../../actions/blocks";

export function SessionEndPanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  if (!task) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader
        title="Session end"
        help="Message shown after the final block submits. Currently ignored by the v1 runtime (WARP's generic completion screen renders instead), but retained in the schema for v1.2+."
      />
      <TextField
        label="text"
        value={task.session_end?.text ?? ""}
        onChange={(v) => update((t) => setSessionEnd(t, v ? { text: v } : undefined))}
      />
    </div>
  );
}
