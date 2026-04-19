import { useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { Toolbar } from "./Toolbar";
import { JsonPreview } from "./JsonPreview";
import { ImportDropZone } from "./ImportDropZone";
import { MetadataPanel } from "./sections/MetadataPanel";
import { ThemePanel } from "./sections/ThemePanel";
import { AssetsPanel } from "./sections/AssetsPanel";
import { EmptyStub } from "./sections/EmptyStub";

type Section =
  | "metadata"
  | "theme"
  | "assets"
  | "inputs"
  | "responses"
  | "stimulus_types"
  | "trial_template"
  | "timing"
  | "blocks"
  | "session_end";

const SECTIONS: ReadonlyArray<{ id: Section; label: string; batch: number }> = [
  { id: "metadata",        label: "Metadata",       batch: 2 },
  { id: "theme",           label: "Theme",          batch: 2 },
  { id: "assets",          label: "Assets",         batch: 2 },
  { id: "inputs",          label: "Inputs",         batch: 3 },
  { id: "responses",       label: "Responses",      batch: 3 },
  { id: "stimulus_types",  label: "Stimulus types", batch: 3 },
  { id: "trial_template",  label: "Trial template", batch: 5 },
  { id: "timing",          label: "Timing",         batch: 6 },
  { id: "blocks",          label: "Blocks",         batch: 6 },
  { id: "session_end",     label: "Session end",    batch: 6 },
];

export function Shell() {
  const task = useTaskStore((s) => s.task);
  const [active, setActive] = useState<Section>("metadata");
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!task) {
    return (
      <div className="flex h-full flex-col bg-slate-50 text-slate-900">
        <Toolbar />
        <main className="relative flex-1 overflow-hidden">
          <ImportDropZone />
          <EmptyState />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <Toolbar onTogglePreview={() => setPreviewOpen((v) => !v)} previewOpen={previewOpen} />
      <div className="flex flex-1 overflow-hidden">
        <nav className="flex w-48 flex-col gap-0.5 border-r border-slate-200 bg-white p-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-current={active === s.id ? "page" : undefined}
              className={
                "rounded px-2 py-1.5 text-left text-sm aria-[current=page]:bg-slate-800 aria-[current=page]:text-white hover:bg-slate-100 aria-[current=page]:hover:bg-slate-800"
              }
            >
              {s.label}
            </button>
          ))}
        </nav>
        <main className="flex-1 overflow-auto p-6">
          <SectionBody active={active} />
        </main>
        {previewOpen && (
          <aside className="w-[34rem] border-l border-slate-200">
            <JsonPreview />
          </aside>
        )}
      </div>
    </div>
  );
}

function SectionBody({ active }: { active: Section }) {
  switch (active) {
    case "metadata":       return <MetadataPanel />;
    case "theme":          return <ThemePanel />;
    case "assets":         return <AssetsPanel />;
    case "inputs":         return <EmptyStub label="Inputs"         batch={3} />;
    case "responses":      return <EmptyStub label="Responses"      batch={3} />;
    case "stimulus_types": return <EmptyStub label="Stimulus types" batch={3} />;
    case "trial_template": return <EmptyStub label="Trial template" batch={5} />;
    case "timing":         return <EmptyStub label="Timing"         batch={6} />;
    case "blocks":         return <EmptyStub label="Blocks"         batch={6} />;
    case "session_end":    return <EmptyStub label="Session end"    batch={6} />;
  }
}

function EmptyState() {
  const loadNew = useTaskStore((s) => s.newTask);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto max-w-md rounded border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-slate-800">No task loaded</h2>
        <p className="mb-4 text-sm text-slate-600">
          Drag a task JSON onto this window, paste into the import dialog, or
          start from a blank template.
        </p>
        <button
          type="button"
          onClick={loadNew}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Start blank
        </button>
      </div>
    </div>
  );
}
