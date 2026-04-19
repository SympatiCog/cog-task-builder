import { useEffect } from "react";

export interface Shortcut {
  // Space-separated chord: "mod+s" (mod = Cmd on macOS, Ctrl elsewhere),
  // "mod+shift+e", "escape". Keys are lowercase.
  combo: string;
  handler: (e: KeyboardEvent) => void;
  description: string;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function matches(combo: string, e: KeyboardEvent): boolean {
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

// Register a global keydown handler for each shortcut. Handlers fire before
// the event bubbles to inputs; we opt out when the target is an editable
// element so typing 's' into a textbox doesn't trigger save-like actions.
export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        // Still allow mod-based shortcuts even inside inputs — mod+s shouldn't
        // trigger form submit or browser save dialog.
        const usesMod = shortcuts.some((s) => matches(s.combo, e) && s.combo.includes("mod"));
        if (!usesMod) return;
      }
      for (const s of shortcuts) {
        if (matches(s.combo, e)) {
          e.preventDefault();
          s.handler(e);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
}
