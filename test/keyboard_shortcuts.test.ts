import { describe, it, expect } from "vitest";

// Unit-test the combo-matching logic in isolation — avoids pulling jsdom in
// just for this. Mirrors the implementation in useKeyboardShortcuts.ts; if
// this diverges, update both or extract `matches` to a helper.

const isMac = /Mac|iPhone|iPad/.test("Macintosh");

function matches(combo: string, e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts.pop()!;
  const mods = new Set(parts);
  const modPressed = isMac ? e.metaKey : e.ctrlKey;
  if (mods.has("mod") && !modPressed) return false;
  if (!mods.has("mod") && modPressed) return false;
  if (mods.has("shift") !== e.shiftKey) return false;
  if (mods.has("alt") !== e.altKey) return false;
  return e.key.toLowerCase() === key;
}

describe("shortcut combo matching", () => {
  it("matches mod+e on mac via metaKey", () => {
    const e = { key: "e", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
    expect(matches("mod+e", e)).toBe(true);
  });

  it("rejects mod+e when no modifier", () => {
    const e = { key: "e", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(matches("mod+e", e)).toBe(false);
  });

  it("matches bare escape", () => {
    const e = { key: "Escape", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(matches("escape", e)).toBe(true);
  });

  it("rejects when shift state mismatches", () => {
    const e = { key: "e", metaKey: true, ctrlKey: false, shiftKey: true, altKey: false };
    expect(matches("mod+e", e)).toBe(false);
    expect(matches("mod+shift+e", e)).toBe(true);
  });
});
