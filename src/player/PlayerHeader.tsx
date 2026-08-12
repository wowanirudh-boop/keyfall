import { type PointerEvent as ReactPointerEvent } from "react";

import { GhostButton, TogglePill } from "../design/primitives";
import type { PieceDocument } from "../music/types";

export interface HandLegendProps {
  hasHandData: boolean;
}

export function HandLegend({ hasHandData }: HandLegendProps) {
  if (!hasHandData) return null;
  return (
    <div
      data-testid="hand-legend"
      className="flex items-center gap-[16px] font-mono text-mono-meta text-mono-dim-2"
    >
      <span className="flex items-center gap-[7px]">
        <span aria-hidden="true" className="h-[8px] w-[8px] rounded-chip bg-hand-right" />
        RIGHT
      </span>
      <span className="flex items-center gap-[7px]">
        <span aria-hidden="true" className="h-[8px] w-[8px] rounded-chip bg-hand-left" />
        LEFT
      </span>
    </div>
  );
}

export interface PlayerHeaderProps {
  piece: PieceDocument;
  muted: boolean;
  volume: number;
  listening?: boolean;
  onLibrary: () => void;
  onMutedChange: (muted: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onListenToggle?: () => void;
}

export interface VolumeSliderProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export function VolumeSlider({ volume, onVolumeChange }: VolumeSliderProps) {
  const percentage = Math.round(volume * 100);

  const updateFromPointer = (event: ReactPointerEvent<HTMLInputElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextVolume = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    onVolumeChange(nextVolume);
  };

  const releasePointer = (event: ReactPointerEvent<HTMLInputElement>) => {
    updateFromPointer(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div data-testid="volume-slider" className="relative h-[30px] w-[72px] shrink-0 touch-none">
      <div className="pointer-events-none absolute inset-x-[5px] top-1/2 h-[4px] -translate-y-1/2 rounded-chip bg-border-3">
        <div
          className="absolute left-0 h-[4px] rounded-chip bg-hand-right"
          style={{ width: `${percentage}%` }}
        />
        <div
          className="absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-text"
          style={{ left: `${percentage}%` }}
        />
      </div>
      <input
        aria-label="Volume"
        aria-valuetext={`${percentage}%`}
        type="range"
        min="0"
        max="100"
        value={percentage}
        className="absolute inset-0 m-0 h-full w-full cursor-pointer touch-none opacity-0"
        onChange={(event) => onVolumeChange(Number(event.currentTarget.value) / 100)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
        }}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
      />
    </div>
  );
}

function sourceLabel(piece: PieceDocument) {
  if (piece.source === "catalog") return "MUTOPIA CATALOG";
  return piece.source === "musicxml-upload" ? "MUSICXML UPLOAD" : "MIDI UPLOAD";
}

export function PlayerHeader({
  piece,
  muted,
  volume,
  listening = false,
  onLibrary,
  onMutedChange,
  onVolumeChange,
  onListenToggle,
}: PlayerHeaderProps) {
  const metadata = [
    piece.composer.toUpperCase(),
    sourceLabel(piece),
    piece.sourceCreator?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header data-testid="player-header" className="flex shrink-0 items-center gap-[18px] border-b border-border-1 bg-panel px-[22px] py-[14px]">
      <GhostButton className="shrink-0 whitespace-nowrap" onClick={onLibrary}>← Library</GhostButton>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <h1 className="m-0 truncate text-subheading font-medium tracking-[-0.01em]">
          {piece.title}
        </h1>
        <div className="truncate font-mono text-mono-meta tracking-[0.04em] text-mono-dim-2">
          {metadata}
        </div>
      </div>
      <HandLegend hasHandData={piece.hasHandData} />
      <div data-testid="header-audio-controls" className="flex shrink-0 items-center gap-[10px]">
        <VolumeSlider volume={volume} onVolumeChange={onVolumeChange} />
        <TogglePill className="whitespace-nowrap" on={!muted} onClick={() => onMutedChange(!muted)}>
          {muted ? "Muted" : "Audio on"}
        </TogglePill>
      </div>
      <TogglePill className="shrink-0 whitespace-nowrap" accent="listening" on={listening} onClick={onListenToggle}>
        {listening ? "Stop listening" : "Listen mode"}
      </TogglePill>
    </header>
  );
}
