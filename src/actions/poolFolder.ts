import type { TaskJson, ImageAsset } from "../types/task";

export interface PreparedEntry {
  id: string;              // final id after slugification + collision resolution
  originalName: string;    // original filename (informational)
  relativePath: string;    // File.webkitRelativePath or file.name
  asset: ImageAsset;       // fully-formed asset to register
}

// Collision resolution (slugify + deduplicate ids) is the preparer's
// responsibility — this action trusts entries and will overwrite an
// existing image if a caller passes an id that already exists.
export function applyFolderToPool(
  task: TaskJson,
  poolName: string,
  entries: PreparedEntry[],
): TaskJson {
  if (entries.length === 0) return task;
  const pool = task.assets.pools?.[poolName];
  if (!pool) return task;

  const nextImages = { ...(task.assets.images ?? {}) };
  for (const e of entries) {
    nextImages[e.id] = e.asset;
  }

  const existingMembers = new Set(pool.members);
  const nextMembers = [...pool.members];
  for (const e of entries) {
    if (!existingMembers.has(e.id)) {
      nextMembers.push(e.id);
      existingMembers.add(e.id);
    }
  }

  const remoteHosts = new Set<string>();
  for (const e of entries) {
    if (e.asset.source !== "remote") continue;
    try {
      remoteHosts.add(new URL(e.asset.url).host);
    } catch {
      // non-URL prefix — the validator will flag the url field itself
    }
  }
  const existingHosts = new Set(task.assets.allowed_hosts ?? []);
  const mergedHosts = [...(task.assets.allowed_hosts ?? [])];
  for (const h of remoteHosts) {
    if (!existingHosts.has(h)) {
      mergedHosts.push(h);
      existingHosts.add(h);
    }
  }

  return {
    ...task,
    schema_version: task.schema_version === "1.0.0" ? "1.1.0" : task.schema_version,
    assets: {
      ...task.assets,
      images: nextImages,
      pools: {
        ...(task.assets.pools ?? {}),
        [poolName]: { ...pool, members: nextMembers },
      },
      ...(mergedHosts.length > 0 ? { allowed_hosts: mergedHosts } : {}),
    },
  };
}
