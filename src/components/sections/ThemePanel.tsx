import { useId } from "react";
import { useTaskStore } from "../../store/taskStore";
import { Field, NumberField, KeyedList } from "../primitives";
import { SectionHeader } from "./SectionHeader";
import {
  addTextStyle,
  deleteTextStyle,
  renameTextStyle,
  setTextStyle,
  setTheme,
} from "../../actions/metadata";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function ThemePanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  if (!task) return null;
  const theme = task.metadata.theme ?? {};
  const styles = theme.text_styles ?? {};

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Theme"
        help="Colors, default text size, and named text styles. Style names are referenced from items via extras.style."
      />

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Defaults</h3>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ColorField
          label="Background color"
          value={theme.background_color ?? "#000000"}
          onChange={(v) => update((t) => setTheme(t, "background_color", v))}
        />
        <ColorField
          label="Default text color"
          value={theme.default_text_color ?? "#ffffff"}
          onChange={(v) => update((t) => setTheme(t, "default_text_color", v))}
        />
        <NumberField
          label="Default text size (fraction of viewport width)"
          value={theme.default_text_size_pct}
          onChange={(v) => update((t) => setTheme(t, "default_text_size_pct", v))}
          help="e.g. 0.08 = 8% of viewport width"
          min={0.01}
          max={0.5}
          step={0.01}
        />
      </div>

      <KeyedList
        label="Text styles"
        addLabel="+ Add style"
        entries={Object.entries(styles)}
        onAdd={() => {
          const base = "style_";
          let i = 1;
          while (`${base}${i}` in styles) i++;
          update((t) => addTextStyle(t, `${base}${i}`));
        }}
        onRename={(oldName, newName) => {
          if (newName === oldName || newName.length === 0 || styles[newName] !== undefined) return;
          update((t) => renameTextStyle(t, oldName, newName));
        }}
        onDelete={(name) => update((t) => deleteTextStyle(t, name))}
        renderRow={(name, style) => (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ColorField
              label="Color"
              value={style.color ?? "#ffffff"}
              onChange={(v) => update((t) => setTextStyle(t, name, { ...style, color: v }))}
            />
            <NumberField
              label="Size (pct)"
              value={style.font_size_pct}
              onChange={(v) => update((t) => setTextStyle(t, name, { ...style, font_size_pct: v }))}
              min={0.01}
              max={0.5}
              step={0.01}
            />
          </div>
        )}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const error = HEX.test(value) ? undefined : "Expected #RGB or #RRGGBB";
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={HEX.test(value) ? expandHex(value) : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border border-slate-300 bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
          aria-invalid={error ? true : undefined}
        />
      </div>
    </Field>
  );
}

function expandHex(v: string): string {
  if (v.length === 4) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v;
}
