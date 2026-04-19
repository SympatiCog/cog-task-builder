import type { TrialItem } from "../../types/task";

// Read-only horizontal visualization of the trial timeline. Each item is a
// bar; x = resolved onset (anchor chain folded), width = duration_ms. Items
// without a computable onset (e.g., anchoring on .response which is runtime-
// determined) render at their anchor's position with a `?` suffix.

const BAR_HEIGHT = 22;
const ROW_GAP = 6;
const PAD = 24;
const MAX_WIDTH = 760;

interface Resolved {
  id: string;
  kind: string;
  onset: number;      // may be NaN when anchored on .response (undecidable offline)
  duration: number;
  anchorLabel?: string;
}

function resolveTimeline(items: TrialItem[]): Resolved[] {
  // Depth-first resolve of anchor chains. Missing / cyclic targets yield NaN.
  const byId = new Map<string, number>();
  items.forEach((it, i) => { if (it.id) byId.set(it.id, i); });

  const memo = new Map<number, number>();
  const inflight = new Set<number>();

  function resolve(i: number): number {
    if (memo.has(i)) return memo.get(i)!;
    if (inflight.has(i)) return Number.NaN;
    inflight.add(i);
    const it = items[i];
    const onset = it.onset_ms ?? 0;
    let base = 0;
    if (typeof it.anchor === "string") {
      if (it.anchor === "trial_start") base = 0;
      else {
        const dot = it.anchor.lastIndexOf(".");
        if (dot > 0) {
          const target = it.anchor.slice(0, dot);
          const axis = it.anchor.slice(dot + 1);
          const tgtIdx = byId.get(target);
          if (tgtIdx === undefined) base = Number.NaN;
          else if (axis === "response") base = Number.NaN; // runtime only
          else {
            const tgt = items[tgtIdx];
            const tgtOnset = resolve(tgtIdx);
            base = axis === "end" ? tgtOnset + (tgt.duration_ms ?? 0) : tgtOnset;
          }
        }
      }
    }
    const result = base + onset;
    inflight.delete(i);
    memo.set(i, result);
    return result;
  }

  return items.map((it, i) => ({
    id: it.id || `item_${i}`,
    kind: it.kind,
    onset: resolve(i),
    duration: it.duration_ms ?? 0,
    anchorLabel: typeof it.anchor === "string" ? it.anchor : undefined,
  }));
}

const KIND_COLORS: Record<string, string> = {
  text: "#64748b",
  image: "#3b82f6",
  audio: "#a855f7",
  feedback: "#22c55e",
  blank: "#cbd5e1",
};

export function TimelineView({ items }: { items: TrialItem[] }) {
  const resolved = resolveTimeline(items);
  const solid = resolved.filter((r) => Number.isFinite(r.onset));
  const maxTime = Math.max(100, ...solid.map((r) => r.onset + Math.max(r.duration, 100)));
  const scale = (MAX_WIDTH - 2 * PAD) / maxTime;

  const height = items.length * (BAR_HEIGHT + ROW_GAP) + 40;

  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Timeline preview</span>
        <span>{maxTime.toFixed(0)} ms</span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${MAX_WIDTH} ${height}`}
        role="img"
        aria-label="Trial-template timeline preview"
        preserveAspectRatio="none"
      >
        {/* X axis */}
        <line x1={PAD} y1={height - 16} x2={MAX_WIDTH - PAD} y2={height - 16} stroke="#cbd5e1" />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const x = PAD + (MAX_WIDTH - 2 * PAD) * f;
          const t = maxTime * f;
          return (
            <g key={f}>
              <line x1={x} y1={height - 20} x2={x} y2={height - 12} stroke="#94a3b8" />
              <text x={x} y={height - 2} fontSize="10" fill="#64748b" textAnchor="middle">
                {Math.round(t)}ms
              </text>
            </g>
          );
        })}
        {resolved.map((r, i) => {
          const y = 4 + i * (BAR_HEIGHT + ROW_GAP);
          const unknownX = !Number.isFinite(r.onset);
          const x = unknownX ? PAD : PAD + r.onset * scale;
          const w = Math.max(4, (r.duration || 40) * scale);
          const color = KIND_COLORS[r.kind] ?? "#64748b";
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={BAR_HEIGHT}
                fill={color}
                opacity={unknownX ? 0.4 : 0.85}
                rx={3}
              />
              <text
                x={x + 6}
                y={y + BAR_HEIGHT - 6}
                fontSize="11"
                fill="#fff"
                style={{ pointerEvents: "none" }}
              >
                {r.id}
                {unknownX ? " (?)" : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
