import type { PlaybackLoop } from "../playback";

export const MINIMUM_LOOP_SEPARATION_SECONDS = 0.5;

export function formatTime(value: number) {
  const time = Number.isFinite(value) && value >= 0 ? value : 0;
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export function positionFromClientX(
  clientX: number,
  left: number,
  width: number,
  duration: number,
) {
  if (width <= 0 || duration <= 0) return 0;
  const progress = Math.min(1, Math.max(0, (clientX - left) / width));
  return progress * duration;
}

export function setLoopA(loop: PlaybackLoop, position: number): PlaybackLoop {
  return {
    a: position,
    b: loop.b !== null && loop.b <= position ? null : loop.b,
  };
}

export function setLoopB(loop: PlaybackLoop, position: number): PlaybackLoop {
  if (loop.a !== null && position <= loop.a) {
    return { a: position, b: loop.a };
  }
  return { a: loop.a, b: position };
}

export function dragLoopMarker(
  marker: "a" | "b",
  loop: PlaybackLoop,
  position: number,
  duration: number,
): PlaybackLoop {
  if (marker === "a") {
    return {
      a: Math.min(
        position,
        loop.b !== null ? loop.b - MINIMUM_LOOP_SEPARATION_SECONDS : duration,
      ),
      b: loop.b,
    };
  }
  return {
    a: loop.a,
    b: Math.max(
      position,
      loop.a !== null ? loop.a + MINIMUM_LOOP_SEPARATION_SECONDS : 0,
    ),
  };
}
