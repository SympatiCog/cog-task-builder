import { describe, it, expect } from "vitest";
import {
  FRAME_PERIOD_MS,
  REFERENCE_HZ,
  isFrameAligned,
  msToFrameCount,
  snapMsToFrame,
} from "../src/utils/frameQuantize";

describe("frameQuantize", () => {
  it("constants match 60 Hz reference", () => {
    expect(REFERENCE_HZ).toBe(60);
    expect(FRAME_PERIOD_MS).toBeCloseTo(16.6666667, 5);
  });

  describe("msToFrameCount", () => {
    it("rounds to nearest integer frame", () => {
      expect(msToFrameCount(0)).toBe(0);
      expect(msToFrameCount(16.67)).toBe(1);
      expect(msToFrameCount(17)).toBe(1);
      expect(msToFrameCount(24.99)).toBe(1);
      expect(msToFrameCount(25)).toBe(2); // 25 * 60/1000 = 1.5 → round to 2
      expect(msToFrameCount(33.33)).toBe(2);
      expect(msToFrameCount(50)).toBe(3);
      expect(msToFrameCount(100)).toBe(6);
      expect(msToFrameCount(250)).toBe(15);
      expect(msToFrameCount(500)).toBe(30);
      expect(msToFrameCount(1000)).toBe(60);
    });

    it("handles negative durations symmetrically", () => {
      // Not a normal input but we don't want NaN or garbage for edge cases.
      expect(msToFrameCount(-16.67)).toBe(-1);
    });
  });

  describe("snapMsToFrame", () => {
    it("snaps to nearest frame boundary, 2-decimal precision", () => {
      expect(snapMsToFrame(0)).toBe(0);
      expect(snapMsToFrame(16.67)).toBe(16.67);
      expect(snapMsToFrame(17)).toBe(16.67);
      expect(snapMsToFrame(18)).toBe(16.67);
      expect(snapMsToFrame(33)).toBe(33.33);
      expect(snapMsToFrame(50)).toBe(50);
      expect(snapMsToFrame(99)).toBe(100);
      expect(snapMsToFrame(100)).toBe(100);
      expect(snapMsToFrame(101)).toBe(100);
      expect(snapMsToFrame(250)).toBe(250);
      expect(snapMsToFrame(1500)).toBe(1500);
    });

    it("snapped value re-quantizes exactly at the reference rate", () => {
      // This is the critical property: the engine's runtime quantization
      // (ms * refresh / 1000 → round to int) must round our snapped values
      // to the same frame count we started with.
      const cases = [16.67, 33.33, 50, 66.67, 83.33, 100, 116.67, 250, 500, 1000];
      for (const snapped of cases) {
        const frames = Math.round((snapped * 60) / 1000);
        expect(frames).toBe(msToFrameCount(snapped));
      }
    });
  });

  describe("isFrameAligned", () => {
    it("flags exact boundaries", () => {
      expect(isFrameAligned(0)).toBe(true);
      expect(isFrameAligned(16.67)).toBe(true);
      expect(isFrameAligned(33.33)).toBe(true);
      expect(isFrameAligned(50)).toBe(true);
      expect(isFrameAligned(100)).toBe(true);
      expect(isFrameAligned(1500)).toBe(true);
    });

    it("flags off-boundary values", () => {
      expect(isFrameAligned(17)).toBe(false);
      expect(isFrameAligned(20)).toBe(false);
      expect(isFrameAligned(99)).toBe(false);
    });
  });
});
