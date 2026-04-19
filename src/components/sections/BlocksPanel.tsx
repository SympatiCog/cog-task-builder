import { useTaskStore } from "../../store/taskStore";
import { MsNumberField, MultiSelect, NumberField, Select, TextField, Toggle } from "../primitives";
import { CommitTextInput } from "../primitives/CommitTextInput";
import { SectionHeader } from "./SectionHeader";
import { useIssuesAt } from "../../validator/hooks";
import {
  addBlock,
  deleteBlock,
  moveBlock,
  renameBlock,
  setOrdering,
  updateBlock,
} from "../../actions/blocks";
import type { Block, OrderingMode } from "../../types/task";

const ORDERING_OPTIONS: { value: OrderingMode; label: string }[] = [
  { value: "factorial_random", label: "factorial_random" },
  { value: "fixed", label: "fixed" },
  { value: "inline", label: "inline" },
  { value: "csv", label: "csv" },
];

export function BlocksPanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  if (!task) return null;

  const typeOptions = Object.keys(task.stimulus_types);

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Blocks"
        help="Ordered list of blocks. Each block draws trials from its declared types according to its ordering rule."
      >
        <button
          type="button"
          onClick={() => {
            const base = "block_";
            let i = 1;
            const ids = new Set(task.blocks.map((b) => b.id));
            while (ids.has(`${base}${i}`)) i++;
            update((t) => addBlock(t, `${base}${i}`));
          }}
          className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          + Add block
        </button>
      </SectionHeader>

      {task.blocks.length === 0 ? (
        <p className="rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No blocks yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {task.blocks.map((block, index) => (
            <BlockEditor
              key={block.id + "-" + index}
              block={block}
              index={index}
              typeOptions={typeOptions}
              canMoveUp={index > 0}
              canMoveDown={index < task.blocks.length - 1}
              onMoveUp={() => update((t) => moveBlock(t, index, -1))}
              onMoveDown={() => update((t) => moveBlock(t, index, 1))}
              onDelete={() => update((t) => deleteBlock(t, index))}
              onRename={(v) => {
                // CommitTextInput already guards against no-op and empty
                // draft. Duplicate-id check stays — the primitive has no
                // peer awareness.
                if (task.blocks.some((b) => b.id === v)) return;
                update((t) => renameBlock(t, block.id, v));
              }}
              onChange={(patch) => update((t) => updateBlock(t, index, patch))}
              onOrderingChange={(v) => update((t) => setOrdering(t, index, v))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface BlockEditorProps {
  block: Block;
  index: number;
  typeOptions: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onRename: (v: string) => void;
  onChange: (patch: Partial<Block>) => void;
  onOrderingChange: (v: OrderingMode) => void;
}

function BlockEditor(props: BlockEditorProps) {
  const { block, index, typeOptions } = props;
  const issues = useIssuesAt(`blocks[${index}]`);
  const unbalancedIssue = issues.find((i) => i.code === "unbalanced");
  const csvSourceIssue = issues.find((i) => i.code === "missing_csv_source");
  return (
    <li className="rounded border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <CommitTextInput
          value={block.id}
          onCommit={props.onRename}
          ariaLabel="Block id"
          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-sm"
        />
        <button
          type="button"
          onClick={props.onMoveUp}
          disabled={!props.canMoveUp}
          aria-label="Move up"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={props.onMoveDown}
          disabled={!props.canMoveDown}
          aria-label="Move down"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={props.onDelete}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <NumberField
          label="n_trials"
          value={block.n_trials}
          onChange={(v) => props.onChange({ n_trials: v })}
          min={1}
          step={1}
          error={unbalancedIssue?.message}
        />
        <NumberField
          label="seed"
          value={block.seed}
          onChange={(v) => props.onChange({ seed: v })}
          step={1}
          help="Optional; omit for per-session randomness. Use an explicit seed for practice blocks."
        />
        <Select
          label="ordering"
          value={block.ordering}
          onChange={(v) => props.onOrderingChange(v as OrderingMode)}
          options={ORDERING_OPTIONS}
        />
        <MultiSelect
          label="types"
          value={block.types ?? []}
          options={typeOptions}
          onChange={(v) => props.onChange({ types: v })}
          emptyLabel="No stimulus types declared."
        />
      </div>

      {block.ordering === "factorial_random" && (
        <div className="mt-3 flex items-center gap-4">
          <NumberField
            label="max_type_repeat"
            value={block.constraints?.max_type_repeat}
            onChange={(v) => props.onChange({
              constraints: { ...(block.constraints ?? {}), max_type_repeat: v },
            })}
            min={1}
            step={1}
          />
          <Toggle
            label="balanced"
            checked={block.constraints?.balanced ?? false}
            onChange={(v) => props.onChange({
              constraints: { ...(block.constraints ?? {}), balanced: v || undefined },
            })}
            help="n_trials must be a multiple of len(types)"
          />
        </div>
      )}

      {block.ordering === "csv" && (
        <div className="mt-3">
          <TextField
            label="trial_list_url"
            value={block.trial_list_url ?? ""}
            onChange={(v) => props.onChange({ trial_list_url: v || undefined })}
            help="HTTPS URL to a CSV file with a trial_type column (+ optional trial_onset_ms)"
            error={csvSourceIssue?.message}
          />
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField
          label="instructions.text"
          value={block.instructions?.text ?? ""}
          onChange={(v) => props.onChange({
            instructions: v ? { ...(block.instructions ?? { text: "" }), text: v } : undefined,
          })}
          help="Shown before the block starts. Space/Enter dismisses."
        />
        <MsNumberField
          label="instructions.duration_ms"
          value={block.instructions?.duration_ms}
          onChange={(v) => props.onChange({
            instructions: block.instructions ? { ...block.instructions, duration_ms: v } : undefined,
          })}
          min={0}
          help="0 = no timeout"
          disabled={!block.instructions?.text}
        />
        <Toggle
          label="feedback_enabled"
          checked={block.feedback_enabled ?? false}
          onChange={(v) => props.onChange({ feedback_enabled: v || undefined })}
          help="When off, trial_template feedback items are skipped"
        />
      </div>
    </li>
  );
}
