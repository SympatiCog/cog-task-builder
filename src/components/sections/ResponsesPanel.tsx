import { useTaskStore } from "../../store/taskStore";
import { KeyedList, MultiSelect } from "../primitives";
import { SectionHeader } from "./SectionHeader";
import {
  addResponse,
  deleteResponse,
  renameResponse,
  setResponse,
} from "../../actions/responses";

const MOUSE_BUTTONS = ["left", "middle", "right"] as const;

export function ResponsesPanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  if (!task) return null;

  const keyboardOptions = task.inputs.keyboard ?? [];
  const touchOptions = (task.inputs.touchscreen_buttons ?? []).map((b) => b.id);

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Responses"
        help="Each response label maps to the key / button / mouse events that should fire it. Any source triggering counts as the response."
      />
      <KeyedList
        label="Response labels"
        addLabel="+ Add response"
        entries={Object.entries(task.responses)}
        onAdd={() => {
          const base = "response_";
          let i = 1;
          while (`${base}${i}` in task.responses) i++;
          update((t) => addResponse(t, `${base}${i}`));
        }}
        onRename={(oldLabel, newLabel) => {
          if (newLabel === oldLabel || newLabel.length === 0) return;
          if (newLabel in task.responses) return;
          update((t) => renameResponse(t, oldLabel, newLabel));
        }}
        onDelete={(label) => update((t) => deleteResponse(t, label))}
        renderRow={(label, binding) => (
          <div className="flex flex-col gap-3">
            <MultiSelect
              label="Keyboard keys"
              value={binding.keyboard ?? []}
              options={keyboardOptions}
              onChange={(v) => update((t) => setResponse(t, label, { ...binding, keyboard: v.length ? v : undefined }))}
              emptyLabel="No keyboard keys declared in Inputs."
            />
            <MultiSelect
              label="Touchscreen buttons"
              value={binding.touchscreen ?? []}
              options={touchOptions}
              onChange={(v) => update((t) => setResponse(t, label, { ...binding, touchscreen: v.length ? v : undefined }))}
              emptyLabel="No touchscreen buttons declared in Inputs."
            />
            <MultiSelect
              label="Mouse buttons"
              value={binding.mouse ?? []}
              options={MOUSE_BUTTONS}
              onChange={(v) => update((t) => setResponse(t, label, { ...binding, mouse: v.length ? v : undefined }))}
            />
          </div>
        )}
      />
    </div>
  );
}
