// Frame-rate quantization helpers for ms fields.
//
// The engine re-quantizes every authored _ms value to an integer frame count
// at runtime (FrameClock.ms_to_frames, per participant display refresh rate).
// The builder's job at authoring time is to keep inputs aligned with a sane
// reference rate so authors build an accurate mental model of what the
// engine will actually present.
//
// Reference: 60 Hz — the lowest-common-denominator consumer-display rate.
// A 60 Hz display is the baseline: every authored value represents a whole
// number of 60 Hz frames. On 120 Hz / 144 Hz / 75 Hz displays the engine
// re-quantizes independently; the authored value stays the reference.

export const REFERENCE_HZ = 60;
export const FRAME_PERIOD_MS = 1000 / REFERENCE_HZ; // ≈ 16.666...

// Integer frame count at the reference rate, for a given ms duration.
export function msToFrameCount(ms: number): number {
  return Math.round(ms * REFERENCE_HZ / 1000);
}

// Snap an ms duration to the nearest reference-rate frame boundary. Result
// is rounded to 2 decimals so the JSON carries 16.67 / 33.33 / 50 / 66.67 /
// 83.33 / 100 / ... instead of floating-point noise. The engine's runtime
// quantization tolerates ±0.5 frame, so 16.67 still maps to exactly 1 frame.
export function snapMsToFrame(ms: number): number {
  const frames = msToFrameCount(ms);
  const snapped = (frames * 1000) / REFERENCE_HZ;
  return Math.round(snapped * 100) / 100;
}

// True when `ms` is already within ~0.01 ms of a reference-rate frame
// boundary. Useful for UI hints that distinguish "=" (exact) from "≈"
// (rounded). The tolerance is tight because `snapMsToFrame` itself rounds to
// 2 decimals, so aligned values round-trip exactly.
export function isFrameAligned(ms: number, toleranceMs = 0.01): boolean {
  return Math.abs(snapMsToFrame(ms) - ms) < toleranceMs;
}
