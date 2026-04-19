import { useTaskStore } from "../../store/taskStore";
import { AssetRefPicker, KeyedList, Select, TextField } from "../primitives";
import { SectionHeader } from "./SectionHeader";
import { useIssuesAt } from "../../validator/hooks";
import {
  addStimulusType,
  deleteItemOverride,
  deleteStimulusType,
  renameStimulusType,
  setItemOverride,
  setStimulusType,
} from "../../actions/stimulusTypes";
import type { ItemOverrides, StimulusType } from "../../types/task";

export function StimulusTypesPanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  if (!task) return null;

  const responseOptions = Object.keys(task.responses).map((k) => ({ value: k, label: k }));
  const templateIds = (task.trial_template ?? []).map((it) => it?.id).filter(Boolean) as string[];
  const imageIds = Object.keys(task.assets.images ?? {});
  const audioIds = Object.keys(task.assets.audio ?? {});
  const poolNames = Object.keys(task.assets.pools ?? {});

  const handleAdd = () => {
    const base = "type_";
    let i = 1;
    while (`${base}${i}` in task.stimulus_types) i++;
    update((t) => addStimulusType(t, `${base}${i}`));
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/*
        Sticky header: as the types list grows, the help text and Add button
        stay visible. Matching the TrialTemplatePanel pattern. Background
        matches <main>'s bg-slate-50 so rows don't bleed through the
        sticky layer when scrolled.
      */}
      <div className="sticky top-0 z-20 bg-slate-50 pb-3">
        <SectionHeader
          title="Stimulus types"
          help="Each type declares a correct_response plus per-item overrides on the trial_template. Factorial conditions become N types (e.g., congruent_left, incongruent_right)."
        >
          <button
            type="button"
            onClick={handleAdd}
            className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            + Add type
          </button>
        </SectionHeader>
      </div>
      <KeyedList
        label="Types"
        collapsible
        entries={Object.entries(task.stimulus_types)}
        onRename={(oldId, newId) => {
          if (newId in task.stimulus_types) return;
          update((t) => renameStimulusType(t, oldId, newId));
        }}
        onDelete={(id) => update((t) => deleteStimulusType(t, id))}
        renderRow={(typeId, type) => (
          <StimulusTypeEditor
            typeId={typeId}
            type={type}
            responseOptions={responseOptions}
            templateIds={templateIds}
            imageIds={imageIds}
            audioIds={audioIds}
            poolNames={poolNames}
            onCorrectResponseChange={(v) =>
              update((t) => setStimulusType(t, typeId, { ...type, correct_response: v }))
            }
            onSetOverride={(itemId, overrides) =>
              update((t) => setItemOverride(t, typeId, itemId, overrides))
            }
            onDeleteOverride={(itemId) =>
              update((t) => deleteItemOverride(t, typeId, itemId))
            }
          />
        )}
      />
    </div>
  );
}

interface EditorProps {
  typeId: string;
  type: StimulusType;
  responseOptions: { value: string; label: string }[];
  templateIds: string[];
  imageIds: string[];
  audioIds: string[];
  poolNames: string[];
  onCorrectResponseChange: (v: string) => void;
  onSetOverride: (itemId: string, overrides: ItemOverrides) => void;
  onDeleteOverride: (itemId: string) => void;
}

function StimulusTypeEditor(props: EditorProps) {
  const { typeId, type, templateIds } = props;
  const crIssues = useIssuesAt(`stimulus_types.${typeId}.correct_response`);
  const unknownItemIds = Object.keys(type.items ?? {}).filter((id) => !templateIds.includes(id));

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Correct response"
        value={type.correct_response}
        onChange={props.onCorrectResponseChange}
        options={[{ value: "", label: "(select)" }, ...props.responseOptions]}
        error={crIssues.find((i) => i.code === "unknown_label" || i.code === "missing")?.message}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Per-item overrides</h4>
          {templateIds.length === 0 && (
            <p className="text-xs italic text-slate-500">Declare items in the trial template first.</p>
          )}
        </div>
        {templateIds.length > 0 && (
          <ul className="flex flex-col divide-y divide-slate-200 rounded border border-slate-200">
            {templateIds.map((itemId) => {
              const override = type.items?.[itemId];
              return (
                <li key={itemId} className="flex flex-col gap-2 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-700">{itemId}</span>
                    {override && (
                      <button
                        type="button"
                        onClick={() => props.onDeleteOverride(itemId)}
                        className="text-xs text-rose-700 hover:underline"
                      >
                        Remove override
                      </button>
                    )}
                  </div>
                  {override ? (
                    <ItemOverrideEditor
                      overrides={override}
                      imageIds={props.imageIds}
                      audioIds={props.audioIds}
                      poolNames={props.poolNames}
                      onChange={(next) => props.onSetOverride(itemId, next)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => props.onSetOverride(itemId, { asset: "txt:" })}
                      className="self-start rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      + Override {itemId}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {unknownItemIds.length > 0 && (
          <p role="alert" className="mt-2 text-xs text-rose-600">
            Overrides target unknown trial-template ids: {unknownItemIds.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

interface ItemOverrideEditorProps {
  overrides: ItemOverrides;
  imageIds: string[];
  audioIds: string[];
  poolNames: string[];
  onChange: (next: ItemOverrides) => void;
}

function ItemOverrideEditor({ overrides, imageIds, audioIds, poolNames, onChange }: ItemOverrideEditorProps) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <AssetRefPicker
        label="Asset"
        value={typeof overrides.asset === "string" ? overrides.asset : ""}
        onChange={(v) => onChange({ ...overrides, asset: v })}
        images={imageIds}
        audio={audioIds}
        pools={poolNames}
      />
      <TextField
        label="Style (extras.style)"
        value={typeof overrides.extras?.style === "string" ? overrides.extras.style : ""}
        onChange={(v) => {
          const { style: _ignored, ...rest } = overrides.extras ?? {};
          const nextExtras = v === "" ? rest : { ...rest, style: v };
          const empty = Object.keys(nextExtras).length === 0;
          onChange({ ...overrides, extras: empty ? undefined : nextExtras });
        }}
        help="References a theme.text_styles name"
      />
    </div>
  );
}
