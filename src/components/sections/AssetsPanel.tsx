import { useMemo } from "react";
import { useTaskStore } from "../../store/taskStore";
import { KeyedList, Select, TextField, Toggle } from "../primitives";
import { SectionHeader } from "./SectionHeader";
import { useIssuesAt } from "../../validator/hooks";
import {
  addAudio,
  addImage,
  addPool,
  deleteAudio,
  deleteImage,
  deletePool,
  renameAudio,
  renameImage,
  renamePool,
  setAllowedHosts,
  setAudio,
  setImage,
  setPool,
} from "../../actions/assets";
import type { AudioAsset, ImageAsset } from "../../types/task";


export function AssetsPanel() {
  const task = useTaskStore((s) => s.task);
  const update = useTaskStore((s) => s.updateTask);
  if (!task) return null;
  const { images = {}, audio = {}, pools = {}, allowed_hosts = [] } = task.assets;

  const hasRemote = useMemo(() => {
    const check = (m: Record<string, { source?: string }>) =>
      Object.values(m).some((v) => v.source === "remote");
    return check(images) || check(audio);
  }, [images, audio]);

  const hostsNeeded = hasRemote && allowed_hosts.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        title="Assets"
        help="Images and audio (bundled in the engine build or fetched over HTTPS) and named pools for per-session sampling."
      />

      {/* Allowed hosts */}
      <div className="mb-6">
        <TextField
          label="Allowed hosts (one per line or comma-separated)"
          value={allowed_hosts.join(", ")}
          onChange={(v) => {
            const parsed = v
              .split(/[\n,]/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            update((t) => setAllowedHosts(t, parsed));
          }}
          help="Required if any asset has source: remote. Host match is exact (no wildcards, no subdomain collapsing)."
          error={hostsNeeded ? "Remote assets declared but allowed_hosts is empty." : undefined}
        />
      </div>

      {/* Images */}
      <div className="mb-8">
        <KeyedList
          label="Images"
          addLabel="+ Add image"
          entries={Object.entries(images)}
          onAdd={() => {
            const base = "img_";
            let i = 1;
            while (`${base}${i}` in images) i++;
            update((t) => addImage(t, `${base}${i}`));
          }}
          onRename={(oldId, newId) => {
            if (newId === oldId || newId.length === 0 || images[newId] !== undefined) return;
            update((t) => renameImage(t, oldId, newId));
          }}
          onDelete={(id) => update((t) => deleteImage(t, id))}
          renderRow={(id, asset) => (
            <>
              <IdValidity path={`assets.images.${id}`} />
              <AssetEditor
                asset={asset}
                onChange={(next) => update((t) => setImage(t, id, next as ImageAsset))}
                allowedHosts={allowed_hosts}
              />
            </>
          )}
        />
      </div>

      {/* Audio */}
      <div className="mb-8">
        <KeyedList
          label="Audio"
          addLabel="+ Add audio"
          entries={Object.entries(audio)}
          onAdd={() => {
            const base = "aud_";
            let i = 1;
            while (`${base}${i}` in audio) i++;
            update((t) => addAudio(t, `${base}${i}`));
          }}
          onRename={(oldId, newId) => {
            if (newId === oldId || newId.length === 0 || audio[newId] !== undefined) return;
            update((t) => renameAudio(t, oldId, newId));
          }}
          onDelete={(id) => update((t) => deleteAudio(t, id))}
          renderRow={(id, asset) => (
            <>
              <IdValidity path={`assets.audio.${id}`} />
              <AssetEditor
                asset={asset}
                onChange={(next) => update((t) => setAudio(t, id, next as AudioAsset))}
                allowedHosts={allowed_hosts}
              />
            </>
          )}
        />
      </div>

      {/* Pools */}
      <div>
        <KeyedList
          label="Image pools (per-session sampling)"
          addLabel="+ Add pool"
          entries={Object.entries(pools)}
          onAdd={() => {
            const base = "pool_";
            let i = 1;
            while (`${base}${i}` in pools) i++;
            update((t) => addPool(t, `${base}${i}`));
          }}
          onRename={(oldName, newName) => {
            if (newName === oldName || newName.length === 0 || pools[newName] !== undefined) return;
            update((t) => renamePool(t, oldName, newName));
          }}
          onDelete={(name) => update((t) => deletePool(t, name))}
          renderRow={(name, pool) => (
            <>
              <IdValidity path={`assets.pools.${name}`} />
              <div className="flex flex-col gap-3">
                <Toggle
                  label="Share queue across stimulus types"
                  checked={pool.share_across_types ?? false}
                  onChange={(v) =>
                    update((t) => setPool(t, name, { ...pool, share_across_types: v || undefined }))
                  }
                  help="If on, every stimulus type referencing this pool draws from one queue (no repeats across types within a block)."
                />
                <PoolMembersEditor
                  members={pool.members}
                  availableImages={Object.keys(images)}
                  onChange={(members) =>
                    update((t) => setPool(t, name, { ...pool, members }))
                  }
                />
              </div>
            </>
          )}
        />
      </div>
    </div>
  );
}

function IdValidity({ path }: { path: string }) {
  const issues = useIssuesAt(path);
  const invalid = issues.find((i) => i.code === "invalid_identifier");
  if (!invalid) return null;
  return (
    <p role="alert" className="mb-2 text-xs text-rose-600">{invalid.message}</p>
  );
}

interface AssetEditorProps {
  asset: ImageAsset | AudioAsset;
  onChange: (next: ImageAsset | AudioAsset) => void;
  allowedHosts: string[];
}

function AssetEditor({ asset, onChange, allowedHosts }: AssetEditorProps) {
  const SHA_PATTERN = /^[0-9a-f]{64}$/;
  const isRemote = asset.source === "remote";
  const urlHostOk =
    allowedHosts.length === 0 || !isRemote || !asset.url
      ? true
      : (() => {
          try {
            return allowedHosts.includes(new URL(asset.url).host);
          } catch {
            return true;
          }
        })();

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Select
        label="Source"
        value={asset.source}
        onChange={(v) => {
          if (v === "bundled") onChange({ source: "bundled", path: "res://" });
          else onChange({ source: "remote", url: "", sha256: "" });
        }}
        options={[
          { value: "bundled", label: "Bundled (in engine export)" },
          { value: "remote", label: "Remote (HTTPS)" },
        ]}
      />
      {asset.source === "bundled" ? (
        <TextField
          label="Path"
          value={asset.path}
          onChange={(v) => onChange({ source: "bundled", path: v })}
          help="Must start with res://"
          error={!asset.path.startsWith("res://") ? "Must start with res://" : undefined}
        />
      ) : (
        <>
          <TextField
            label="URL"
            value={asset.url}
            onChange={(v) => onChange({ ...asset, url: v })}
            help="Must be https:// and host must be in allowed_hosts"
            error={
              asset.url && !asset.url.startsWith("https://")
                ? "Must be an https:// URL"
                : !urlHostOk
                ? "Host not in allowed_hosts"
                : undefined
            }
          />
          <div className="md:col-span-2">
            <TextField
              label="SHA-256"
              value={asset.sha256}
              onChange={(v) => onChange({ ...asset, sha256: v.toLowerCase() })}
              help="Lowercase hex, 64 chars. See LLM_TASK_AUTHORING.md §4.1 for shell recipes to compute."
              error={
                asset.sha256 && !SHA_PATTERN.test(asset.sha256)
                  ? "Must be 64 lowercase hex chars"
                  : undefined
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

interface PoolMembersEditorProps {
  members: string[];
  availableImages: string[];
  onChange: (members: string[]) => void;
}

function PoolMembersEditor({ members, availableImages, onChange }: PoolMembersEditorProps) {
  const allSet = new Set(availableImages);
  const memberSet = new Set(members);
  const invalid = members.filter((m) => !allSet.has(m));
  const sorted = [...availableImages].sort();

  const toggle = (id: string) => {
    if (memberSet.has(id)) onChange(members.filter((m) => m !== id));
    else onChange([...members, id]);
  };

  return (
    <div>
      <h4 className="mb-1 text-sm font-medium text-slate-700">Members ({members.length})</h4>
      {availableImages.length === 0 ? (
        <p className="text-xs italic text-slate-500">No images declared yet.</p>
      ) : (
        <div className="max-h-48 overflow-auto rounded border border-slate-200 bg-white p-2">
          <ul className="grid grid-cols-2 gap-1 md:grid-cols-3">
            {sorted.map((id) => (
              <li key={id}>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={memberSet.has(id)}
                    onChange={() => toggle(id)}
                  />
                  <span className="font-mono">{id}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {invalid.length > 0 && (
        <p role="alert" className="mt-1 text-xs text-rose-600">
          Members not declared in assets.images: {invalid.join(", ")}
        </p>
      )}
    </div>
  );
}
