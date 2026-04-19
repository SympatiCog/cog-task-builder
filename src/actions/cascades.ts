import type { TaskJson } from "../types/task";

// Rename cascades for cross-ref rules 1–8 (see builder-plan/01-scope.md §"The
// eight cross-reference rules"). Each helper returns a *new* TaskJson with the
// referenced name updated everywhere it appears. Callers are expected to also
// replace the key in the source collection (image id, pool name, style name,
// etc.); these helpers only walk *references* to that key.
//
// All helpers are structurally immutable — they produce a new object tree
// rather than mutating the input. This keeps store updates safe when React
// memoization depends on identity.

function mapRecord<T>(
  rec: Record<string, T> | undefined,
  fn: (v: T, k: string) => T,
): Record<string, T> | undefined {
  if (!rec) return rec;
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = fn(v, k);
  return out;
}

// Stimulus-type items carry `asset` and `extras.style` references that a
// rename might need to rewrite. Cases are under trial_template, not
// stimulus_types; handled separately.
function rewriteItemRefs(
  items: Record<string, unknown> | undefined,
  rewrite: (item: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> | undefined {
  return mapRecord(items, (v) => {
    if (!v || typeof v !== "object") return v;
    return rewrite(v as Record<string, unknown>);
  });
}

function rewriteAssetRef(asset: unknown, match: RegExp, replace: string): unknown {
  if (typeof asset !== "string") return asset;
  return match.test(asset) ? asset.replace(match, replace) : asset;
}

export function renameImage(task: TaskJson, oldId: string, newId: string): TaskJson {
  if (oldId === newId) return task;

  // Move the entry in assets.images itself (preserving key order). The caller
  // is expected to call only this function — it handles both the refs and the
  // source collection.
  const images = task.assets.images ?? {};
  if (!(oldId in images)) return task;
  if (newId in images) {
    throw new Error(`renameImage: target id "${newId}" already exists`);
  }
  const nextImages: typeof images = {};
  for (const [k, v] of Object.entries(images)) {
    nextImages[k === oldId ? newId : k] = v;
  }

  // Pool members
  const nextPools = mapRecord(task.assets.pools, (p) => ({
    ...p,
    members: p.members.map((m) => (m === oldId ? newId : m)),
  }));

  // Stimulus-type items.asset: `img:<oldId>`
  const imgRef = new RegExp(`^img:${escapeRe(oldId)}$`);
  const nextTypes = mapRecord(task.stimulus_types, (t) => ({
    ...t,
    items: rewriteItemRefs(t.items, (item) => ({
      ...item,
      asset: rewriteAssetRef(item.asset, imgRef, `img:${newId}`),
    })) as typeof t.items,
  }));

  // Trial-template items.asset and cases.<outcome>.asset
  const nextTemplate = task.trial_template.map((it) => {
    const out = { ...it };
    if (typeof out.asset === "string") {
      out.asset = rewriteAssetRef(out.asset, imgRef, `img:${newId}`) as string;
    }
    if (out.cases) {
      const cases = { ...out.cases };
      for (const outcome of ["correct", "incorrect", "timeout"] as const) {
        const c = cases[outcome];
        if (c && typeof c.asset === "string") {
          cases[outcome] = {
            ...c,
            asset: rewriteAssetRef(c.asset, imgRef, `img:${newId}`) as string,
          };
        }
      }
      out.cases = cases;
    }
    return out;
  });

  return {
    ...task,
    assets: { ...task.assets, images: nextImages, pools: nextPools },
    stimulus_types: nextTypes ?? {},
    trial_template: nextTemplate,
  };
}

export function renameAudio(task: TaskJson, oldId: string, newId: string): TaskJson {
  if (oldId === newId) return task;
  const audio = task.assets.audio ?? {};
  if (!(oldId in audio)) return task;
  if (newId in audio) {
    throw new Error(`renameAudio: target id "${newId}" already exists`);
  }
  const nextAudio: typeof audio = {};
  for (const [k, v] of Object.entries(audio)) {
    nextAudio[k === oldId ? newId : k] = v;
  }

  const audRef = new RegExp(`^aud:${escapeRe(oldId)}$`);
  const nextTypes = mapRecord(task.stimulus_types, (t) => ({
    ...t,
    items: rewriteItemRefs(t.items, (item) => ({
      ...item,
      asset: rewriteAssetRef(item.asset, audRef, `aud:${newId}`),
    })) as typeof t.items,
  }));

  const nextTemplate = task.trial_template.map((it) => ({
    ...it,
    asset: typeof it.asset === "string"
      ? (rewriteAssetRef(it.asset, audRef, `aud:${newId}`) as string)
      : it.asset,
  }));

  return {
    ...task,
    assets: { ...task.assets, audio: nextAudio },
    stimulus_types: nextTypes ?? {},
    trial_template: nextTemplate,
  };
}

export function renamePool(task: TaskJson, oldName: string, newName: string): TaskJson {
  if (oldName === newName) return task;
  const pools = task.assets.pools ?? {};
  if (!(oldName in pools)) return task;
  if (newName in pools) {
    throw new Error(`renamePool: target name "${newName}" already exists`);
  }
  const nextPools: typeof pools = {};
  for (const [k, v] of Object.entries(pools)) {
    nextPools[k === oldName ? newName : k] = v;
  }

  const poolRef = new RegExp(`^img:pool:${escapeRe(oldName)}$`);
  const nextTypes = mapRecord(task.stimulus_types, (t) => ({
    ...t,
    items: rewriteItemRefs(t.items, (item) => ({
      ...item,
      asset: rewriteAssetRef(item.asset, poolRef, `img:pool:${newName}`),
    })) as typeof t.items,
  }));

  const nextTemplate = task.trial_template.map((it) => ({
    ...it,
    asset: typeof it.asset === "string"
      ? (rewriteAssetRef(it.asset, poolRef, `img:pool:${newName}`) as string)
      : it.asset,
  }));

  return {
    ...task,
    assets: { ...task.assets, pools: nextPools },
    stimulus_types: nextTypes ?? {},
    trial_template: nextTemplate,
  };
}

export function renameTextStyle(task: TaskJson, oldName: string, newName: string): TaskJson {
  if (oldName === newName) return task;
  const styles = task.metadata.theme?.text_styles ?? {};
  if (!(oldName in styles)) return task;
  if (newName in styles) {
    throw new Error(`renameTextStyle: target name "${newName}" already exists`);
  }
  const nextStyles: typeof styles = {};
  for (const [k, v] of Object.entries(styles)) {
    nextStyles[k === oldName ? newName : k] = v;
  }

  // Rewrite extras.style in stimulus_types items, trial_template items, and
  // trial_template[*].cases[*].style.
  const nextTypes = mapRecord(task.stimulus_types, (t) => ({
    ...t,
    items: rewriteItemRefs(t.items, (item) => {
      const extras = item.extras as Record<string, unknown> | undefined;
      if (!extras || typeof extras.style !== "string" || extras.style !== oldName) return item;
      return { ...item, extras: { ...extras, style: newName } };
    }) as typeof t.items,
  }));

  const nextTemplate = task.trial_template.map((it) => {
    const out = { ...it };
    if (out.extras && typeof out.extras.style === "string" && out.extras.style === oldName) {
      out.extras = { ...out.extras, style: newName };
    }
    if (out.cases) {
      const cases = { ...out.cases };
      for (const outcome of ["correct", "incorrect", "timeout"] as const) {
        const c = cases[outcome];
        if (c && typeof c.style === "string" && c.style === oldName) {
          cases[outcome] = { ...c, style: newName };
        }
      }
      out.cases = cases;
    }
    return out;
  });

  return {
    ...task,
    metadata: {
      ...task.metadata,
      theme: { ...task.metadata.theme, text_styles: nextStyles },
    },
    stimulus_types: nextTypes ?? {},
    trial_template: nextTemplate,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Rename cascades introduced in Batch 3b: touchscreen buttons, response
// labels, stimulus types. Each shares the same immutable rewrite pattern as
// the asset/pool/style helpers above.

export function renameTouchscreenButton(
  task: TaskJson,
  oldId: string,
  newId: string,
): TaskJson {
  if (oldId === newId) return task;
  const buttons = task.inputs.touchscreen_buttons ?? [];
  if (!buttons.some((b) => b.id === oldId)) return task;
  if (buttons.some((b) => b.id === newId)) {
    throw new Error(`renameTouchscreenButton: target id "${newId}" already exists`);
  }
  const nextButtons = buttons.map((b) =>
    b.id === oldId ? { ...b, id: newId } : b,
  );
  const nextResponses = mapRecord(task.responses, (binding) => {
    if (!binding?.touchscreen) return binding;
    return {
      ...binding,
      touchscreen: binding.touchscreen.map((t) => (t === oldId ? newId : t)),
    };
  });
  return {
    ...task,
    inputs: { ...task.inputs, touchscreen_buttons: nextButtons },
    responses: nextResponses ?? {},
  };
}

export function renameResponse(
  task: TaskJson,
  oldLabel: string,
  newLabel: string,
): TaskJson {
  if (oldLabel === newLabel) return task;
  if (!(oldLabel in task.responses)) return task;
  if (newLabel in task.responses) {
    throw new Error(`renameResponse: target label "${newLabel}" already exists`);
  }
  const nextResponses: typeof task.responses = {};
  for (const [k, v] of Object.entries(task.responses)) {
    nextResponses[k === oldLabel ? newLabel : k] = v;
  }

  const nextTypes = mapRecord(task.stimulus_types, (t) => ({
    ...t,
    correct_response: t.correct_response === oldLabel ? newLabel : t.correct_response,
  }));

  return { ...task, responses: nextResponses, stimulus_types: nextTypes ?? {} };
}

export function renameStimulusType(
  task: TaskJson,
  oldId: string,
  newId: string,
): TaskJson {
  if (oldId === newId) return task;
  if (!(oldId in task.stimulus_types)) return task;
  if (newId in task.stimulus_types) {
    throw new Error(`renameStimulusType: target id "${newId}" already exists`);
  }
  const nextTypes: typeof task.stimulus_types = {};
  for (const [k, v] of Object.entries(task.stimulus_types)) {
    nextTypes[k === oldId ? newId : k] = v;
  }
  const nextBlocks = task.blocks.map((b) => ({
    ...b,
    types: b.types?.map((t) => (t === oldId ? newId : t)),
    trial_list: b.trial_list?.map((e) => ({
      ...e,
      type: e.type === oldId ? newId : e.type,
    })),
  }));
  return { ...task, stimulus_types: nextTypes, blocks: nextBlocks };
}
