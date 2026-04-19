import { useMemo } from "react";
import { useTaskStore } from "../../store/taskStore";
import { AssetRefPicker, MsNumberField, NumberField, Select, TextField, Toggle } from "../primitives";
import { CommitTextInput } from "../primitives/CommitTextInput";
import { SectionHeader } from "./SectionHeader";
import { useIssuesAt } from "../../validator/hooks";
import {
  addTrialItem,
  deleteTrialItem,
  renameTrialItem,
  reorderTrialItems,
  setCapturesResponse,
  stubItem,
  updateTrialItem,
} from "../../actions/trialTemplate";
import type { ItemKind, TrialItem } from "../../types/task";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TimelineView } from "./TimelineView";
import { computeOverridesByField, typesOverridingItem } from "../../utils/overrides";

const KIND_OPTIONS: ReadonlyArray<{ value: ItemKind; label: string }> = [
  { value: "text", label: "text" },
  { value: "image", label: "image" },
  { value: "audio", label: "audio" },
  { value: "feedback", label: "feedback" },
  { value: "blank", label: "blank" },
];

export function TrialTemplatePanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!task) return null;
  const items = task.trial_template;

  const imageIds = Object.keys(task.assets.images ?? {});
  const audioIds = Object.keys(task.assets.audio ?? {});
  const poolNames = Object.keys(task.assets.pools ?? {});
  const styleNames = Object.keys(task.metadata.theme?.text_styles ?? {});

  const itemIds = items.map((it) => it.id ?? "").filter(Boolean);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    update((t) => reorderTrialItems(t, oldIndex, newIndex));
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/*
        Sticky header + timeline: as the items list grows past the viewport
        the author can still see the timeline preview and reach the Add
        button without scrolling back up. Background matches <main>'s
        bg-slate-50 so scrolling items don't bleed through; the shadow
        line below hints at the scroll boundary.
      */}
      <div className="sticky top-0 z-20 bg-slate-50 pb-3">
        <SectionHeader
          title="Trial template"
          help="The ordered sequence of items in every trial. Drag to reorder. Exactly one item must have captures_response."
        >
          <button
            type="button"
            onClick={() => {
              let i = 1;
              const ids = new Set(itemIds);
              let id = `item_${i}`;
              while (ids.has(id)) { i++; id = `item_${i}`; }
              update((t) => addTrialItem(t, stubItem("text", id)));
            }}
            className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            + Add item
          </button>
        </SectionHeader>
        {items.length > 0 && <TimelineView items={items} />}
        <div className="pointer-events-none absolute inset-x-0 -bottom-3 h-3 bg-gradient-to-b from-slate-50 to-transparent" />
      </div>

      {items.length === 0 ? (
        <p className="rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No items yet. Add a text item (e.g. a fixation cross) to start.
        </p>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((it, i) => it.id || String(i))} strategy={verticalListSortingStrategy}>
              <ul className="mt-2 flex flex-col gap-2">
                {items.map((item, index) => (
                  <SortableItem key={item.id || index} id={item.id || String(index)}>
                    <TrialItemEditor
                      index={index}
                      item={item}
                      allItems={items}
                      imageIds={imageIds}
                      audioIds={audioIds}
                      poolNames={poolNames}
                      styleNames={styleNames}
                      overrides={computeOverridesByField(item, task.stimulus_types)}
                      overridingTypes={typesOverridingItem(item, task.stimulus_types)}
                      onChange={(patch) => update((t) => updateTrialItem(t, index, patch))}
                      onRenameId={(newId) => {
                        // CommitTextInput already guards against no-op and
                        // empty draft. Duplicate-id check stays — the
                        // primitive has no peer awareness.
                        if (items.some((it) => it.id === newId)) return;
                        update((t) => renameTrialItem(t, item.id, newId));
                      }}
                      onDelete={() => update((t) => deleteTrialItem(t, index))}
                      onSetCapture={() => update((t) => setCapturesResponse(t, index))}
                    />
                  </SortableItem>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="rounded border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
        >
          ⋮⋮
        </button>
        {children}
      </div>
    </li>
  );
}

interface EditorProps {
  index: number;
  item: TrialItem;
  allItems: TrialItem[];
  imageIds: string[];
  audioIds: string[];
  poolNames: string[];
  styleNames: string[];
  overrides: Record<string, string[]>;
  overridingTypes: string[];
  onChange: (patch: Partial<TrialItem>) => void;
  onRenameId: (newId: string) => void;
  onDelete: () => void;
  onSetCapture: () => void;
}

function TrialItemEditor(props: EditorProps) {
  const { index, item, allItems } = props;
  const issues = useIssuesAt(`trial_template[${index}]`);
  const anchorIssue = issues.find(
    (i) =>
      i.path === `trial_template[${index}].anchor` &&
      (i.code === "invalid_anchor" ||
        i.code === "anchor_target_missing" ||
        i.code === "response_anchor_invalid" ||
        i.code === "anchor_cycle"),
  );
  const captureIssue = issues.find((i) => i.code === "multiple_capture");

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <CommitTextInput
          value={item.id}
          onCommit={props.onRenameId}
          ariaLabel="Item id"
          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
        />
        {props.overridingTypes.length > 0 && (
          <span
            className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800"
            title={`Stimulus types overriding this item: ${props.overridingTypes.join(", ")}`}
          >
            Overridden by {props.overridingTypes.length} type{props.overridingTypes.length === 1 ? "" : "s"}
          </span>
        )}
        <Select
          label="kind"
          value={item.kind}
          onChange={(v) => props.onChange({ kind: v as ItemKind })}
          options={KIND_OPTIONS}
        />
        <button
          type="button"
          onClick={props.onDelete}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MsNumberField
          label="onset_ms"
          value={item.onset_ms}
          onChange={(v) => props.onChange({ onset_ms: v ?? 0 })}
          min={0}
        />
        <MsNumberField
          label="duration_ms"
          value={item.duration_ms}
          onChange={(v) => props.onChange({ duration_ms: v ?? 0 })}
          min={0}
          help="0 = persists until trial end"
        />
        <MsNumberField
          label="jitter_ms"
          value={item.jitter_ms}
          onChange={(v) => props.onChange({ jitter_ms: v })}
          min={0}
        />
        <MsNumberField
          label="response_window_ms"
          value={item.response_window_ms}
          onChange={(v) => props.onChange({ response_window_ms: v })}
          min={0}
        />
      </div>

      <AnchorPicker
        anchor={item.anchor}
        selfId={item.id}
        allItems={allItems}
        onChange={(v) => props.onChange({ anchor: v })}
        error={anchorIssue?.message}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Toggle
          label="wait_for_response"
          checked={item.wait_for_response ?? false}
          onChange={(v) => props.onChange({ wait_for_response: v || undefined })}
          help="Trial doesn't end until this item resolves"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={item.captures_response === true}
            onChange={props.onSetCapture}
            aria-label="captures_response"
          />
          captures_response
          {captureIssue && (
            <span className="text-xs text-rose-600">{captureIssue.message}</span>
          )}
        </label>
      </div>

      {item.kind !== "feedback" && item.kind !== "blank" && (
        <div>
          <AssetRefPicker
            label="asset"
            value={typeof item.asset === "string" ? item.asset : ""}
            onChange={(v) => props.onChange({ asset: v || undefined })}
            images={props.imageIds}
            audio={props.audioIds}
            pools={item.kind === "audio" ? [] : props.poolNames}
            help={
              item.kind === "text"
                ? "txt:<literal> — the literal renders as text"
                : item.kind === "image"
                ? "img:<id> or img:pool:<name>"
                : "aud:<id>"
            }
          />
          <OverrideHint types={props.overrides.asset} field="asset" />
        </div>
      )}

      {(item.kind === "text" || item.kind === "image") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <TextField
              label="extras.style"
              value={typeof item.extras?.style === "string" ? item.extras.style : ""}
              onChange={(v) => {
                const { style: _ignore, ...rest } = item.extras ?? {};
                const nextExtras = v ? { ...rest, style: v } : rest;
                props.onChange({ extras: Object.keys(nextExtras).length > 0 ? nextExtras : undefined });
              }}
              help={props.styleNames.length > 0 ? `Known: ${props.styleNames.join(", ")}` : "No styles declared"}
            />
            <OverrideHint types={props.overrides["extras.style"]} field="extras.style" />
          </div>
          {item.kind === "image" && (
            <div>
              <NumberField
                label="extras.size_pct"
                value={typeof item.extras?.size_pct === "number" ? item.extras.size_pct : undefined}
                onChange={(v) => {
                  const { size_pct: _ignore, ...rest } = item.extras ?? {};
                  const nextExtras = v !== undefined ? { ...rest, size_pct: v } : rest;
                  props.onChange({ extras: Object.keys(nextExtras).length > 0 ? nextExtras : undefined });
                }}
                min={0}
                max={1}
                step={0.05}
                help="Width as fraction of viewport (e.g. 0.35)"
              />
              <OverrideHint types={props.overrides["extras.size_pct"]} field="extras.size_pct" />
            </div>
          )}
        </div>
      )}

      {item.kind === "feedback" && (
        <FeedbackCasesEditor
          item={item}
          styleNames={props.styleNames}
          imageIds={props.imageIds}
          audioIds={props.audioIds}
          overrides={props.overrides}
          onChange={props.onChange}
        />
      )}
    </div>
  );
}

// Per-field hint that lists the stimulus types overriding this specific
// field on the parent item. Rendered under the form field itself so the
// author knows the base value will be replaced at runtime and by whom.
function OverrideHint({ types, field }: { types: string[] | undefined; field: string }) {
  if (!types || types.length === 0) return null;
  const MAX = 4;
  const visible = types.slice(0, MAX);
  const hidden = types.length - visible.length;
  return (
    <p className="mt-1 text-xs text-blue-700">
      Overridden in {types.length} stimulus type{types.length === 1 ? "" : "s"} via{" "}
      <code className="font-mono">{field}</code>:{" "}
      <span className="font-mono">{visible.join(", ")}</span>
      {hidden > 0 && <span>{" "}and {hidden} more</span>}
    </p>
  );
}

interface AnchorPickerProps {
  anchor: string | undefined;
  selfId: string;
  allItems: TrialItem[];
  onChange: (v: string | undefined) => void;
  error?: string;
}

function AnchorPicker({ anchor, selfId, allItems, onChange, error }: AnchorPickerProps) {
  const options = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: "__default__", label: "trial_start (default)" },
    ];
    for (const it of allItems) {
      if (!it.id || it.id === selfId) continue;
      opts.push({ value: `${it.id}.end`, label: `${it.id}.end` });
      if (it.captures_response) {
        opts.push({ value: `${it.id}.response`, label: `${it.id}.response` });
      }
    }
    return opts;
  }, [allItems, selfId]);

  const value = anchor ?? "__default__";
  return (
    <Select
      label="anchor"
      value={value}
      onChange={(v) => onChange(v === "__default__" ? undefined : v)}
      options={options}
      help="Anchor to the start of the trial, another item's end/start, or (for capturer items) its response."
      error={error}
    />
  );
}

interface FeedbackCasesEditorProps {
  item: TrialItem;
  styleNames: string[];
  imageIds: string[];
  audioIds: string[];
  overrides: Record<string, string[]>;
  onChange: (patch: Partial<TrialItem>) => void;
}

function FeedbackCasesEditor({ item, styleNames, imageIds, audioIds, overrides, onChange }: FeedbackCasesEditorProps) {
  const cases = item.cases ?? {};
  const outcomes = ["correct", "incorrect", "timeout"] as const;

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cases</h4>
      <p className="mb-3 text-xs text-slate-600">
        Anchor to <code>cs.end</code> if feedback should render for all three outcomes —
        <code>.response</code> does not fire on timeout.
      </p>
      <div className="flex flex-col gap-3">
        {outcomes.map((o) => {
          const c = cases[o] ?? {};
          return (
            <div key={o} className="flex flex-col gap-1">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <TextField
                  label={`${o}.text`}
                  value={c.text ?? ""}
                  onChange={(v) => onChange({ cases: { ...cases, [o]: { ...c, text: v || undefined } } })}
                />
                <TextField
                  label={`${o}.style`}
                  value={c.style ?? ""}
                  onChange={(v) => onChange({ cases: { ...cases, [o]: { ...c, style: v || undefined } } })}
                  help={styleNames.length > 0 ? `Known: ${styleNames.join(", ")}` : undefined}
                />
                <AssetRefPicker
                  label={`${o}.asset`}
                  value={c.asset ?? ""}
                  onChange={(v) => onChange({ cases: { ...cases, [o]: { ...c, asset: v || undefined } } })}
                  images={imageIds}
                  audio={audioIds}
                  pools={[]}
                  help="Pool refs not supported inside cases"
                />
              </div>
              <OverrideHint types={overrides[`cases.${o}`]} field={`cases.${o}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
