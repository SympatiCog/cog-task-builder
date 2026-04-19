import { useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { Toolbar } from "./Toolbar";
import { JsonPreview } from "./JsonPreview";
import { ImportDropZone } from "./ImportDropZone";
import { ValidationBanner } from "./ValidationBanner";
import { MetadataPanel } from "./sections/MetadataPanel";
import { ThemePanel } from "./sections/ThemePanel";
import { AssetsPanel } from "./sections/AssetsPanel";
import { InputsPanel } from "./sections/InputsPanel";
import { ResponsesPanel } from "./sections/ResponsesPanel";
import { StimulusTypesPanel } from "./sections/StimulusTypesPanel";
import { TrialTemplatePanel } from "./sections/TrialTemplatePanel";
import { TimingPanel } from "./sections/TimingPanel";
import { BlocksPanel } from "./sections/BlocksPanel";
import { SessionEndPanel } from "./sections/SessionEndPanel";
import { ValidationPanel } from "./sections/ValidationPanel";
import { HelpPanel } from "./sections/HelpPanel";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { validate } from "../validator";
import { exportTask } from "../serde/export";

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
  | "session_end"
  | "validation"
  | "help";

const SECTIONS: ReadonlyArray<{ id: Section; label: string }> = [
  { id: "metadata",        label: "Metadata"       },
  { id: "theme",           label: "Theme"          },
  { id: "assets",          label: "Assets"         },
  { id: "inputs",          label: "Inputs"         },
  { id: "responses",       label: "Responses"      },
  { id: "stimulus_types",  label: "Stimulus types" },
  { id: "trial_template",  label: "Trial template" },
  { id: "timing",          label: "Timing"         },
  { id: "blocks",          label: "Blocks"         },
  { id: "session_end",     label: "Session end"    },
  { id: "validation",      label: "Validation"     },
  { id: "help",            label: "Help"           },
];

export function Shell() {
  const task = useTaskStore((s) => s.task);
  const [active, setActive] = useState<Section>("metadata");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Global shortcuts. Mod+E exports (with validator gate replicated here so
  // the gate lives in one place), Mod+/ jumps to validation, Mod+I is a hint
  // toward paste-import (fires the same window opener as the Toolbar button).
  useKeyboardShortcuts([
    {
      combo: "mod+e",
      description: "Export JSON",
      handler: () => {
        if (!task) return;
        const report = validate(task);
        if (report.errors.length > 0) {
          const ok = window.confirm(
            `Validator reports ${report.errors.length} error(s). The engine will refuse this task. Export anyway?`,
          );
          if (!ok) return;
        }
        const json = exportTask(task);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${task.metadata?.task_id ?? "task"}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
      },
    },
    {
      combo: "mod+/",
      description: "Jump to Validation",
      handler: () => setActive("validation"),
    },
  ]);

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
      <a
        href="#main-panel"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-1.5 focus:text-sm focus:shadow"
      >
        Skip to main panel
      </a>
      <Toolbar onTogglePreview={() => setPreviewOpen((v) => !v)} previewOpen={previewOpen} />
      <div className="flex flex-1 overflow-hidden">
        <nav aria-label="Sections" className="flex w-48 flex-col gap-0.5 border-r border-slate-200 bg-white p-2">
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
        <main id="main-panel" tabIndex={-1} className="flex-1 overflow-auto p-6">
          <ValidationBanner onOpen={() => setActive("validation")} />
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
    case "inputs":         return <InputsPanel />;
    case "responses":      return <ResponsesPanel />;
    case "stimulus_types": return <StimulusTypesPanel />;
    case "trial_template": return <TrialTemplatePanel />;
    case "timing":         return <TimingPanel />;
    case "blocks":         return <BlocksPanel />;
    case "session_end":    return <SessionEndPanel />;
    case "validation":     return <ValidationPanel />;
    case "help":           return <HelpPanel />;
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
