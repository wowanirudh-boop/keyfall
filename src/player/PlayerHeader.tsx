import { type PointerEvent as ReactPointerEvent } from "react";

import { GhostButton, TogglePill } from "../design/primitives";
import type { PieceDocument } from "../music/types";
import { useHandColors } from "./handColors";
import { HandColorButton } from "./HandColorControl";

export interface HandLegendProps {
  hasHandData: boolean;
}

export function HandLegend({ hasHandData }: HandLegendProps) {
  const { mode } = useHandColors();
  if (!hasHandData || mode === "single") return null;
  const rightLabel = mode === "swapped" ? "LEFT" : "RIGHT";
  const leftLabel = mode === "swapped" ? "RIGHT" : "LEFT";
  return (
    <div
      data-testid="hand-legend"
      className="hidden items-center gap-[16px] font-mono text-mono-meta text-mono-dim-2 lg:flex"
    >
      <span className="flex items-center gap-[7px]">
        <span aria-hidden="true" className="h-[8px] w-[8px] rounded-chip bg-hand-right" />
        {rightLabel}
      </span>
      <span className="flex items-center gap-[7px]">
        <span aria-hidden="true" className="h-[8px] w-[8px] rounded-chip bg-hand-left" />
        {leftLabel}
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
  if (piece.source === "catalog") return piece.sourceCollection;
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
    <header
      data-testid="player-header"
      className="flex shrink-0 flex-wrap items-center gap-x-[14px] gap-y-[8px] border-b border-border-1 bg-panel px-[14px] py-[10px] md:gap-x-[18px] md:px-[22px] md:py-[14px]"
    >
      <GhostButton className="shrink-0 whitespace-nowrap" onClick={onLibrary}>← Library</GhostButton>
      {/*
        The controls carry `w-full` below md so they wrap onto their own row
        instead of being pushed past the right edge — at 375px the old single
        row overflowed by 156px, which put the mute toggle and Listen mode
        off-screen with no way to scroll to them (D-027).
      */}
      <div className="flex min-w-0 flex-1 basis-[140px] flex-col gap-[3px]">
        <h1 className="m-0 truncate text-subheading font-medium tracking-[-0.01em]">
          {piece.title}
        </h1>
        <div className="truncate font-mono text-mono-meta tracking-[0.04em] text-mono-dim-2">
          {metadata}
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-[10px] md:w-auto md:justify-start md:gap-[14px]">
        <HandLegend hasHandData={piece.hasHandData} />
        <HandColorButton />
        <div data-testid="header-audio-controls" className="flex shrink-0 items-center gap-[10px]">
          <VolumeSlider volume={volume} onVolumeChange={onVolumeChange} />
          <TogglePill className="whitespace-nowrap" on={!muted} onClick={() => onMutedChange(!muted)}>
            {muted ? "Muted" : "Audio on"}
          </TogglePill>
        </div>
        {/*
          Listen mode is inert until T08 lands, so it renders disabled rather
          than as a button that silently does nothing when tapped.
        */}
        <TogglePill
          className={`shrink-0 whitespace-nowrap ${onListenToggle ? "" : "cursor-not-allowed opacity-50"}`.trim()}
          accent="listening"
          on={listening}
          disabled={!onListenToggle}
          title={onListenToggle ? undefined : "Connect a MIDI keyboard to use listen mode"}
          onClick={onListenToggle}
        >
          {listening ? "Stop listening" : "Listen mode"}
        </TogglePill>
      </div>
    </header>
  );
}
