import { useMemo } from "react";
import { useTaskStore } from "../store/taskStore";
import { validate, type ValidationReport, type ValidationIssue } from "./index";

// Memoized validation over the current task. The task object reference changes
// on every edit (updateTask returns a new object), so useMemo's dependency
// catches edits correctly.
export function useValidation(): ValidationReport {
  const task = useTaskStore((s) => s.task);
  return useMemo(() => validate(task), [task]);
}

// Filter issues by a path prefix — fields use this to find errors that
// belong to their subtree. Path format matches engine conventions:
// "stimulus_types.go_left.items.cs.asset" is a prefix of itself. Match is
// prefix with boundary check to avoid e.g. "a" matching "abc".
export function useIssuesAt(pathPrefix: string): ValidationIssue[] {
  const report = useValidation();
  return useMemo(() => {
    const all = [...report.errors, ...report.warnings];
    return all.filter((iss) => {
      if (iss.path === pathPrefix) return true;
      if (!iss.path.startsWith(pathPrefix)) return false;
      const nextChar = iss.path.charCodeAt(pathPrefix.length);
      return nextChar === 46 /* "." */ || nextChar === 91 /* "[" */;
    });
  }, [report, pathPrefix]);
}

export function issueClass(issues: ValidationIssue[], allIssues: ValidationReport): "error" | "warning" | null {
  const errorCodes = new Set(allIssues.errors.map((e) => e.code + e.path));
  for (const iss of issues) if (errorCodes.has(iss.code + iss.path)) return "error";
  if (issues.length > 0) return "warning";
  return null;
}
