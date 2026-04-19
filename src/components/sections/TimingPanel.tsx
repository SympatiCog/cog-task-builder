import { useTaskStore } from "../../store/taskStore";
import { NumberField, Select, Toggle } from "../primitives";
import { SectionHeader } from "./SectionHeader";
import { setTiming } from "../../actions/blocks";
import { useIssuesAt } from "../../validator/hooks";
import type { TimingMode } from "../../types/task";

const MODE_OPTIONS: { value: TimingMode; label: string }[] = [
  { value: "self_paced", label: "self_paced" },
  { value: "fixed_schedule", label: "fixed_schedule" },
  { value: "csv_schedule", label: "csv_schedule" },
];

export function TimingPanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  const issues = useIssuesAt("timing");
  if (!task) return null;
  const timing = task.timing;

  const modeError = issues.find((i) => i.path === "timing.mode")?.message;
  const soaError = issues.find((i) => i.path === "timing.soa_ms")?.message;

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader
        title="Timing"
        help="Inter-trial interval and scheduling mode. self_paced is the common case."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="mode"
          value={timing.mode}
          onChange={(v) => update((t) => setTiming(t, { mode: v as TimingMode }))}
          options={MODE_OPTIONS}
          error={modeError}
        />
        {timing.mode === "fixed_schedule" && (
          <NumberField
            label="soa_ms"
            value={timing.soa_ms}
            onChange={(v) => update((t) => setTiming(t, { soa_ms: v }))}
            min={0}
            step={100}
            required
            error={soaError}
            help="Stimulus-onset asynchrony: each trial starts at block_frame_0 + N × soa_ms."
          />
        )}
        <NumberField
          label="iti_ms"
          value={timing.iti_ms}
          onChange={(v) => update((t) => setTiming(t, { iti_ms: v }))}
          min={0}
          step={50}
          help="Mean inter-trial interval"
        />
        <NumberField
          label="iti_jitter_ms"
          value={timing.iti_jitter_ms}
          onChange={(v) => update((t) => setTiming(t, { iti_jitter_ms: v }))}
          min={0}
          step={50}
          help="Symmetric ± jitter around iti_ms"
        />
        <div className="md:col-span-2">
          <Toggle
            label="allow_overlap"
            checked={timing.allow_overlap ?? false}
            onChange={(v) => update((t) => setTiming(t, { allow_overlap: v || undefined }))}
            help="Lets a long item from one trial persist past the trial boundary. Almost always off."
          />
        </div>
      </div>
    </div>
  );
}
