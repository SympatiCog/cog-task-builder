import { useId } from "react";
import { Field, describedBy } from "./Field";

export interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  help?: string;
  error?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
}

// Empty string → `undefined` so optional numeric fields can be cleared without
// serializing `NaN` or `0`. Non-finite inputs are ignored.
export function NumberField(props: NumberFieldProps) {
  const id = useId();
  return (
    <Field label={props.label} htmlFor={id} help={props.help} error={props.error} required={props.required}>
      <input
        id={id}
        type="number"
        value={props.value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return props.onChange(undefined);
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) props.onChange(parsed);
        }}
        min={props.min}
        max={props.max}
        step={props.step}
        placeholder={props.placeholder}
        disabled={props.disabled}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, props.help, props.error)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100 aria-[invalid=true]:border-rose-500"
      />
    </Field>
  );
}
