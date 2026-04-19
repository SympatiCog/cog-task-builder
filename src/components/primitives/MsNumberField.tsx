import { useEffect, useId, useState } from "react";
import { Field, describedBy } from "./Field";
import {
  FRAME_PERIOD_MS,
  REFERENCE_HZ,
  isFrameAligned,
  msToFrameCount,
  snapMsToFrame,
} from "../../utils/frameQuantize";

export interface MsNumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  help?: string;
  error?: string;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}

// Millisecond input that snaps to the nearest reference-rate frame boundary
// on blur / Enter. Visible frame-count hint reinforces the "digital time is
// discrete" mental model. Commit-on-blur matches CommitTextInput — edits
// don't propagate mid-keystroke so one digit of a multi-digit entry doesn't
// get snapped to an intermediate value.
export function MsNumberField(props: MsNumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string>(valueToDraft(props.value));
  useEffect(() => {
    setDraft(valueToDraft(props.value));
  }, [props.value]);

  const commit = () => {
    if (draft.trim() === "") {
      if (props.value !== undefined) props.onChange(undefined);
      return;
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      // Reject garbage; restore the committed value.
      setDraft(valueToDraft(props.value));
      return;
    }
    const snapped = snapMsToFrame(parsed);
    if (snapped !== props.value) props.onChange(snapped);
    setDraft(valueToDraft(snapped));
  };

  const combinedHelp = composeHelp(draft, props.help);

  return (
    <Field
      label={props.label}
      htmlFor={id}
      help={combinedHelp}
      error={props.error}
      required={props.required}
    >
      <input
        id={id}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(valueToDraft(props.value));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        min={props.min}
        max={props.max}
        step={FRAME_PERIOD_MS}
        placeholder={props.placeholder}
        disabled={props.disabled}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, combinedHelp, props.error)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100 aria-[invalid=true]:border-rose-500"
      />
    </Field>
  );
}

function valueToDraft(v: number | undefined): string {
  return v === undefined ? "" : String(v);
}

function composeHelp(draft: string, existing: string | undefined): string | undefined {
  if (draft.trim() === "") return existing;
  const parsed = Number(draft);
  if (!Number.isFinite(parsed)) return existing;
  const frames = msToFrameCount(parsed);
  const aligned = isFrameAligned(parsed);
  const frameWord = Math.abs(frames) === 1 ? "frame" : "frames";
  const frameHint = `${aligned ? "=" : "≈"} ${frames} ${frameWord} @ ${REFERENCE_HZ} Hz (snaps on blur)`;
  return existing ? `${existing} • ${frameHint}` : frameHint;
}
