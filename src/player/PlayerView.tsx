import { useEffect, useMemo, useRef, useState } from "react";

import { playerDensity, type PlayerDensity } from "../design/tokens";
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
export function stabilizePlayerHeight(current: number, next: number) {
  if (next <= 0) return current;
  if (current <= 0) return next;

  const threshold = playerDensity.comfortableMinHeightPx;
  const crossesThreshold = (current < threshold) !== (next < threshold);
  if (crossesThreshold && Math.abs(next - threshold) < playerDensity.hysteresisPx) {
    return current;
  }
  return next;
}

function useMeasuredSize(element: HTMLElement | null) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!element) return;
    const measure = (nextWidth: number, nextHeight: number) =>
      setSize((current) => ({
        width: nextWidth > 0 ? nextWidth : current.width,
        height: stabilizePlayerHeight(current.height, nextHeight),
      }));
    const remeasure = () => measure(element.clientWidth, element.clientHeight);
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
            const bounds = entries[0]?.contentRect;
            measure(bounds?.width ?? element.clientWidth, bounds?.height ?? element.clientHeight);
          });
    observer?.observe(element);

    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", remeasure);
      observer?.disconnect();
    };
  }, [element]);

  return size;
}

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type WebkitFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

function usePlayerFullscreen(shell: HTMLElement | null) {
  const [active, setActive] = useState(false);
  const orientationLocked = useRef(false);
  const supported = typeof document !== "undefined" && document.fullscreenEnabled === true;

  useEffect(() => {
    const fullscreenDocument = document as WebkitFullscreenDocument;
    const handleChange = () => {
      const nextActive = Boolean(
        document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement,
      );
      setActive(nextActive);
      if (!nextActive && orientationLocked.current) {
        (screen.orientation as LockableOrientation | undefined)?.unlock?.();
        orientationLocked.current = false;
      }
    };

    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, []);

  const toggle = async () => {
    if (!shell) return;
    const fullscreenDocument = document as WebkitFullscreenDocument;
    if (document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement) {
      const exit = document.exitFullscreen ?? fullscreenDocument.webkitExitFullscreen;
      await exit?.call(document);
      return;
    }

    const fullscreenShell = shell as WebkitFullscreenElement;
    const request = shell.requestFullscreen ?? fullscreenShell.webkitRequestFullscreen;
    if (!request) return;
    try {
      await request.call(shell);
    } catch {
      return;
    }

    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!orientation?.lock) return;
    try {
      await orientation.lock("landscape");
      orientationLocked.current = true;
    } catch {
      // Fullscreen remains active when orientation locking is unavailable or rejected.
    }
  };

  return { active, supported, toggle };
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
  const { width, height } = useMeasuredSize(shell);
  const density: PlayerDensity =
    height > 0 && height < playerDensity.comfortableMinHeightPx ? "compact" : "comfortable";
  const fullscreen = usePlayerFullscreen(shell);
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
      data-density={density}
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
        density={density}
        fullscreenActive={fullscreen.active}
        fullscreenSupported={fullscreen.supported}
        onFullscreenToggle={fullscreen.toggle}
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
        density={density}
      />
      <PlayerTransport
        playback={playback}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        onSpeedChange={onSpeedChange}
        onLoopChange={onLoopChange}
        density={density}
        width={width}
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
