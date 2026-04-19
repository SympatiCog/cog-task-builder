import { useState } from "react";
import { useValidation } from "../../validator/hooks";
import { useTaskStore } from "../../store/taskStore";
import { validateOnServer, type ServerValidateResult } from "../../validator/serverValidate";
import { SectionHeader } from "./SectionHeader";
import type { ValidationIssue } from "../../validator";

export function ValidationPanel() {
  const { errors, warnings } = useValidation();
  const task = useTaskStore((s) => s.task);
  const [server, setServer] = useState<ServerValidateResult | null>(null);
  const [running, setRunning] = useState(false);

  const runServer = async () => {
    if (!task) return;
    setRunning(true);
    try {
      setServer(await validateOnServer(task));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Validation"
        help="Client-side passes mirror the engine's SchemaValidator.gd. The server pass runs the full validator headless and is authoritative."
      >
        <button
          type="button"
          onClick={() => void runServer()}
          disabled={!task || running}
          className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
        >
          {running ? "Running..." : "Run server validation"}
        </button>
      </SectionHeader>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-rose-700">
          Errors ({errors.length})
        </h3>
        {errors.length === 0 ? (
          <p className="text-xs italic text-slate-500">No errors.</p>
        ) : (
          <IssueList issues={errors} tone="error" />
        )}
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
          Warnings ({warnings.length})
        </h3>
        {warnings.length === 0 ? (
          <p className="text-xs italic text-slate-500">No warnings.</p>
        ) : (
          <IssueList issues={warnings} tone="warning" />
        )}
      </div>

      {server && (
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Server validation ({server.source === "client-stub" ? "stub — no backend configured" : "server"})
            </h3>
            <span className="text-xs text-slate-500">{server.latencyMs.toFixed(0)} ms</span>
          </div>
          {server.transportError && (
            <p role="alert" className="mb-2 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800">
              Transport error: {server.transportError}
            </p>
          )}
          {server.report.errors.length === 0 && server.report.warnings.length === 0 ? (
            <p className="text-xs italic text-slate-500">No issues from server.</p>
          ) : (
            <>
              {server.report.errors.length > 0 && <IssueList issues={server.report.errors} tone="error" />}
              {server.report.warnings.length > 0 && (
                <div className="mt-2">
                  <IssueList issues={server.report.warnings} tone="warning" />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function IssueList({ issues, tone }: { issues: ValidationIssue[]; tone: "error" | "warning" }) {
  const border = tone === "error" ? "border-rose-200" : "border-amber-200";
  return (
    <ul className={`divide-y rounded border ${border} bg-white`}>
      {issues.map((iss, i) => (
        <li key={`${iss.path}:${iss.code}:${i}`} className="flex flex-col gap-0.5 p-3 text-sm">
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs text-slate-500">{iss.path}</code>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              tone === "error" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
            }`}>
              {iss.code}
            </span>
          </div>
          <div className="text-slate-700">{iss.message}</div>
        </li>
      ))}
    </ul>
  );
}
