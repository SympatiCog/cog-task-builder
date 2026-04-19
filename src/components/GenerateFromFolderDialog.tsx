import { useEffect, useMemo, useRef, useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { applyFolderToPool, type PreparedEntry } from "../actions/poolFolder";
import { slugifyUnique } from "../utils/slugify";
import { sha256File } from "../utils/sha256";
import { Select, TextField, Toggle } from "./primitives";

interface Props {
  poolName: string;
  onClose: () => void;
}

type Source = "bundled" | "remote";

// Extended File type — webkitdirectory inputs populate webkitRelativePath on
// each File but TS's lib.dom marks it as optional. We guard at read time.
interface FileWithPath extends File {
  webkitRelativePath: string;
}

interface PreparedRow {
  file: FileWithPath;
  id: string;
  collision: boolean;
  finalPath: string;   // res:// path (bundled) or URL (remote)
  sha256?: string;
  hashError?: string;
}

// Generate images + pool members from a picked folder. Works for both
// bundled (res:// paths) and remote (https:// URLs + SHA-256 hashed locally)
// modes. The author picks a folder, the dialog shows a preview table, and
// on Apply the pure poolFolder action commits the changes to the task.
export function GenerateFromFolderDialog({ poolName, onClose }: Props) {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);

  const fileInput = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<Source>("bundled");
  const [pathPrefix, setPathPrefix] = useState("res://assets/");
  const [urlPrefix, setUrlPrefix] = useState("https://");
  const [stripTopLevel, setStripTopLevel] = useState(true);
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [hashProgress, setHashProgress] = useState<{ done: number; total: number } | null>(null);
  const [hashError, setHashError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Whenever the file list or source mode changes, reset hashing state.
  // Remote mode triggers a background hash pass; bundled mode skips it.
  useEffect(() => {
    if (files.length === 0 || source !== "remote") {
      setHashes({});
      setHashProgress(null);
      setHashError(null);
      return;
    }
    let cancelled = false;
    setHashProgress({ done: 0, total: files.length });
    setHashError(null);
    (async () => {
      const out: Record<string, string> = {};
      let done = 0;
      for (const f of files) {
        if (cancelled) return;
        try {
          out[f.webkitRelativePath || f.name] = await sha256File(f);
        } catch (e) {
          setHashError(`SHA-256 failed on ${f.name}: ${(e as Error).message}`);
          return;
        }
        done++;
        if (!cancelled) {
          setHashes({ ...out });
          setHashProgress({ done, total: files.length });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [files, source]);

  const rows: PreparedRow[] = useMemo(() => {
    if (files.length === 0 || !task) return [];
    const used = new Set(Object.keys(task.assets.images ?? {}));
    return files.map((f) => {
      const rawRel = f.webkitRelativePath || f.name;
      const rel = stripTopLevel ? stripFirstSegment(rawRel) : rawRel;
      const { id, taken } = slugifyUnique(f.name, used);
      const finalPath = source === "bundled" ? pathPrefix + rel : urlPrefix + rel;
      const sha = hashes[rawRel];
      return {
        file: f,
        id,
        collision: taken,
        finalPath,
        sha256: sha,
      };
    });
  }, [files, source, pathPrefix, urlPrefix, stripTopLevel, hashes, task]);

  const collisionCount = rows.filter((r) => r.collision).length;
  const remotePending = source === "remote" && hashProgress !== null && hashProgress.done < hashProgress.total;
  const urlLooksValid = source === "bundled" || isValidHttpsPrefix(urlPrefix);
  const canApply = rows.length > 0 && !remotePending && !hashError && urlLooksValid && (source === "bundled" || pathPrefix !== "");

  const handlePickFiles = (picked: FileList | null) => {
    if (!picked) return;
    const list: FileWithPath[] = [];
    for (let i = 0; i < picked.length; i++) {
      const f = picked.item(i) as FileWithPath | null;
      if (!f) continue;
      if (!f.type.startsWith("image/")) continue;
      list.push(f);
    }
    list.sort((a, b) =>
      (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name),
    );
    setFiles(list);
  };

  const handleApply = () => {
    if (!task || !canApply) return;
    const entries: PreparedEntry[] = rows.map((r) => ({
      id: r.id,
      originalName: r.file.name,
      relativePath: r.file.webkitRelativePath || r.file.name,
      asset:
        source === "bundled"
          ? { source: "bundled", path: r.finalPath }
          : { source: "remote", url: r.finalPath, sha256: r.sha256 ?? "" },
    }));
    update((t) => applyFolderToPool(t, poolName, entries));
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Generate images for pool ${poolName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col gap-3 rounded bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Generate images from folder — pool <code>{poolName}</code>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            {files.length > 0 ? "Choose different folder" : "Choose folder"}
          </button>
          {files.length > 0 && (
            <span className="text-sm text-slate-600">
              {files.length} image{files.length === 1 ? "" : "s"} selected
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            // @ts-expect-error non-standard attributes honored by all major browsers
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden"
            onChange={(e) => {
              handlePickFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label="Source"
            value={source}
            onChange={(v) => setSource(v as Source)}
            options={[
              { value: "bundled", label: "bundled (in engine export)" },
              { value: "remote", label: "remote (HTTPS)" },
            ]}
          />
          <Toggle
            label="Strip top-level folder name from paths"
            checked={stripTopLevel}
            onChange={setStripTopLevel}
            help="On by default — avoids prefixes like res://assets/faces/faces/…"
          />
          {source === "bundled" ? (
            <div className="md:col-span-2">
              <TextField
                label="res:// prefix"
                value={pathPrefix}
                onChange={setPathPrefix}
                help="Final path = prefix + (relative folder path). Must start with res://"
                error={pathPrefix.startsWith("res://") ? undefined : "Expected res:// prefix"}
              />
            </div>
          ) : (
            <div className="md:col-span-2">
              <TextField
                label="URL prefix"
                value={urlPrefix}
                onChange={setUrlPrefix}
                help="Final URL = prefix + (relative folder path). Host is auto-added to allowed_hosts on apply."
                error={urlLooksValid ? undefined : "Expected https:// URL ending with /"}
              />
            </div>
          )}
        </div>

        {remotePending && hashProgress && (
          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-800">
            Computing SHA-256 — {hashProgress.done} / {hashProgress.total}...
          </div>
        )}
        {hashError && (
          <div role="alert" className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-800">
            {hashError}
          </div>
        )}
        {collisionCount > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
            {collisionCount} id{collisionCount === 1 ? "" : "s"} collided with existing images and were auto-suffixed (_2, _3, …).
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex-1 overflow-auto rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold">id</th>
                  <th className="px-2 py-1 text-left font-semibold">{source === "bundled" ? "path" : "url"}</th>
                  {source === "remote" && <th className="px-2 py-1 text-left font-semibold">sha256</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className={r.collision ? "bg-amber-50" : undefined}>
                    <td className="px-2 py-1 font-mono">{r.id}</td>
                    <td className="break-all px-2 py-1 font-mono text-slate-600">{r.finalPath}</td>
                    {source === "remote" && (
                      <td className="px-2 py-1 font-mono text-slate-500">
                        {r.sha256 ? `${r.sha256.slice(0, 12)}…` : "…"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {rows.length > 0
              ? `Apply (${rows.length} image${rows.length === 1 ? "" : "s"} → pool)`
              : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function stripFirstSegment(path: string): string {
  const slash = path.indexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

function isValidHttpsPrefix(v: string): boolean {
  if (!v.startsWith("https://")) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}
