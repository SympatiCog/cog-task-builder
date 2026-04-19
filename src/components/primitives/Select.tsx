import { useId } from "react";
import { Field, describedBy } from "./Field";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  options: readonly SelectOption<T>[];
  help?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function Select<T extends string>(props: SelectProps<T>) {
  const id = useId();
  return (
    <Field label={props.label} htmlFor={id} help={props.help} error={props.error} required={props.required}>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        disabled={props.disabled}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, props.help, props.error)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100 aria-[invalid=true]:border-rose-500"
      >
        {props.placeholder !== undefined && (
          <option value="" disabled>{props.placeholder}</option>
        )}
        {props.options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
