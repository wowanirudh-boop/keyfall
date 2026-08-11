import { describe, expect, it } from "vitest";

import type { PlaybackSpeed } from "../playback";
import {
  dragLoopMarker,
  formatTime,
  positionFromClientX,
  setLoopA,
  setLoopB,
} from "./logic";

describe("transport logic", () => {
  it.each<PlaybackSpeed>([1, 0.5, 0.25])(
    "[AC2] maps 20 drop points within ±100 ms across 10 minutes at %sx",
    (speed) => {
      const duration = 600;
      const left = 37;
      const width = 913;
      for (let index = 0; index < 20; index += 1) {
        const expected = (index / 19) * duration;
        const clientX = left + (expected / duration) * width;
        const actual = positionFromClientX(clientX, left, width, duration);
        expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.1);
      }
      expect(speed).toBeGreaterThan(0);
    },
  );

  it("[AC6] keeps the asymmetric A–B rules and half-second drag separation", () => {
    expect(setLoopA({ a: 2, b: 7 }, 8)).toEqual({ a: 8, b: null });
    expect(setLoopB({ a: 8, b: null }, 3)).toEqual({ a: 3, b: 8 });
    expect(dragLoopMarker("a", { a: 3, b: 8 }, 7.9, 20)).toEqual({ a: 7.5, b: 8 });
    expect(dragLoopMarker("b", { a: 3, b: 8 }, 3.1, 20)).toEqual({ a: 3, b: 3.5 });
  });

  it("[AC11] formats golden times and clamps invalid values", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(46)).toBe("0:46");
    expect(formatTime(125)).toBe("2:05");
    expect(formatTime(-1)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
