import { useEffect, useId, useState } from "react";
import { Field, describedBy } from "./Field";

export interface CommaListFieldProps {
  label: string;
  value: readonly string[];
  onChange: (v: string[]) => void;
  help?: string;
  error?: string;
  transform?: (v: string) => string;
  placeholder?: string;
}

// Draft-state list editor that commits on blur / Enter. Typing "f, j" doesn't
// eagerly commit mid-comma — the field stores the raw text and only parses
// when editing is done. Syncs from prop value when the upstream task changes
// (e.g., after a cascade rewrites the list).
export function CommaListField(props: CommaListFieldProps) {
  const id = useId();
  const canonical = props.value.join(", ");
  const [draft, setDraft] = useState(canonical);

  useEffect(() => setDraft(canonical), [canonical]);

  const commit = () => {
    const parsed = draft
      .split(",")
      .map((s) => s.trim())
      .map((s) => (props.transform ? props.transform(s) : s))
      .filter((s) => s.length > 0);
    props.onChange(parsed);
  };

  return (
    <Field label={props.label} htmlFor={id} help={props.help} error={props.error}>
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(canonical);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        placeholder={props.placeholder}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, props.help, props.error)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 aria-[invalid=true]:border-rose-500"
      />
    </Field>
  );
}
