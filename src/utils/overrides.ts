import type { StimulusTypes, TrialItem } from "../types/task";

// For a single trial-template item, return a map from "field key" to the list
// of stimulus_types that override that field. Extras are expanded one level
// so a type setting `{ extras: { style: "fix" } }` shows up under
// "extras.style" — that precision lets the UI drop the hint right next to
// the specific form field rather than on the whole item.
export function computeOverridesByField(
  item: TrialItem,
  types: StimulusTypes,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [typeId, type] of Object.entries(types)) {
    const override = type?.items?.[item.id];
    if (!override) continue;
    for (const [field, value] of Object.entries(override)) {
      if (field === "extras" && value && typeof value === "object" && !Array.isArray(value)) {
        for (const extraField of Object.keys(value as Record<string, unknown>)) {
          const key = `extras.${extraField}`;
          (out[key] ||= []).push(typeId);
        }
      } else if (field === "cases" && value && typeof value === "object" && !Array.isArray(value)) {
        for (const outcome of Object.keys(value as Record<string, unknown>)) {
          const key = `cases.${outcome}`;
          (out[key] ||= []).push(typeId);
        }
      } else {
        (out[field] ||= []).push(typeId);
      }
    }
  }
  return out;
}

// Also return a flat, dedupe'd list of all types overriding *anything* on
// the item — used for the item-level summary hint.
export function typesOverridingItem(
  item: TrialItem,
  types: StimulusTypes,
): string[] {
  const out = new Set<string>();
  for (const [typeId, type] of Object.entries(types)) {
    if (type?.items?.[item.id]) out.add(typeId);
  }
  return [...out];
}
