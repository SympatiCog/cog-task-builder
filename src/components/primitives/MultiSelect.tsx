import { useId } from "react";
import { Field, describedBy } from "./Field";

export interface MultiSelectProps {
  label: string;
  value: string[];
  options: readonly string[];
  onChange: (v: string[]) => void;
  help?: string;
  error?: string;
  required?: boolean;
  emptyLabel?: string;
}

// Multi-select used for cross-ref pickers: responses.*.keyboard (choose from
// inputs.keyboard), blocks.*.types (choose from stimulus_types keys), etc.
// Invalid options (present in value but not in options) are rendered as
// orphan chips with a remove button so authors can see the broken ref and
// clean it up.
export function MultiSelect(props: MultiSelectProps) {
  const id = useId();
  const valueSet = new Set(props.value);
  const optionSet = new Set(props.options);
  const orphans = props.value.filter((v) => !optionSet.has(v));

  const toggle = (opt: string) => {
    if (valueSet.has(opt)) props.onChange(props.value.filter((v) => v !== opt));
    else props.onChange([...props.value, opt]);
  };

  return (
    <Field label={props.label} htmlFor={id} help={props.help} error={props.error} required={props.required}>
      {props.options.length === 0 ? (
        <p className="text-xs italic text-slate-500">
          {props.emptyLabel ?? "No options available."}
        </p>
      ) : (
        <div
          id={id}
          aria-describedby={describedBy(id, props.help, props.error)}
          className="flex flex-wrap gap-2 rounded border border-slate-300 bg-white p-2"
        >
          {props.options.map((opt) => (
            <label
              key={opt}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs has-[:checked]:border-slate-700 has-[:checked]:bg-slate-800 has-[:checked]:text-white"
            >
              <input
                type="checkbox"
                className="hidden"
                checked={valueSet.has(opt)}
                onChange={() => toggle(opt)}
              />
              <span className="font-mono">{opt}</span>
            </label>
          ))}
        </div>
      )}
      {orphans.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {orphans.map((o) => (
            <span
              key={o}
              className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-800"
            >
              <span className="font-mono">{o}</span>
              <button
                type="button"
                onClick={() => props.onChange(props.value.filter((v) => v !== o))}
                aria-label={`Remove dangling reference ${o}`}
                className="leading-none text-rose-700"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}
