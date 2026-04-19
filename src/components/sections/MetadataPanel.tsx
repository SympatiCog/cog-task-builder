import { useTaskStore } from "../../store/taskStore";
import { CommaListField, TextField, NumberField, Toggle } from "../primitives";
import { setMetadata } from "../../actions/metadata";
import { SectionHeader } from "./SectionHeader";
import { useIssuesAt } from "../../validator/hooks";
import type { TargetDevice } from "../../types/task";

const TARGET_DEVICES: readonly TargetDevice[] = ["desktop", "tablet", "phone"];

export function MetadataPanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  const taskIdIssues = useIssuesAt("metadata.task_id");
  const taskVersionIssues = useIssuesAt("metadata.task_version");
  if (!task) return null;
  const m = task.metadata;

  const idError = taskIdIssues[0]?.message;
  const versionError = taskVersionIssues[0]?.message;

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader title="Metadata" help="Basic identity, platform targets, and defaults." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="Task ID"
          value={m.task_id ?? ""}
          onChange={(v) => update((t) => setMetadata(t, "task_id", v))}
          required
          help="Unique id, ^[a-z0-9_]+$"
          error={idError}
        />
        <TextField
          label="Task version"
          value={m.task_version ?? ""}
          onChange={(v) => update((t) => setMetadata(t, "task_version", v))}
          required
          help="Free-form, conventionally semver"
          error={versionError}
        />
        <TextField
          label="Name"
          value={m.name ?? ""}
          onChange={(v) => update((t) => setMetadata(t, "name", v || undefined))}
          help="Human-readable label"
        />
        <TextField
          label="Author"
          value={m.author ?? ""}
          onChange={(v) => update((t) => setMetadata(t, "author", v || undefined))}
        />
        <div className="md:col-span-2">
          <TextField
            label="Notes"
            value={m.notes ?? ""}
            onChange={(v) => update((t) => setMetadata(t, "notes", v || undefined))}
            help="Use to document non-obvious decisions (timing assumptions, analysis caveats)"
          />
        </div>
        <NumberField
          label="Min refresh (Hz)"
          value={m.min_refresh_hz}
          onChange={(v) => update((t) => setMetadata(t, "min_refresh_hz", v))}
          help="Default 55. Lower if participants use old phones."
          min={1}
          step={1}
        />
        <CommaListField
          label="Allowed refresh Hz"
          value={(m.allowed_refresh_hz ?? []).map(String)}
          onChange={(v) => {
            const parsed = v.map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0);
            update((t) => setMetadata(t, "allowed_refresh_hz", parsed.length > 0 ? parsed : undefined));
          }}
          help="Optional whitelist. If set, the device must match exactly or the task refuses to run."
        />
        <TargetDevicesField
          value={m.target_devices ?? []}
          onChange={(v) => update((t) => setMetadata(t, "target_devices", v.length > 0 ? v : undefined))}
        />
        <div className="md:col-span-2">
          <Toggle
            label="Log per-frame data"
            checked={m.log_frames ?? false}
            onChange={(v) => update((t) => setMetadata(t, "log_frames", v || undefined))}
            help="Enables a per-frame columnar log. Produces very large payloads."
          />
        </div>
      </div>
    </div>
  );
}

function TargetDevicesField({
  value,
  onChange,
}: { value: TargetDevice[]; onChange: (v: TargetDevice[]) => void }) {
  const set = new Set(value);
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium text-slate-700">Target devices</legend>
      <div className="flex flex-wrap gap-3 rounded border border-slate-300 bg-white px-2 py-1.5">
        {TARGET_DEVICES.map((d) => (
          <label key={d} className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={set.has(d)}
              onChange={() => {
                if (set.has(d)) onChange(value.filter((v) => v !== d));
                else onChange([...value, d]);
              }}
            />
            {d}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">Leave all unchecked to let the task run on any device.</p>
    </fieldset>
  );
}
