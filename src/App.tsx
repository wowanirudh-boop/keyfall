import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { AppHeader } from './design/AppHeader';

function HomeRoute() {
  return (
    <div className="min-h-screen overflow-x-hidden px-[32px] pb-[120px] pt-[40px]">
      <div className="mx-auto max-w-[880px]">
        <AppHeader />
        <main className="mt-[36px] rounded-card border border-border-2 bg-card p-[26px]">
          <span className="font-mono text-mono-label uppercase tracking-[0.1em] text-mono-dim-2">Library</span>
          <h1 className="mt-[8px] text-subheading font-medium">Choose a piece to begin.</h1>
        </main>
      </div>
    </div>
  );
}

function PieceRoute() {
  const { pieceId } = useParams();

  return <RouteShell label="Player" title={`Piece ${pieceId}`} />;
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
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
