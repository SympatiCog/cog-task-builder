import { useId, useMemo, useState } from "react";
import { Field, describedBy } from "./Field";

export interface AssetRefPickerProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  help?: string;
  error?: string;
  images: readonly string[];
  audio: readonly string[];
  pools: readonly string[];
  placeholder?: string;
}

// Free-form text field with an autocomplete dropdown over the declared asset
// id space. Matches any substring of the typed fragment against `img:<id>`,
// `img:pool:<name>`, `aud:<id>`. `txt:<literal>` isn't suggested — the
// literal is author-chosen — but the author can type it freely.
export function AssetRefPicker(props: AssetRefPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const all = [
      ...props.images.map((i) => `img:${i}`),
      ...props.pools.map((p) => `img:pool:${p}`),
      ...props.audio.map((a) => `aud:${a}`),
    ];
    const q = props.value.toLowerCase();
    if (q === "") return all.slice(0, 20);
    return all.filter((s) => s.toLowerCase().includes(q)).slice(0, 20);
  }, [props.value, props.images, props.audio, props.pools]);

  return (
    <Field label={props.label} htmlFor={id} help={props.help} error={props.error}>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={props.value}
          onChange={(e) => {
            props.onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={props.placeholder ?? "img:<id>, img:pool:<name>, aud:<id>, txt:<literal>"}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy(id, props.help, props.error)}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 aria-[invalid=true]:border-rose-500"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-60 overflow-auto rounded border border-slate-300 bg-white shadow-md">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    props.onChange(s);
                    setOpen(false);
                  }}
                  className="block w-full px-2 py-1 text-left font-mono text-xs hover:bg-slate-100"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
