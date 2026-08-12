import { useEffect, useRef, useState } from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { HomeRoute, libraryRepository } from './home';
import type { StoredPiece } from './library';
import { PlaybackEngine, type PlaybackSnapshot } from './playback';
import {
  HandColorProvider,
  PlayerView,
  readAudioPreferences,
  writeMutedPreference,
  writeVolumePreference,
} from './player';

function PieceRoute() {
  const { pieceId } = useParams();

  if (!pieceId) return <RouteShell label="Not found" title="This piece is not in My pieces." />;
  return <LoadedPieceRoute key={pieceId} pieceId={pieceId} />;
}

function LoadedPieceRoute({ pieceId }: { pieceId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const engineRef = useRef<PlaybackEngine | null>(null);
  const [piece, setPiece] = useState<StoredPiece | null | undefined>(null);
  const [playback, setPlayback] = useState<PlaybackSnapshot>({
    position: 0,
    duration: 0,
    playing: false,
    speed: 1,
    loop: { a: null, b: null },
    muted: false,
    volume: 1,
    audioBlocked: false,
  });

  useEffect(() => {
    let active = true;
    libraryRepository
      .get(pieceId)
      .then((stored) => {
        if (active) setPiece(stored);
      })
      .catch(() => {
        if (active) setPiece(undefined);
      });
    return () => {
      active = false;
    };
  }, [pieceId]);

  useEffect(() => {
    if (!piece) return;
    const engine = new PlaybackEngine();
    const audioPreferences = readAudioPreferences();
    engine.setMuted(audioPreferences.muted);
    engine.setVolume(audioPreferences.volume);
    engineRef.current = engine;
    const unsubscribe = engine.subscribe(setPlayback);
    engine.load(piece);
    engine.setSpeed(piece.lastSpeed);
    return () => {
      unsubscribe();
      engineRef.current = null;
      void engine.dispose();
    };
  }, [piece]);

  if (piece === null) return <RouteShell label="Library" title="Opening piece…" />;
  if (piece === undefined) return <RouteShell label="Not found" title="This piece is not in My pieces." />;

  const storageWarning = (location.state as { storageWarning?: boolean } | null)?.storageWarning
    ? 'This piece is usable for this session but was not saved locally because browser storage is full.'
    : null;

  return (
    <PlayerView
      piece={piece}
      playback={playback}
      onLibrary={() => navigate('/')}
      onMutedChange={(muted) => {
        writeMutedPreference(muted);
        engineRef.current?.setMuted(muted);
        if (engineRef.current) setPlayback(engineRef.current.getSnapshot());
      }}
      onVolumeChange={(volume) => {
        writeVolumePreference(volume);
        engineRef.current?.setVolume(volume);
        if (engineRef.current) setPlayback(engineRef.current.getSnapshot());
      }}
      onTogglePlay={() => {
        const engine = engineRef.current;
        if (!engine) return;
        if (engine.getSnapshot().playing) engine.pause();
        else void engine.play();
      }}
      onSeek={(position) => engineRef.current?.seek(position)}
      onSpeedChange={(speed) => {
        engineRef.current?.setSpeed(speed);
        void libraryRepository.setLastSpeed(piece.id, speed);
      }}
      onLoopChange={(a, b) => engineRef.current?.setLoop(a, b)}
      transientNotice={storageWarning}
    />
  );
}

function ReportRoute() {
  const { attemptId } = useParams();

  return <RouteShell label="Report" title={`Attempt ${attemptId}`} />;
}

function RouteShell({ label, title }: { label: string; title: string }) {
  return (
    <main className="grid min-h-screen place-items-center overflow-x-hidden px-[32px] py-[40px]">
      <section className="w-full max-w-[880px] rounded-card border border-border-2 bg-card p-[26px]">
        <span className="font-mono text-mono-label uppercase tracking-[0.1em] text-mono-dim-2">{label}</span>
        <h1 className="mt-[8px] text-subheading font-medium">{title}</h1>
      </section>
    </main>
  );
}

function NotFoundRoute() {
  return <RouteShell label="Not found" title="This page does not exist." />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/pieces/:pieceId" element={<PieceRoute />} />
      <Route path="/reports/:attemptId" element={<ReportRoute />} />
      <Route path="*" element={<NotFoundRoute />} />
    </Routes>
  );
}

export function App() {
  return (
    <HandColorProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </HandColorProvider>
  );
}
