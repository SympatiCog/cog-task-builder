import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  htmlFor: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

// Shared layout for label + control + help + error. Aria linkage lives on the
// control itself (each primitive wires its own aria-describedby using the ids
// below); this wrapper only handles visual layout.
export function Field({ label, htmlFor, help, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-600" aria-hidden>*</span>}
      </label>
      {children}
      {help && !error && (
        <p id={`${htmlFor}-help`} className="text-xs text-slate-500">{help}</p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}

export function describedBy(htmlFor: string, help?: string, error?: string): string | undefined {
  const ids: string[] = [];
  if (help && !error) ids.push(`${htmlFor}-help`);
  if (error) ids.push(`${htmlFor}-error`);
  return ids.length ? ids.join(" ") : undefined;
}
