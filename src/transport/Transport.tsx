import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { alpha, color, shadow } from "../design/tokens";
import type { PlaybackLoop, PlaybackSnapshot, PlaybackSpeed } from "../playback";
import {
  dragLoopMarker,
  formatTime,
  positionFromClientX,
  setLoopA,
  setLoopB,
} from "./logic";

export interface PlayButtonProps {
  playing: boolean;
  onClick: () => void;
}

export function PlayButton({ playing, onClick }: PlayButtonProps) {
  return (
    <button
      type="button"
      aria-label={playing ? "Pause" : "Play"}
      className={`flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-[50%] border-0 ${
        playing
          ? "bg-control text-[13px] text-text"
          : "bg-hand-right text-[15px] text-on-accent"
      }`}
      onClick={onClick}
    >
      {playing ? "❙❙" : "▶"}
    </button>
  );
}

export function TimeReadout({ position, duration }: { position: number; duration: number }) {
  return (
    <div className="min-w-[96px] font-mono text-mono-time leading-[normal] tracking-[0.02em] text-text">
      {formatTime(position)} / {formatTime(duration)}
    </div>
  );
}

function percentage(value: number, duration: number) {
  if (duration <= 0) return 0;
  return Math.min(100, Math.max(0, (value / duration) * 100));
}

export function LoopRegion({ loop, duration }: { loop: PlaybackLoop; duration: number }) {
  if (loop.a === null || loop.b === null) return null;
  return (
    <div
      data-testid="loop-region"
      className="pointer-events-none absolute top-1/2 h-[16px] -translate-y-1/2 rounded-note"
      style={{
        left: `${percentage(loop.a, duration)}%`,
        width: `${percentage(loop.b - loop.a, duration)}%`,
        background: `${color.amber}${alpha.loopFill}`,
        border: `1px solid ${color.amber}${alpha.loopBorder}`,
      }}
    />
  );
}

export interface LoopMarkerProps {
  marker: "a" | "b";
  position: number;
  duration: number;
  dragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}

export function LoopMarker({
  marker,
  position,
  duration,
  dragging,
  onPointerDown,
}: LoopMarkerProps) {
  const label = marker.toUpperCase();
  return (
    <button
      type="button"
      aria-label={`Drag loop marker ${label}`}
      data-testid={`loop-marker-${marker}`}
      className={`absolute bottom-0 touch-none rounded-chip border-0 bg-amber px-[4px] py-px font-mono text-mono-tiny leading-[normal] text-bg ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ left: `${percentage(position, duration)}%`, transform: "translateX(-50%)" }}
      onPointerDown={onPointerDown}
    >
      {label}
    </button>
  );
}

export interface SeekBarProps {
  position: number;
  duration: number;
  loop: PlaybackLoop;
  onSeek: (position: number) => void;
  onLoopChange: (a: number | null, b: number | null) => void;
}

type ScrubTarget = "timeline" | "a" | "b";

export function SeekBar({
  position,
  duration,
  loop,
  onSeek,
  onLoopChange,
}: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<ScrubTarget | null>(null);
  const [scrub, setScrub] = useState<ScrubTarget | null>(null);

  const beginScrub = (target: ScrubTarget) => {
    scrubRef.current = target;
    setScrub(target);
  };
  const updateFromPointer = (clientX: number, target = scrubRef.current) => {
    const bar = barRef.current;
    if (!bar || !target) return;
    const bounds = bar.getBoundingClientRect();
    const nextPosition = positionFromClientX(clientX, bounds.left, bounds.width, duration);
    if (target === "timeline") {
      onSeek(nextPosition);
      return;
    }
    const nextLoop = dragLoopMarker(target, loop, nextPosition, duration);
    onLoopChange(nextLoop.a, nextLoop.b);
  };
  const capturePointer = (pointerId: number) => {
    barRef.current?.setPointerCapture(pointerId);
  };
  const finishScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubRef.current) return;
    updateFromPointer(event.clientX);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    scrubRef.current = null;
    setScrub(null);
  };

  return (
    <div
      ref={barRef}
      data-testid="seek-bar"
      data-scrubbing={scrub ?? "none"}
      className="relative flex h-[34px] min-w-0 flex-1 touch-none cursor-pointer items-center"
      onPointerDown={(event) => {
        capturePointer(event.pointerId);
        beginScrub("timeline");
        updateFromPointer(event.clientX, "timeline");
      }}
      onPointerMove={(event) => updateFromPointer(event.clientX)}
      onPointerUp={finishScrub}
      onPointerCancel={finishScrub}
    >
      <div className="pointer-events-none absolute left-0 right-0 h-[4px] rounded-chip bg-border-3" />
      <LoopRegion loop={loop} duration={duration} />
      <div
        data-testid="played-track"
        className="pointer-events-none absolute left-0 h-[4px] rounded-chip bg-hand-right"
        style={{ width: `${percentage(position, duration)}%` }}
      />
      <div
        data-testid="playhead"
        className="pointer-events-none absolute h-[18px] w-[3px] rounded-chip bg-text"
        style={{
          left: `${percentage(position, duration)}%`,
          marginLeft: "-1px",
          boxShadow: shadow.playhead,
        }}
      />
      {loop.a !== null ? (
        <LoopMarker
          marker="a"
          position={loop.a}
          duration={duration}
          dragging={scrub === "a"}
          onPointerDown={(event) => {
            event.stopPropagation();
            capturePointer(event.pointerId);
            beginScrub("a");
          }}
        />
      ) : null}
      {loop.b !== null ? (
        <LoopMarker
          marker="b"
          position={loop.b}
          duration={duration}
          dragging={scrub === "b"}
          onPointerDown={(event) => {
            event.stopPropagation();
            capturePointer(event.pointerId);
            beginScrub("b");
          }}
        />
      ) : null}
      {scrub === "timeline" ? (
        <div
          role="status"
          data-testid="scrub-tooltip"
          className="pointer-events-none absolute top-[-16px] -translate-x-1/2 rounded-note bg-text px-[6px] py-[2px] font-mono text-mono-meta leading-[normal] text-bg"
          style={{ left: `${percentage(position, duration)}%` }}
        >
          {formatTime(position)}
        </div>
      ) : null}
    </div>
  );
}

const SPEEDS: PlaybackSpeed[] = [1, 0.5, 0.25];

export function SpeedSelector({
  speed,
  onSpeedChange,
}: {
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}) {
  return (
    <div className="flex items-center gap-[8px]">
      <div className="font-mono text-mono-label leading-[normal] tracking-[0.1em] text-mono-dim-2">SPEED</div>
      {SPEEDS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={speed === option}
          className={`cursor-pointer rounded-button border px-[11px] py-[7px] font-mono text-small leading-[normal] ${
            speed === option
              ? "border-hand-right bg-hand-right-tint text-hand-right"
              : "border-border-3 bg-transparent text-secondary"
          }`}
          onClick={() => onSpeedChange(option)}
        >
          {option}x
        </button>
      ))}
    </div>
  );
}

function LoopButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`cursor-pointer rounded-button border px-[11px] py-[7px] text-small leading-[normal] ${
        active ? "border-amber text-amber" : "border-border-3 bg-transparent text-secondary"
      }`}
      style={active ? { background: `${color.amber}${alpha.toggleOnBg}` } : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function LoopControls({
  position,
  loop,
  onLoopChange,
}: {
  position: number;
  loop: PlaybackLoop;
  onLoopChange: (a: number | null, b: number | null) => void;
}) {
  const update = (next: PlaybackLoop) => onLoopChange(next.a, next.b);
  return (
    <div className="flex items-center gap-[8px]">
      <div className="font-mono text-mono-label leading-[normal] tracking-[0.1em] text-mono-dim-2">LOOP</div>
      <LoopButton active={loop.a !== null} onClick={() => update(setLoopA(loop, position))}>
        Set A
      </LoopButton>
      <LoopButton active={loop.b !== null} onClick={() => update(setLoopB(loop, position))}>
        Set B
      </LoopButton>
      <LoopButton active={false} onClick={() => onLoopChange(null, null)}>
        Clear
      </LoopButton>
      {loop.a !== null && loop.b !== null ? (
        <div className="whitespace-nowrap font-mono text-mono-meta leading-[normal] text-amber">
          LOOPING {formatTime(loop.a)}–{formatTime(loop.b)}
        </div>
      ) : null}
    </div>
  );
}

export interface TransportRow1Props {
  playback: PlaybackSnapshot;
  onTogglePlay: () => void;
  onSeek: (position: number) => void;
  onLoopChange: (a: number | null, b: number | null) => void;
}

export function TransportRow1({
  playback,
  onTogglePlay,
  onSeek,
  onLoopChange,
}: TransportRow1Props) {
  return (
    <div className="flex items-center gap-[16px] px-[22px] pb-[10px] pt-[16px]">
      <PlayButton playing={playback.playing} onClick={onTogglePlay} />
      <TimeReadout position={playback.position} duration={playback.duration} />
      <SeekBar
        position={playback.position}
        duration={playback.duration}
        loop={playback.loop}
        onSeek={onSeek}
        onLoopChange={onLoopChange}
      />
    </div>
  );
}

export interface TransportRow2Props {
  playback: PlaybackSnapshot;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onLoopChange: (a: number | null, b: number | null) => void;
}

export function TransportRow2({
  playback,
  onSpeedChange,
  onLoopChange,
}: TransportRow2Props) {
  return (
    <div
      data-testid="transport-row-2"
      className="flex flex-wrap items-center gap-[22px] px-[22px] pb-[16px]"
    >
      <SpeedSelector speed={playback.speed} onSpeedChange={onSpeedChange} />
      <LoopControls
        position={playback.position}
        loop={playback.loop}
        onLoopChange={onLoopChange}
      />
      <div className="min-w-0 flex-1" />
      <div className="font-mono text-mono-label leading-[normal] tracking-[0.06em] text-mono-dim-3">
        SPACE PLAY · ← → 5s · DRAG BAR TO SCRUB
      </div>
    </div>
  );
}

export interface PlayerTransportProps {
  playback: PlaybackSnapshot;
  onTogglePlay: () => void;
  onSeek: (position: number) => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onLoopChange: (a: number | null, b: number | null) => void;
}

export function PlayerTransport(props: PlayerTransportProps) {
  return (
    <div className="shrink-0 border-t border-border-1 bg-panel">
      <TransportRow1 {...props} />
      <TransportRow2 {...props} />
    </div>
  );
}
