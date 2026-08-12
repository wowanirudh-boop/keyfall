import type { PieceDocument } from "../music/types";
import type { PlaybackSnapshot, PlaybackSpeed } from "../playback";
import { PlayerShortcuts, PlayerTransport } from "../transport";
import type { LiveVerdict } from "./keyState";
import { ImportNoticeStrip, TransientNotice } from "./Notices";
import { PianoKeyboard } from "./PianoKeyboard";
import { PlayerHeader } from "./PlayerHeader";
import { WaterfallStage } from "./WaterfallStage";

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
  return (
    <main data-testid="player-view" className="flex h-screen min-h-0 flex-col overflow-hidden bg-bg">
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
      <ImportNoticeStrip notices={piece.notices} />
      <WaterfallStage
        notes={piece.notes}
        position={playback.position}
        speed={playback.speed}
        hasHandData={piece.hasHandData}
        listeningDevice={listeningDevice}
      />
      <PianoKeyboard
        notes={piece.notes}
        position={playback.position}
        hasHandData={piece.hasHandData}
        listening={Boolean(listeningDevice)}
        liveVerdicts={liveVerdicts}
        seekRevision={seekRevision}
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
