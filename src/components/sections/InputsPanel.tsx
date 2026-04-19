import { useTaskStore } from "../../store/taskStore";
import { CommaListField, KeyedList, NumberField, Select, TextField } from "../primitives";
import { SectionHeader } from "./SectionHeader";
import {
  addTouchButton,
  deleteTouchButton,
  renameTouchButton,
  setKeyboardKeys,
  updateTouchButton,
} from "../../actions/inputs";
import type { ButtonPosition } from "../../types/task";

const POSITIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "top_left", label: "top_left" },
  { value: "top_center", label: "top_center" },
  { value: "top_right", label: "top_right" },
  { value: "middle_left", label: "middle_left" },
  { value: "middle_center", label: "middle_center" },
  { value: "middle_right", label: "middle_right" },
  { value: "bottom_left", label: "bottom_left" },
  { value: "bottom_center", label: "bottom_center" },
  { value: "bottom_right", label: "bottom_right" },
  { value: "__xy__", label: "Custom (x%, y%)" },
];

function positionValue(p: ButtonPosition): string {
  return typeof p === "string" ? p : "__xy__";
}

export function InputsPanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  if (!task) return null;
  const { keyboard = [], touchscreen_buttons = [] } = task.inputs;

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Inputs"
        help="Physical keys the task listens to and on-screen buttons for touch devices."
      />

      <CommaListField
        label="Keyboard keys"
        value={keyboard}
        onChange={(v) => update((t) => setKeyboardKeys(t, v))}
        transform={(s) => s.toLowerCase()}
        help="Physical keycode names: f, j, space, enter, left, right. Use 'space' for spacebar, not ' '. (Commit with Tab / Enter.)"
      />

      <div className="mt-6">
        <KeyedList
          label="Touchscreen buttons"
          addLabel="+ Add button"
          entries={touchscreen_buttons.map((b) => [b.id, b] as [string, typeof b])}
          onAdd={() => {
            const base = "btn_";
            let i = 1;
            const ids = new Set(touchscreen_buttons.map((b) => b.id));
            while (ids.has(`${base}${i}`)) i++;
            update((t) => addTouchButton(t, `${base}${i}`));
          }}
          onRename={(oldId, newId) => {
            if (newId === oldId || newId.length === 0) return;
            if (touchscreen_buttons.some((b) => b.id === newId)) return;
            update((t) => renameTouchButton(t, oldId, newId));
          }}
          onDelete={(id) => update((t) => deleteTouchButton(t, id))}
          renderRow={(id, button) => {
            const posValue = positionValue(button.position);
            const xy = typeof button.position === "string" ? { x_pct: 0.5, y_pct: 0.5 } : button.position;
            return (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TextField
                  label="Label (visible text)"
                  value={button.label}
                  onChange={(v) => update((t) => updateTouchButton(t, id, { label: v }))}
                />
                <NumberField
                  label="Size (px)"
                  value={button.size_px}
                  onChange={(v) => update((t) => updateTouchButton(t, id, { size_px: v }))}
                  min={40}
                  step={10}
                />
                <Select
                  label="Position"
                  value={posValue}
                  onChange={(v) => {
                    if (v === "__xy__") {
                      update((t) => updateTouchButton(t, id, { position: { x_pct: 0.5, y_pct: 0.5 } }));
                    } else {
                      update((t) => updateTouchButton(t, id, { position: v as Exclude<ButtonPosition, object> }));
                    }
                  }}
                  options={POSITIONS}
                />
                {posValue === "__xy__" && (
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="x_pct"
                      value={xy.x_pct}
                      onChange={(v) =>
                        update((t) => updateTouchButton(t, id, { position: { ...xy, x_pct: v ?? 0 } }))
                      }
                      min={0}
                      max={1}
                      step={0.01}
                    />
                    <NumberField
                      label="y_pct"
                      value={xy.y_pct}
                      onChange={(v) =>
                        update((t) => updateTouchButton(t, id, { position: { ...xy, y_pct: v ?? 0 } }))
                      }
                      min={0}
                      max={1}
                      step={0.01}
                    />
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
