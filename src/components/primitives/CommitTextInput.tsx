import { useEffect, useState, type KeyboardEvent } from "react";

export interface CommitTextInputProps {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  className?: string;
}

// Id-rename input. Buffers the draft locally so the cascade-heavy rename
// action only fires on blur / Enter (not per keystroke — mid-word rename
// cascades cause transient collisions and rerender storms). Escape reverts
// the draft to the committed value.
export function CommitTextInput({ value, onCommit, ariaLabel, className }: CommitTextInputProps) {
  const [draft, setDraft] = useState(value);
  // Sync on external changes (rename elsewhere, cascade snap-back).
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft !== value && draft.length > 0) onCommit(draft);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(value);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
