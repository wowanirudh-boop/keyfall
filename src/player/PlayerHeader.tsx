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
  listening?: boolean;
  onLibrary: () => void;
  onMutedChange: (muted: boolean) => void;
  onListenToggle?: () => void;
}

function sourceLabel(piece: PieceDocument) {
  if (piece.source === "catalog") return "PUBLIC-DOMAIN CATALOG";
  return piece.source === "musicxml-upload" ? "MUSICXML UPLOAD" : "MIDI UPLOAD";
}

export function PlayerHeader({
  piece,
  muted,
  listening = false,
  onLibrary,
  onMutedChange,
  onListenToggle,
}: PlayerHeaderProps) {
  const metadata = [piece.composer.toUpperCase(), sourceLabel(piece)].filter(Boolean).join(" · ");

  return (
    <header className="flex shrink-0 items-center gap-[18px] border-b border-border-1 bg-panel px-[22px] py-[14px]">
      <GhostButton onClick={onLibrary}>← Library</GhostButton>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <h1 className="m-0 truncate text-subheading font-medium tracking-[-0.01em]">
          {piece.title}
        </h1>
        <div className="truncate font-mono text-mono-meta tracking-[0.04em] text-mono-dim-2">
          {metadata}
        </div>
      </div>
      <HandLegend hasHandData={piece.hasHandData} />
      <TogglePill on={!muted} onClick={() => onMutedChange(!muted)}>
        {muted ? "Muted" : "Audio on"}
      </TogglePill>
      <TogglePill accent="listening" on={listening} onClick={onListenToggle}>
        {listening ? "Stop listening" : "Listen mode"}
      </TogglePill>
    </header>
  );
}
