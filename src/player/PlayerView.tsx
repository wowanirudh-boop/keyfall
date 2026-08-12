import { useEffect, useMemo, useState } from "react";

import type { PieceDocument } from "../music/types";
import type { PlaybackSnapshot, PlaybackSpeed } from "../playback";
import { PlayerShortcuts, PlayerTransport } from "../transport";
import { keyboardWindowFor } from "./keyboardWindow";
import type { LiveVerdict } from "./keyState";
import { AudioBlockedNotice, ImportNoticeStrip, TransientNotice } from "./Notices";
import { PianoKeyboard } from "./PianoKeyboard";
import { PlayerHeader } from "./PlayerHeader";
import { WaterfallStage } from "./WaterfallStage";

/**
 * Drives the keyboard window. Observes the shell rather than listening for
 * `resize`, so a rotation, a split-screen change and a browser-chrome reflow
 * all land the same way.
 */
function useMeasuredWidth(element: HTMLElement | null) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!element) return;
    const measure = (next: number) => setWidth((current) => (next > 0 ? next : current));
    const remeasure = () => measure(element.clientWidth);
    remeasure();

    // Belt and braces: a rotation is reliably one of these two, but which one
    // depends on the browser, and getting it wrong leaves the keyboard windowed
    // for the previous orientation.
    window.addEventListener("resize", remeasure);
    window.addEventListener("orientationchange", remeasure);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            measure(entries[0]?.contentRect.width ?? element.clientWidth);
          });
    observer?.observe(element);

    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", remeasure);
      observer?.disconnect();
    };
  }, [element]);

  return width;
}

export interface PlayerViewProps {
  piece: PieceDocument;
  playback: PlaybackSnapshot;
  onLibrary: () => void;
  onMutedChange: (muted: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onTogglePlay?: () => void;
  onSeek?: (position: number) => void;
  onSpeedChange?: (speed: PlaybackSpeed) => void;
  onLoopChange?: (a: number | null, b: number | null) => void;
  listeningDevice?: string | null;
  onListenToggle?: () => void;
  transientNotice?: string | null;
  onTransientDismiss?: () => void;
  liveVerdicts?: ReadonlyMap<string, LiveVerdict>;
  seekRevision?: number;
}

export function PlayerView({
  piece,
  playback,
  onLibrary,
  onMutedChange,
  onVolumeChange,
  onTogglePlay = () => undefined,
  onSeek = () => undefined,
  onSpeedChange = () => undefined,
  onLoopChange = () => undefined,
  listeningDevice,
  onListenToggle,
  transientNotice,
  onTransientDismiss,
  liveVerdicts,
  seekRevision = 0,
}: PlayerViewProps) {
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const width = useMeasuredWidth(shell);
  const keyboardWindow = useMemo(
    () => keyboardWindowFor(piece.notes.map((note) => note.midi), width),
    [piece.notes, width],
  );

  // `h-screen` is 100vh, which on mobile Safari measures the viewport *without*
  // the browser chrome — the second transport row ended up underneath the
  // address bar with no way to scroll to it. `dvh` tracks the visible area
  // (D-027); `h-screen` stays as the fallback for browsers without dvh.
  return (
    <main
      ref={setShell}
      data-testid="player-view"
      className="flex h-screen min-h-0 flex-col overflow-hidden bg-bg [height:100dvh]"
    >
      <PlayerHeader
        piece={piece}
        muted={playback.muted}
        volume={playback.volume}
        listening={Boolean(listeningDevice)}
        onLibrary={onLibrary}
        onMutedChange={onMutedChange}
        onVolumeChange={onVolumeChange}
        onListenToggle={onListenToggle}
      />
      <AudioBlockedNotice blocked={playback.audioBlocked} />
      <ImportNoticeStrip notices={piece.notices} />
      <WaterfallStage
        notes={piece.notes}
        position={playback.position}
        speed={playback.speed}
        hasHandData={piece.hasHandData}
        listeningDevice={listeningDevice}
        keyboardWindow={keyboardWindow}
      />
      <PianoKeyboard
        notes={piece.notes}
        position={playback.position}
        hasHandData={piece.hasHandData}
        listening={Boolean(listeningDevice)}
        liveVerdicts={liveVerdicts}
        seekRevision={seekRevision}
        keyboardWindow={keyboardWindow}
      />
      <PlayerTransport
        playback={playback}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        onSpeedChange={onSpeedChange}
        onLoopChange={onLoopChange}
      />
      <PlayerShortcuts
        position={playback.position}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
      />
      <TransientNotice message={transientNotice ?? null} onDismiss={onTransientDismiss} />
    </main>
  );
}
