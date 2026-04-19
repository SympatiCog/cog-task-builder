import { type ReactNode } from "react";
import { CommitTextInput } from "./CommitTextInput";

export interface KeyedListProps<T> {
  label: string;
  entries: ReadonlyArray<[string, T]>;
  onAdd: () => void;
  onRename: (oldKey: string, newKey: string) => void;
  onDelete: (key: string) => void;
  renderRow: (key: string, value: T) => ReactNode;
  addLabel?: string;
  error?: string;
}

// Dictionary editor for sections keyed by author-chosen ids (assets.images,
// responses, stimulus_types). Rename fires on blur or Enter — firing on every
// keystroke would cascade cross-refs mid-word and risk intermediate key
// collisions.
export function KeyedList<T>({
  label,
  entries,
  onAdd,
  onRename,
  onDelete,
  renderRow,
  addLabel,
  error,
}: KeyedListProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          {addLabel ?? "+ Add"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      {entries.length === 0 ? (
        <p className="text-xs italic text-slate-500">None yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 rounded border border-slate-200">
          {entries.map(([key, value]) => (
            <KeyedRow
              key={key}
              id={key}
              label={label}
              onRename={onRename}
              onDelete={onDelete}
            >
              {renderRow(key, value)}
            </KeyedRow>
          ))}
        </ul>
      )}
    </div>
  );
}

interface KeyedRowProps {
  id: string;
  label: string;
  onRename: (oldKey: string, newKey: string) => void;
  onDelete: (key: string) => void;
  children: ReactNode;
}

function KeyedRow({ id, label, onRename, onDelete, children }: KeyedRowProps) {
  return (
    <li className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <CommitTextInput
          value={id}
          onCommit={(next) => onRename(id, next)}
          ariaLabel={`${label} id`}
          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => onDelete(id)}
          aria-label={`Delete ${id}`}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
        >
          Delete
        </button>
      </div>
      <div>{children}</div>
    </li>
  );
}
