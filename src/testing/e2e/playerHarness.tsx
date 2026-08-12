import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import "../../design/globals.css";
import type { NoteEvent, PieceDocument } from "../../music/types";
import type { PlaybackLoop, PlaybackSnapshot, PlaybackSpeed } from "../../playback";
import {
  PlayerView,
  readAudioPreferences,
  writeMutedPreference,
  writeVolumePreference,
  type LiveVerdict,
} from "../../player";
import { createDenseFixture } from "../denseFixture";

declare global {
  interface Window {
    __playerMetrics?: {
      done: boolean;
      elapsedSeconds: number;
      fps: number;
      frameCount: number;
      framesOver32Ms: number;
      longestFrameIntervalMs: number;
      noteCount: number;
    };
    __scrubMetrics?: {
      done: boolean;
      elapsedSeconds: number;
      frameCount: number;
      framesOver32Ms: number;
      longestFrameIntervalMs: number;
      noteCount: number;
    };
    __startScrubMeasurement?: () => void;
  }
}

const parameters = new URLSearchParams(window.location.search);
const mode = parameters.get("mode") ?? "visual";
const dense = mode === "dense" || mode === "scrub";
const runMilliseconds = Number(parameters.get("runMs") ?? 60_000);
const startPosition = Number(parameters.get("position") ?? (dense ? 900 : 4));
const initialSpeed: PlaybackSpeed =
  parameters.get("speed") === "0.25"
    ? 0.25
    : parameters.get("speed") === "0.5"
      ? 0.5
      : 1;
const initialLoop: PlaybackLoop =
  parameters.get("loop") === "active"
    ? { a: 7, b: 15 }
    : parameters.get("loop") === "a"
      ? { a: 7, b: null }
      : { a: null, b: null };

const visualNotes: NoteEvent[] = [
  { id: "visual-left", midi: 48, start: 3.5, end: 4.5, velocity: 100, hand: "left" },
  { id: "visual-right", midi: 60, start: 4, end: 5, velocity: 100, hand: "right" },
  { id: "visual-error", midi: 64, start: 4, end: 4.75, velocity: 100, hand: "right" },
  { id: "visual-black", midi: 66, start: 4, end: 5, velocity: 100, hand: "right" },
  { id: "visual-upcoming", midi: 67, start: 6, end: 6.75, velocity: 100, hand: "right" },
  { id: "visual-upcoming-left", midi: 61, start: 6, end: 6.75, velocity: 100, hand: "left" },
  { id: "visual-run-1", midi: 57, start: 7, end: 7.4, velocity: 100, hand: "left" },
  { id: "visual-run-2", midi: 60, start: 7.2, end: 7.6, velocity: 100, hand: "right" },
  { id: "visual-run-3", midi: 64, start: 7.4, end: 7.8, velocity: 100, hand: "right" },
  { id: "visual-run-4", midi: 69, start: 7.6, end: 8, velocity: 100, hand: "right" },
  { id: "visual-run-5", midi: 71, start: 7.8, end: 8.2, velocity: 100, hand: "right" },
];

const visualPiece: PieceDocument = {
  id: "visual-player",
  title: "Prelude in C major",
  composer: "J. S. Bach",
  source: "musicxml-upload",
  duration: 120,
  notes: visualNotes,
  hasHandData: parameters.get("hand") !== "none",
  notices:
    parameters.get("notices") === "dropped"
      ? [
          { kind: "dropped-notes", message: "4 notes fell outside the 88-key range and were dropped — this file may not be a piano arrangement." } as const,
        ]
      : parameters.get("notices") === "all"
      ? [
          { kind: "dropped-notes", message: "4 notes fell outside the 88-key range and were dropped — this file may not be a piano arrangement." },
          { kind: "structural-fallback", message: "Repeats could not be resolved, so this score plays in written order." },
          { kind: "ornament-handling", message: "Ornaments use their principal written notes; grace notes play as short written notes." },
        ]
      : [],
};

function Harness() {
  const piece = dense
    ? createDenseFixture()
    : { ...visualPiece, id: parameters.get("piece") ?? visualPiece.id };
  const audioPreferences = readAudioPreferences();
  const [position, setPosition] = useState(startPosition);
  const [playing, setPlaying] = useState(mode === "dense" || parameters.get("playing") === "1");
  const [speed, setSpeed] = useState(initialSpeed);
  const [loop, setLoop] = useState(initialLoop);
  const [muted, setMuted] = useState(
    parameters.has("muted") ? parameters.get("muted") === "1" : audioPreferences.muted,
  );
  const [volume, setVolume] = useState(
    parameters.has("volume")
      ? Math.min(1, Math.max(0, Number(parameters.get("volume")) / 100))
      : audioPreferences.volume,
  );
  const commitCount = useRef(0);
  const listeningDevice = parameters.get("listening") === "1" ? "Roland RP302" : null;
  const verdicts = new Map<string, LiveVerdict>();
  if (parameters.get("error") === "1") {
    verdicts.set("visual-error", { kind: "wrong", publishedAt: 3.9 });
  }

  useLayoutEffect(() => {
    commitCount.current += 1;
  }, [position]);

  useEffect(() => {
    if (mode !== "dense") return;
    const startedAt = performance.now();
    let previousFrameAt = startedAt;
    let frameCount = 0;
    let framesOver32Ms = 0;
    let longestFrameIntervalMs = 0;
    let frameId = 0;
    const frame = (now: number) => {
      const elapsed = now - startedAt;
      const interval = now - previousFrameAt;
      previousFrameAt = now;
      frameCount += 1;
      if (interval > 32) framesOver32Ms += 1;
      longestFrameIntervalMs = Math.max(longestFrameIntervalMs, interval);
      setPosition(startPosition + elapsed / 1000);
      if (elapsed < runMilliseconds) {
        frameId = requestAnimationFrame(frame);
        return;
      }
      const elapsedSeconds = elapsed / 1000;
      window.__playerMetrics = {
        done: true,
        elapsedSeconds,
        fps: (commitCount.current - 1) / elapsedSeconds,
        frameCount,
        framesOver32Ms,
        longestFrameIntervalMs,
        noteCount: document.querySelectorAll("[data-note-id]").length,
      };
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (mode !== "scrub") return;
    let frameId = 0;
    window.__scrubMetrics = {
      done: false,
      elapsedSeconds: 0,
      frameCount: 0,
      framesOver32Ms: 0,
      longestFrameIntervalMs: 0,
      noteCount: 0,
    };
    window.__startScrubMeasurement = () => {
      const startedAt = performance.now();
      let previousFrameAt = startedAt;
      let frameCount = 0;
      let framesOver32Ms = 0;
      let longestFrameIntervalMs = 0;
      const frame = (now: number) => {
        const interval = now - previousFrameAt;
        previousFrameAt = now;
        frameCount += 1;
        if (interval > 32) framesOver32Ms += 1;
        longestFrameIntervalMs = Math.max(longestFrameIntervalMs, interval);
        const elapsedSeconds = (now - startedAt) / 1000;
        if (elapsedSeconds < 10) {
          frameId = requestAnimationFrame(frame);
          return;
        }
        window.__scrubMetrics = {
          done: true,
          elapsedSeconds,
          frameCount,
          framesOver32Ms,
          longestFrameIntervalMs,
          noteCount: document.querySelectorAll("[data-note-id]").length,
        };
      };
      frameId = requestAnimationFrame(frame);
    };
    return () => {
      cancelAnimationFrame(frameId);
      delete window.__startScrubMeasurement;
    };
  }, []);

  const playback: PlaybackSnapshot = {
    position,
    duration: piece.duration,
    playing,
    speed,
    loop,
    muted,
    volume,
  };

  return (
    <PlayerView
      piece={piece}
      playback={playback}
      onLibrary={() => undefined}
      onMutedChange={(nextMuted) => {
        writeMutedPreference(nextMuted);
        setMuted(nextMuted);
      }}
      onVolumeChange={(nextVolume) => {
        writeVolumePreference(nextVolume);
        setVolume(nextVolume);
      }}
      onTogglePlay={() => setPlaying((current) => !current)}
      onSeek={setPosition}
      onSpeedChange={setSpeed}
      onLoopChange={(a, b) => setLoop({ a, b })}
      listeningDevice={listeningDevice}
      transientNotice={
        parameters.get("transient") === "1"
          ? "A–B loop is off while listen mode runs. Stop listening to drill a section."
          : null
      }
      liveVerdicts={verdicts}
    />
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
