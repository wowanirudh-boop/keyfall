import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";

import { color, shadow, tunables, waterfall } from "../design/tokens";
import type { NoteEvent } from "../music/types";
import type { PlaybackSpeed } from "../playback";
import { KEY_GEOMETRY_BY_MIDI } from "./keyboardGeometry";

const WINDOW_MARGIN_SECONDS = 2;
const WINDOW_REBUILD_THRESHOLD_SECONDS = 1;

export function visibleNotesAt(notes: readonly NoteEvent[], position: number) {
  const windowStart = position - WINDOW_MARGIN_SECONDS;
  const windowEnd = position + tunables.lookaheadSeconds + WINDOW_MARGIN_SECONDS;
  return notes.filter((note) => note.end >= windowStart && note.start <= windowEnd);
}

export function lookaheadLabel(speed: PlaybackSpeed) {
  return `${tunables.lookaheadSeconds}S MUSICAL LOOKAHEAD · ${(tunables.lookaheadSeconds / speed).toFixed(1)}S AT ${speed}x`;
}

export interface MidiConnectionBadgeProps {
  deviceName: string;
}

export function MidiConnectionBadge({ deviceName }: MidiConnectionBadgeProps) {
  return (
    <div className="absolute right-[20px] top-[14px] z-[3] flex items-center gap-[9px] rounded-pill border border-listening-border bg-listening-bg px-[12px] py-[7px] font-mono text-mono-meta text-listening-text">
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-[50%] bg-listening" />
      LISTENING · {deviceName.toUpperCase()}
    </div>
  );
}

interface WaterfallNoteProps {
  note: NoteEvent;
  pixelsPerSecond: number;
  hasHandData: boolean;
}

const WaterfallNote = memo(function WaterfallNote({
  note,
  pixelsPerSecond,
  hasHandData,
}: WaterfallNoteProps) {
  const geometry = KEY_GEOMETRY_BY_MIDI.get(note.midi);
  if (!geometry) return null;
  const hand = hasHandData && note.hand === "left" ? "left" : "right";
  const handColor = hand === "left" ? color.handLeft : color.handRight;

  return (
    <div
      data-note-id={note.id}
      data-hand={hand}
      className="absolute rounded-note"
      style={{
        left: `${geometry.left}%`,
        width: `${geometry.width * waterfall.noteWidthRatio}%`,
        marginLeft: `${geometry.width * waterfall.noteMarginLeftRatio}%`,
        bottom: `${note.start * pixelsPerSecond}px`,
        height: `${Math.max(
          waterfall.minNoteHeightPx,
          (note.end - note.start) * pixelsPerSecond,
        )}px`,
        background: handColor,
        boxShadow: shadow.note(handColor),
      }}
    />
  );
});

export interface WaterfallStageProps {
  notes: readonly NoteEvent[];
  position: number;
  speed: PlaybackSpeed;
  hasHandData: boolean;
  listeningDevice?: string | null;
  onMeasure?: (pixelsPerSecond: number) => void;
}

export function WaterfallStage({
  notes,
  position,
  speed,
  hasHandData,
  listeningDevice,
  onMeasure,
}: WaterfallStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const windowAnchor = Math.floor(position / WINDOW_REBUILD_THRESHOLD_SECONDS);
  const windowNotes = useMemo(
    () => visibleNotesAt(notes, windowAnchor * WINDOW_REBUILD_THRESHOLD_SECONDS),
    [notes, windowAnchor],
  );
  const pixelsPerSecond = height / tunables.lookaheadSeconds;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = (nextHeight: number) => {
      if (nextHeight > 0) setHeight(nextHeight);
    };
    measure(stage.clientHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      measure(entries[0]?.contentRect.height ?? stage.clientHeight);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    onMeasure?.(pixelsPerSecond);
  }, [onMeasure, pixelsPerSecond]);

  const layerStyle = useMemo(
    () => ({ transform: `translateY(${position * pixelsPerSecond}px)` }),
    [pixelsPerSecond, position],
  );

  return (
    <div
      ref={stageRef}
      data-testid="waterfall-stage"
      data-pixels-per-second={pixelsPerSecond}
      className="relative min-h-0 flex-1 overflow-hidden bg-stage"
      style={{
        backgroundImage: `linear-gradient(180deg, ${color.stage} 0%, ${color.stageGradientEnd} 100%)`,
      }}
    >
      <div
        data-testid="waterfall-layer"
        data-window-revision={windowAnchor}
        className="absolute bottom-0 left-0 right-0 h-full will-change-transform"
        style={layerStyle}
      >
        {windowNotes.map((note) => (
          <WaterfallNote
            key={note.id}
            note={note}
            pixelsPerSecond={pixelsPerSecond}
            hasHandData={hasHandData}
          />
        ))}
      </div>
      <div
        data-testid="strike-line"
        className="absolute bottom-0 left-0 right-0 z-[2] h-px bg-strike-line"
      />
      <div className="absolute left-[22px] top-[16px] z-[3] font-mono text-mono-label tracking-[0.1em] text-mono-dim-3">
        {lookaheadLabel(speed)}
      </div>
      {listeningDevice ? <MidiConnectionBadge deviceName={listeningDevice} /> : null}
    </div>
  );
}
