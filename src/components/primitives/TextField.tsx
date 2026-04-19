import { useId } from "react";
import { Field, describedBy } from "./Field";

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  help?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  pattern?: string;
  autoComplete?: string;
  disabled?: boolean;
}

export function TextField(props: TextFieldProps) {
  const id = useId();
  return (
    <Field label={props.label} htmlFor={id} help={props.help} error={props.error} required={props.required}>
      <input
        id={id}
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        pattern={props.pattern}
        autoComplete={props.autoComplete}
        disabled={props.disabled}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, props.help, props.error)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100 aria-[invalid=true]:border-rose-500"
      />
    </Field>
  );
}
