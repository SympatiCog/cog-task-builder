import type { AudioAsset, ImageAsset, Pool, TaskJson } from "../types/task";
import {
  renameAudio as renameAudioCascade,
  renameImage as renameImageCascade,
  renamePool as renamePoolCascade,
} from "./cascades";

// Sentinel default used when adding a fresh image/audio entry. Authors pick
// a source + finish the required fields; the bundled/remote branches diverge
// from there.
const DEFAULT_IMAGE: ImageAsset = { source: "bundled", path: "res://" };
const DEFAULT_AUDIO: AudioAsset = { source: "bundled", path: "res://" };

export function setAllowedHosts(task: TaskJson, hosts: string[]): TaskJson {
  return { ...task, assets: { ...task.assets, allowed_hosts: hosts } };
}

// --- images ---

export function addImage(task: TaskJson, id: string): TaskJson {
  const images = task.assets.images ?? {};
  if (id in images) return task;
  return {
    ...task,
    assets: { ...task.assets, images: { ...images, [id]: DEFAULT_IMAGE } },
  };
}

export function setImage(task: TaskJson, id: string, asset: ImageAsset): TaskJson {
  const images = task.assets.images ?? {};
  return {
    ...task,
    assets: { ...task.assets, images: { ...images, [id]: asset } },
  };
}

export function deleteImage(task: TaskJson, id: string): TaskJson {
  const images = task.assets.images ?? {};
  if (!(id in images)) return task;
  const next = { ...images };
  delete next[id];
  // Also drop the id from any pool members. References inside stimulus_types /
  // trial_template left intact — they'll surface as `asset_not_declared` via
  // the validator, which is the correct signal to the author.
  const nextPools = task.assets.pools
    ? Object.fromEntries(
        Object.entries(task.assets.pools).map(([name, pool]) => [
          name,
          { ...pool, members: pool.members.filter((m) => m !== id) },
        ]),
      )
    : task.assets.pools;
  return { ...task, assets: { ...task.assets, images: next, pools: nextPools } };
}

export function renameImage(task: TaskJson, oldId: string, newId: string): TaskJson {
  return renameImageCascade(task, oldId, newId);
}

// --- audio ---

export function addAudio(task: TaskJson, id: string): TaskJson {
  const audio = task.assets.audio ?? {};
  if (id in audio) return task;
  return {
    ...task,
    assets: { ...task.assets, audio: { ...audio, [id]: DEFAULT_AUDIO } },
  };
}

export function setAudio(task: TaskJson, id: string, asset: AudioAsset): TaskJson {
  const audio = task.assets.audio ?? {};
  return { ...task, assets: { ...task.assets, audio: { ...audio, [id]: asset } } };
}

export function deleteAudio(task: TaskJson, id: string): TaskJson {
  const audio = task.assets.audio ?? {};
  if (!(id in audio)) return task;
  const next = { ...audio };
  delete next[id];
  return { ...task, assets: { ...task.assets, audio: next } };
}

export function renameAudio(task: TaskJson, oldId: string, newId: string): TaskJson {
  return renameAudioCascade(task, oldId, newId);
}

// --- pools ---

export function addPool(task: TaskJson, name: string): TaskJson {
  const pools = task.assets.pools ?? {};
  if (name in pools) return task;
  const nextPools = { ...pools, [name]: { kind: "image" as const, members: [] } };
  // Using pools implies schema 1.1+. Bump the task's declared version if it's
  // older, so exports don't claim a lower schema than their contents require.
  const nextSchema = task.schema_version === "1.0.0" ? "1.1.0" : task.schema_version;
  return {
    ...task,
    schema_version: nextSchema,
    assets: { ...task.assets, pools: nextPools },
  };
}

export function setPool(task: TaskJson, name: string, pool: Pool): TaskJson {
  const pools = task.assets.pools ?? {};
  return { ...task, assets: { ...task.assets, pools: { ...pools, [name]: pool } } };
}

export function deletePool(task: TaskJson, name: string): TaskJson {
  const pools = task.assets.pools ?? {};
  if (!(name in pools)) return task;
  const next = { ...pools };
  delete next[name];
  return { ...task, assets: { ...task.assets, pools: next } };
}

export function renamePool(task: TaskJson, oldName: string, newName: string): TaskJson {
  return renamePoolCascade(task, oldName, newName);
}
