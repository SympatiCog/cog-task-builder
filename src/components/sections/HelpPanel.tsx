import { SectionHeader } from "./SectionHeader";

const SHORTCUTS: Array<{ combo: string; desc: string }> = [
  { combo: "Mod+E", desc: "Export JSON (runs client validator first)" },
  { combo: "Mod+/", desc: "Jump to Validation" },
  { combo: "Esc",   desc: "Close the paste-import dialog" },
];

export function HelpPanel() {
  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Help"
        help="Quick reference for the builder. Spec source: docs/LLM_TASK_AUTHORING.md inside the vendor/engine submodule."
      />

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Workflow</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Start from <strong>New</strong> or import an existing task (file picker, paste JSON, or drag a file onto the window).</li>
          <li>Fill <em>Metadata</em>, <em>Theme</em>, <em>Inputs</em>, <em>Responses</em> first — every downstream panel references these.</li>
          <li>Add <em>Assets</em> (images/audio/pools) next so <em>Stimulus types</em> and <em>Trial template</em> can autocomplete refs.</li>
          <li>Build the <em>Trial template</em> (one row per item, drag to reorder). Mark exactly one item as <code>captures_response</code>.</li>
          <li>Define <em>Stimulus types</em> — each one carries a <code>correct_response</code> and overrides items in the trial template.</li>
          <li>Set <em>Timing</em> and add <em>Blocks</em>. A block picks a subset of stimulus types plus an ordering rule.</li>
          <li>Check <em>Validation</em>. Export JSON when the error count is zero.</li>
        </ol>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Keyboard shortcuts</h3>
        <ul className="divide-y rounded border border-slate-200 bg-white">
          {SHORTCUTS.map((s) => (
            <li key={s.combo} className="flex items-center justify-between p-2 text-sm">
              <kbd className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-xs">{s.combo}</kbd>
              <span className="text-slate-700">{s.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Validator</h3>
        <p className="text-sm text-slate-700">
          The client-side validator mirrors the engine's cheap passes and
          uses identical error codes. Run <em>Run server validation</em> in
          the Validation panel for the authoritative pass (stubbed when no
          backend is configured — set <code>VITE_VALIDATOR_URL</code> to
          point at a Godot-headless HTTP wrapper).
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Drafts</h3>
        <p className="text-sm text-slate-700">
          The current task is auto-saved to <code>localStorage</code>
          {" "}under the key <code>cog-task-builder:v1</code>. <strong>Reset</strong>
          {" "}clears it. <strong>New</strong> overwrites the draft with a
          blank template (with confirmation).
        </p>
      </section>
    </div>
  );
}
