import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateOnServer } from "../src/validator/serverValidate";
import { newTask } from "../src/defaults/newTask";

// serverValidate has two branches: (a) no VITE_VALIDATOR_URL → client-stub
// fallback; (b) URL set → fetch the server, normalize, surface transport
// errors. The fallback is incidentally exercised by the rest of the suite
// via useValidation; these tests pin the fetch branch.

describe("validateOnServer", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_VALIDATOR_URL", "https://fake.example.com/validate");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response): void {
    vi.stubGlobal("fetch", vi.fn(impl as unknown as typeof fetch));
  }

  it("happy path: posts task JSON and returns server report", async () => {
    const captured: { url?: string; body?: string } = {};
    mockFetch((url, init) => {
      captured.url = url;
      captured.body = init?.body as string;
      return new Response(
        JSON.stringify({
          errors: [{ path: "metadata.task_id", code: "missing", message: "x" }],
          warnings: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const r = await validateOnServer(newTask());
    expect(r.source).toBe("server");
    expect(r.transportError).toBeUndefined();
    expect(r.report.errors).toHaveLength(1);
    expect(r.report.errors[0].code).toBe("missing");
    expect(captured.url).toBe("https://fake.example.com/validate");
    expect(captured.body).toBeTruthy();
    expect(JSON.parse(captured.body!)).toHaveProperty("taskJson");
  });

  it("HTTP error: surfaces transport error, report is empty", async () => {
    mockFetch(() => new Response("server boom", { status: 500, statusText: "Internal Server Error" }));
    const r = await validateOnServer(newTask());
    expect(r.source).toBe("server");
    expect(r.transportError).toBe("HTTP 500: Internal Server Error");
    expect(r.report).toEqual({ errors: [], warnings: [] });
  });

  it("network error: surfaces thrown message", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const r = await validateOnServer(newTask());
    expect(r.source).toBe("server");
    expect(r.transportError).toBe("Failed to fetch");
    expect(r.report).toEqual({ errors: [], warnings: [] });
  });

  it("malformed response: normalize coerces missing errors/warnings to empty arrays", async () => {
    mockFetch(() => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    const r = await validateOnServer(newTask());
    expect(r.source).toBe("server");
    expect(r.transportError).toBeUndefined();
    expect(r.report).toEqual({ errors: [], warnings: [] });
  });

  it("malformed response: non-array errors is coerced to []", async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ errors: "oops", warnings: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = await validateOnServer(newTask());
    expect(r.report).toEqual({ errors: [], warnings: [] });
  });

  it("non-JSON body: falls through to catch, surfaces parse error", async () => {
    mockFetch(() =>
      new Response("<!doctype html>...", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const r = await validateOnServer(newTask());
    expect(r.transportError).toBeTruthy();
    expect(r.report).toEqual({ errors: [], warnings: [] });
  });

  it("client-stub fallback when VITE_VALIDATOR_URL is unset", async () => {
    vi.stubEnv("VITE_VALIDATOR_URL", "");
    const r = await validateOnServer(newTask());
    expect(r.source).toBe("client-stub");
    expect(r.transportError).toBeUndefined();
    // newTask() is intentionally incomplete — client-stub must return real
    // client-validator findings, not an empty report.
    expect(r.report.errors.length).toBeGreaterThan(0);
  });
});
