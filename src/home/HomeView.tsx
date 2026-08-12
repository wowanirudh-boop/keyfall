import type { ChangeEvent, KeyboardEvent } from "react";

import type { CatalogEntry } from "../catalog";
import { AppHeader } from "../design/AppHeader";
import { ErrorPanel, GHOST_BUTTON_CLASS_NAME, StatusBanner } from "../design/primitives";
import type { SavedPieceSummary } from "../library";
import { relativeOpened } from "../library";
import { SALAMANDER_ATTRIBUTION, SALAMANDER_LICENSE_URL } from "../playback";
import { formatTime } from "../transport";

const EMPTY_LIBRARY_COPY =
  "Nothing saved yet. Every piece you open — searched or uploaded — is kept here for tomorrow.";
const CATALOG_UNAVAILABLE_COPY =
  "Catalog search is unavailable right now. Uploading a file and opening pieces from My pieces both still work offline.";

function sourceName(entry: CatalogEntry) {
  const hostname = new URL(entry.licence.sourceUrl).hostname.replace(/^www\./, "");
  return hostname.split(".")[0].toUpperCase();
}

export interface UploadControlProps {
  onUpload: (file: File) => void;
  appearance?: "primary" | "ghost";
}

export function UploadControl({ onUpload, appearance = "primary" }: UploadControlProps) {
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) onUpload(file);
  }

  const control = (
    <label
      className={
        appearance === "ghost"
          ? `${GHOST_BUTTON_CLASS_NAME} inline-flex items-center`
          : "inline-flex cursor-pointer items-center gap-[10px] rounded-input bg-hand-right px-[18px] py-[12px] text-body font-medium text-on-accent hover:bg-hand-right-hover"
      }
    >
      {appearance === "ghost" ? "Upload" : "Upload a MIDI or MusicXML file"}
      <input
        className="sr-only"
        type="file"
        accept=".mid,.midi,.musicxml,.xml,.mxl"
        onChange={chooseFile}
      />
    </label>
  );

  if (appearance === "ghost") return control;

  return (
    <div className="flex flex-wrap items-center gap-[14px]">
      {control}
      <span className="font-mono text-mono-meta text-mono-dim-2">
        .mid .midi .musicxml .xml .mxl · max 10 MB · max 30 min
      </span>
    </div>
  );
}

export interface NoResultsUploadProps extends UploadControlProps {
  query: string;
  uploadError?: string | null;
  assetError?: string | null;
  catalogUnavailable?: boolean;
}

export function NoResultsUpload({
  query,
  uploadError,
  assetError,
  catalogUnavailable = false,
  onUpload,
}: NoResultsUploadProps) {
  return (
    <section className="flex flex-col gap-[18px] rounded-card border border-border-2 bg-card p-[26px]">
      <div className="flex flex-col gap-[7px]">
        <h2 className="text-subheading font-medium">
          {catalogUnavailable
            ? "Open a local score while catalog search is unavailable."
            : `Nothing in the catalog matches “${query}”.`}
        </h2>
        <p className="max-w-[52ch] text-body-sm leading-[1.55] text-secondary">
          The catalog only carries scores that are legal to redistribute, so newer arrangements
          are often missing. If you have the file, upload it and it becomes a piece in your
          library.
        </p>
      </div>
      <UploadControl onUpload={onUpload} />
      {uploadError ? <ErrorPanel>{uploadError}</ErrorPanel> : null}
      {assetError ? <ErrorPanel>{assetError}</ErrorPanel> : null}
    </section>
  );
}

export interface CatalogSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
}

export function CatalogSearch({ query, onQueryChange, onClear }: CatalogSearchProps) {
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") onClear();
  }

  return (
    <div className="flex h-[62px] items-center gap-[12px] rounded-card border border-border-3 bg-raised px-[18px]">
      <span className="font-mono text-small text-mono-dim-1">/</span>
      <input
        aria-label="Search catalog"
        className="min-w-0 flex-1 border-0 bg-transparent text-[17px] tracking-[-0.01em] text-text outline-none placeholder:text-mono-dim-1"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        placeholder="Search a piece — Für Elise, Moonlight Sonata, Gymnopédie"
      />
      {query ? (
        <button
          type="button"
          className="cursor-pointer rounded-button border-0 bg-control px-[11px] py-[7px] text-small text-secondary hover:bg-control-hover hover:text-text"
          onClick={onClear}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

export function SearchResults({
  entries,
  onOpen,
}: {
  entries: readonly CatalogEntry[];
  onOpen: (entry: CatalogEntry) => void;
}) {
  return (
    <section className="flex flex-col gap-[8px]">
      <div className="pl-[2px] font-mono text-mono-meta tracking-[0.06em] text-mono-dim-1">
        {entries.length} {entries.length === 1 ? "MATCH" : "MATCHES"} · PUBLIC DOMAIN &amp; CC SOURCES
      </div>
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-[18px] rounded-card border border-border-2 bg-card px-[18px] py-[16px] text-left hover:border-result-hover-border hover:bg-result-hover-bg"
          onClick={() => onOpen(entry)}
        >
          <span className="flex min-w-0 flex-col gap-[6px]">
            <span className="text-[16px] font-medium tracking-[-0.01em]">{entry.title}</span>
            <span className="text-body-sm text-secondary">
              {entry.composer}
              {entry.arranger ? ` · ${entry.arranger}` : ""}
            </span>
            <span className="font-mono text-mono-meta tracking-[0.04em] text-mono-dim-2">
              {sourceName(entry)} · {entry.licence.name.toUpperCase()}
              {entry.licence.creator ? ` · ${entry.licence.creator.toUpperCase()}` : ""}
            </span>
          </span>
          {entry.durationSeconds !== undefined ? (
            <span className="font-mono text-mono-time text-hand-right">
              {formatTime(entry.durationSeconds)}
            </span>
          ) : null}
        </button>
      ))}
    </section>
  );
}

export function MyPieces({
  pieces,
  now,
  onOpen,
  onDelete,
  onUpload,
  uploadError,
  showUpload,
}: {
  pieces: readonly SavedPieceSummary[];
  now: number;
  onOpen: (piece: SavedPieceSummary) => void;
  onDelete: (piece: SavedPieceSummary) => void;
  onUpload: (file: File) => void;
  uploadError?: string | null;
  showUpload: boolean;
}) {
  return (
    <section aria-label="My pieces" className="flex flex-col gap-[12px]">
      <div className="flex items-center justify-between gap-[12px]">
        <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-[4px]">
          <h2 className="text-body font-medium tracking-[0.01em]">My pieces</h2>
          <span className="font-mono text-mono-meta text-mono-dim-2">
            {pieces.length} SAVED LOCALLY
          </span>
        </div>
        {showUpload ? <UploadControl appearance="ghost" onUpload={onUpload} /> : null}
      </div>
      {uploadError ? <ErrorPanel>{uploadError}</ErrorPanel> : null}
      {pieces.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-3 p-[30px] text-center text-body-sm text-mono-dim-1">
          {EMPTY_LIBRARY_COPY}
        </div>
      ) : (
        pieces.map((piece) => (
          <div
            key={piece.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-[16px] rounded-card border border-border-2 bg-card px-[16px] py-[14px] hover:border-border-4"
          >
            <button
              type="button"
              className="flex min-w-0 cursor-pointer flex-col gap-[4px] border-0 bg-transparent text-left"
              onClick={() => onOpen(piece)}
            >
              <span className="truncate text-subheading font-medium">{piece.title}</span>
              <span className="truncate font-mono text-mono-meta tracking-[0.04em] text-mono-dim-2">
                {[piece.composer.toUpperCase(), `PRACTISED ${relativeOpened(piece.lastOpened, now)}`, `${piece.lastSpeed}x`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
            <span className="font-mono text-small text-secondary">{formatTime(piece.duration)}</span>
            <button
              type="button"
              aria-label={`Delete ${piece.title}`}
              className="cursor-pointer rounded-button border border-border-3 bg-transparent px-[11px] py-[7px] font-mono text-mono-meta text-mono-dim-2 hover:border-error-border hover:text-error"
              onClick={() => onDelete(piece)}
            >
              delete
            </button>
          </div>
        ))
      )}
    </section>
  );
}

export interface HomeViewProps {
  query: string;
  results: readonly CatalogEntry[];
  searched: boolean;
  catalogUnavailable: boolean;
  library: readonly SavedPieceSummary[];
  uploadError?: string | null;
  uploadErrorOrigin?: UploadOrigin;
  assetError?: string | null;
  storageWarning?: string | null;
  now: number;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onUpload: (file: File, origin: UploadOrigin) => void;
  onOpenResult: (entry: CatalogEntry) => void;
  onOpenSaved: (piece: SavedPieceSummary) => void;
  onDelete: (piece: SavedPieceSummary) => void;
}

export type UploadOrigin = "search" | "library";

export function HomeView({
  query,
  results,
  searched,
  catalogUnavailable,
  library,
  uploadError,
  uploadErrorOrigin = "search",
  assetError,
  storageWarning,
  now,
  onQueryChange,
  onClear,
  onUpload,
  onOpenResult,
  onOpenSaved,
  onDelete,
}: HomeViewProps) {
  const showUpload = catalogUnavailable || (searched && results.length === 0);

  return (
    <main className="min-h-screen overflow-x-hidden px-[32px] pb-[120px] pt-[40px]">
      <div className="mx-auto flex max-w-[880px] flex-col gap-[36px]">
        <AppHeader />
        {catalogUnavailable ? <StatusBanner>{CATALOG_UNAVAILABLE_COPY}</StatusBanner> : null}
        {storageWarning ? <StatusBanner>{storageWarning}</StatusBanner> : null}
        <div className="flex flex-col gap-[14px]">
          <CatalogSearch query={query} onQueryChange={onQueryChange} onClear={onClear} />
          {!catalogUnavailable && searched && results.length > 0 ? (
            <SearchResults entries={results} onOpen={onOpenResult} />
          ) : null}
          {showUpload ? (
            <NoResultsUpload
              query={query}
              uploadError={uploadErrorOrigin === "search" ? uploadError : null}
              assetError={assetError}
              catalogUnavailable={catalogUnavailable}
              onUpload={(file) => onUpload(file, "search")}
            />
          ) : null}
          {!showUpload && (assetError || (uploadError && uploadErrorOrigin === "search")) ? (
            <div className="flex flex-col gap-[18px]">
              {assetError ? <ErrorPanel>{assetError}</ErrorPanel> : null}
              <UploadControl onUpload={(file) => onUpload(file, "search")} />
              {uploadError && uploadErrorOrigin === "search" ? (
                <ErrorPanel>{uploadError}</ErrorPanel>
              ) : null}
            </div>
          ) : null}
        </div>
        <MyPieces
          pieces={library}
          now={now}
          onOpen={onOpenSaved}
          onDelete={onDelete}
          onUpload={(file) => onUpload(file, "library")}
          uploadError={uploadErrorOrigin === "library" ? uploadError : null}
          showUpload={!catalogUnavailable}
        />
        <a
          className="font-mono text-mono-meta text-mono-dim-2 hover:text-secondary"
          href={SALAMANDER_LICENSE_URL}
          target="_blank"
          rel="noreferrer"
        >
          {SALAMANDER_ATTRIBUTION}
        </a>
      </div>
    </main>
  );
}
