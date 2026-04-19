import type { TaskJson } from "../types/task";
import type { ValidationReport } from "./index";
import { validate as validateClient } from "./index";

// Authoritative validation via a Godot-headless HTTP wrapper. Expected shape:
//   POST /validate  { taskJson: object }  → ValidationReport
// If `VITE_VALIDATOR_URL` isn't set, the stub returns the client-side report
// so the UI is exercised end-to-end even without a backend. Error codes on
// both sides match (the client is a port of the engine's cheap passes), so a
// merged view dedupes cleanly once both reports are available.

export interface ServerValidateResult {
  report: ValidationReport;
  source: "client-stub" | "server";
  latencyMs: number;
  transportError?: string;
}

export async function validateOnServer(task: TaskJson): Promise<ServerValidateResult> {
  const started = performance.now();
  const url = (import.meta.env.VITE_VALIDATOR_URL as string | undefined) ?? null;
  if (!url) {
    // Stub: fall back to the client validator so the UI's "run server
    // validation" path is exercisable with no backend.
    return {
      report: validateClient(task),
      source: "client-stub",
      latencyMs: performance.now() - started,
    };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskJson: task }),
    });
    if (!res.ok) {
      return {
        report: { errors: [], warnings: [] },
        source: "server",
        latencyMs: performance.now() - started,
        transportError: `HTTP ${res.status}: ${res.statusText}`,
      };
    }
    const body = (await res.json()) as ValidationReport;
    return {
      report: normalize(body),
      source: "server",
      latencyMs: performance.now() - started,
    };
  } catch (e) {
    return {
      report: { errors: [], warnings: [] },
      source: "server",
      latencyMs: performance.now() - started,
      transportError: (e as Error).message,
    };
  }
}

function normalize(r: unknown): ValidationReport {
  const errors = Array.isArray((r as ValidationReport)?.errors) ? (r as ValidationReport).errors : [];
  const warnings = Array.isArray((r as ValidationReport)?.warnings) ? (r as ValidationReport).warnings : [];
  return { errors, warnings };
}
