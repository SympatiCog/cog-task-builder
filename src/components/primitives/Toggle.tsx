import { useId } from "react";

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
  disabled?: boolean;
}

export function Toggle(props: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        disabled={props.disabled}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="text-sm text-slate-700">
          {props.label}
        </label>
        {props.help && <p className="text-xs text-slate-500">{props.help}</p>}
      </div>
    </div>
  );
}
