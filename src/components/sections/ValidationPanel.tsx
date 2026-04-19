import { useValidation } from "../../validator/hooks";
import { SectionHeader } from "./SectionHeader";
import type { ValidationIssue } from "../../validator";

export function ValidationPanel() {
  const { errors, warnings } = useValidation();

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Validation"
        help="Client-side passes mirror the engine's SchemaValidator.gd. Error codes match the engine's so server-side reports (Batch 4) will dedupe cleanly."
      />

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

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
          Warnings ({warnings.length})
        </h3>
        {warnings.length === 0 ? (
          <p className="text-xs italic text-slate-500">No warnings.</p>
        ) : (
          <IssueList issues={warnings} tone="warning" />
        )}
      </div>
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
