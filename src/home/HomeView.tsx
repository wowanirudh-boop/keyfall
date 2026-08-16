import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  browseCatalog,
  CATALOG_SORTS,
  composerIndex,
  type CatalogEntry,
  type CatalogSort,
  type LoadedPlaylist,
} from "../catalog";
import { AppHeader } from "../design/AppHeader";
import {
  ErrorPanel,
  GHOST_BUTTON_CLASS_NAME,
  Modal,
  StatusBanner,
} from "../design/primitives";
import type { SavedPieceSummary } from "../library";
import { relativeOpened } from "../library";
import { SALAMANDER_ATTRIBUTION, SALAMANDER_LICENSE_URL } from "../playback";
import { formatPlaylistDuration } from "../playlists/format";
import { formatTime } from "../transport";

const EMPTY_LIBRARY_COPY =
  "Nothing saved yet. Every piece you open — searched or uploaded — is kept here for tomorrow.";
const CATALOG_UNAVAILABLE_COPY =
  "Catalog search is unavailable right now. Uploading a file and opening pieces from My pieces both still work offline.";
const MUTOPIA_LICENCE_URL = "https://www.mutopiaproject.org/legal.html";
const ALL_COMPOSERS = "";

export function AboutPanel({ onClose }: { onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <Modal title="About" onClose={onClose}>
      <div className="flex flex-col gap-[14px] text-body-sm leading-[1.55] text-secondary">
        <p>Piano Practice Player turns piano scores into falling notes for practising at your own pace.</p>
        <p>Everything stays on this device. There is no account, and nothing is uploaded.</p>
        <p>
          Piano sound: {" "}
          <a
            className="text-text underline hover:text-hand-right"
            href={SALAMANDER_LICENSE_URL}
            target="_blank"
            rel="noreferrer"
          >
            {SALAMANDER_ATTRIBUTION}
          </a>
          .
        </p>
        <p>
          Catalogue scores come from the {" "}
          <a
            className="text-text underline hover:text-hand-right"
            href={MUTOPIA_LICENCE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Mutopia Project
          </a>{" "}
          under their individual licences.
        </p>
      </div>
      <div className="flex justify-end">
        <button
          ref={closeButtonRef}
          type="button"
          className={GHOST_BUTTON_CLASS_NAME}
          onClick={onClose}
        >
          Close About
        </button>
      </div>
    </Modal>
  );
}

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
    <section className="flex flex-col gap-[18px] rounded-card border border-border-2 bg-card p-[18px] md:p-[26px]">
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
    <div className="flex h-[62px] items-center gap-[12px] rounded-card border border-border-3 bg-raised px-[14px] md:px-[18px]">
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

const SELECT_CLASS_NAME =
  "cursor-pointer rounded-button border border-border-3 bg-control px-[10px] py-[7px] text-small text-text hover:border-border-5";

function LabelledSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-[8px]">
      <span className="font-mono text-mono-label uppercase tracking-[0.1em] text-mono-dim-2">
        {label}
      </span>
      <select
        aria-label={label}
        className={SELECT_CLASS_NAME}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {children}
      </select>
    </label>
  );
}

export interface CatalogControlsProps {
  sort: CatalogSort;
  onSortChange: (sort: CatalogSort) => void;
  composer?: string;
  composers?: ReadonlyArray<{ composer: string; count: number }>;
  onComposerChange?: (composer: string) => void;
}

/** The sort and composer selectors — 596 pieces are not navigable without them. */
export function CatalogControls({
  sort,
  onSortChange,
  composer,
  composers,
  onComposerChange,
}: CatalogControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      <LabelledSelect label="Sort" value={sort} onChange={(next) => onSortChange(next as CatalogSort)}>
        {CATALOG_SORTS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </LabelledSelect>
      {composers && onComposerChange ? (
        <LabelledSelect label="Composer" value={composer ?? ALL_COMPOSERS} onChange={onComposerChange}>
          <option value={ALL_COMPOSERS}>All composers</option>
          {composers.map((option) => (
            <option key={option.composer} value={option.composer}>
              {option.composer} ({option.count})
            </option>
          ))}
        </LabelledSelect>
      ) : null}
    </div>
  );
}

export function SearchResultRow({
  entry,
  onOpen,
}: {
  entry: CatalogEntry;
  onOpen: (entry: CatalogEntry) => void;
}) {
  return (
    <button
      type="button"
      className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-[18px] rounded-card border border-border-2 bg-card px-[16px] py-[14px] text-left hover:border-result-hover-border hover:bg-result-hover-bg md:px-[18px] md:py-[16px]"
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
  );
}

export function SearchResults({
  entries,
  onOpen,
  sort,
  onSortChange,
}: {
  entries: readonly CatalogEntry[];
  onOpen: (entry: CatalogEntry) => void;
  sort: CatalogSort;
  onSortChange: (sort: CatalogSort) => void;
}) {
  return (
    <section aria-label="Search results" className="flex flex-col gap-[8px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px] pl-[2px]">
        <span className="font-mono text-mono-meta tracking-[0.06em] text-mono-dim-1">
          {entries.length} {entries.length === 1 ? "MATCH" : "MATCHES"} · PUBLIC DOMAIN &amp; CC SOURCES
        </span>
        <CatalogControls sort={sort} onSortChange={onSortChange} />
      </div>
      {entries.map((entry) => (
        <SearchResultRow key={entry.id} entry={entry} onOpen={onOpen} />
      ))}
    </section>
  );
}

export const CATALOG_PAGE_SIZE = 25;

export function CatalogBrowse({
  entries,
  onOpen,
  sort,
  onSortChange,
  composer,
  onComposerChange,
}: {
  entries: readonly CatalogEntry[];
  onOpen: (entry: CatalogEntry) => void;
  sort: CatalogSort;
  onSortChange: (sort: CatalogSort) => void;
  composer: string;
  onComposerChange: (composer: string) => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  // A changed sort or composer means a different list; page 4 of the old one is
  // meaningless in the new one. Adjusted during render rather than in an effect
  // so the new page never paints at the stale offset first.
  const listKey = `${sort} ${composer}`;
  const [renderedListKey, setRenderedListKey] = useState(listKey);
  if (renderedListKey !== listKey) {
    setRenderedListKey(listKey);
    setCurrentPage(0);
  }

  const composers = useMemo(() => composerIndex(entries), [entries]);
  const sortedEntries = useMemo(() => {
    const filtered = composer ? entries.filter((entry) => entry.composer === composer) : entries;
    return browseCatalog(filtered, sort);
  }, [composer, entries, sort]);
  const pageCount = Math.max(1, Math.ceil(sortedEntries.length / CATALOG_PAGE_SIZE));
  const page = Math.min(currentPage, pageCount - 1);
  const pageEntries = sortedEntries.slice(
    page * CATALOG_PAGE_SIZE,
    (page + 1) * CATALOG_PAGE_SIZE,
  );
  const sortLabel = CATALOG_SORTS.find((option) => option.id === sort)?.label ?? "";

  return (
    <section aria-label="Browse catalog" className="flex flex-col gap-[8px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px] pl-[2px]">
        <span className="font-mono text-mono-meta tracking-[0.06em] text-mono-dim-1">
          {sortedEntries.length} PIECES · {sortLabel.toUpperCase()}
        </span>
        <CatalogControls
          sort={sort}
          onSortChange={onSortChange}
          composer={composer}
          composers={composers}
          onComposerChange={onComposerChange}
        />
      </div>
      {pageEntries.map((entry) => (
        <SearchResultRow key={entry.id} entry={entry} onOpen={onOpen} />
      ))}
      {pageCount > 1 ? (
        <nav aria-label="Catalog pages" className="mt-[6px] flex items-center justify-end gap-[10px]">
          <span className="mr-auto font-mono text-mono-meta tracking-[0.06em] text-mono-dim-1">
            PAGE {page + 1} OF {pageCount}
          </span>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS_NAME}
            disabled={page === 0}
            onClick={() => setCurrentPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className={GHOST_BUTTON_CLASS_NAME}
            disabled={page === pageCount - 1}
            onClick={() => setCurrentPage((current) => Math.min(pageCount - 1, current + 1))}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}

/**
 * The one row a returning learner actually came for. It used to sit below 25
 * catalog rows — roughly 3,900px down on a phone (D-029).
 */
export function ContinueCard({
  piece,
  now,
  onOpen,
}: {
  piece: SavedPieceSummary;
  now: number;
  onOpen: (piece: SavedPieceSummary) => void;
}) {
  return (
    <button
      type="button"
      data-testid="continue-card"
      className="flex cursor-pointer flex-col gap-[12px] rounded-card border border-result-hover-border bg-result-hover-bg px-[18px] py-[16px] text-left hover:border-hand-right md:px-[22px] md:py-[18px]"
      onClick={() => onOpen(piece)}
    >
      <span className="font-mono text-mono-label uppercase tracking-[0.1em] text-hand-right">
        Continue practising
      </span>
      <span className="flex flex-wrap items-baseline gap-x-[14px] gap-y-[4px]">
        <span className="text-[20px] font-medium tracking-[-0.01em]">{piece.title}</span>
        <span className="text-body-sm text-secondary">{piece.composer}</span>
      </span>
      <span className="font-mono text-mono-meta tracking-[0.04em] text-mono-dim-2">
        {`LAST PRACTISED ${relativeOpened(piece.lastOpened, now)} · ${piece.lastSpeed}x · ${formatTime(piece.duration)}`}
      </span>
    </button>
  );
}

export function Playlists({
  playlists,
  onOpen,
}: {
  playlists: readonly LoadedPlaylist[];
  onOpen: (playlist: LoadedPlaylist) => void;
}) {
  if (playlists.length === 0) return null;
  return (
    <section aria-label="Playlists" className="flex min-w-0 flex-col gap-[8px]">
      <h2 className="pl-[2px] font-mono text-mono-label uppercase tracking-[0.1em] text-mono-dim-2">
        Playlists
      </h2>
      {playlists.map((playlist) => (
        <button
          key={playlist.id}
          type="button"
          className="grid min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-[12px] rounded-card border border-border-3 bg-card px-[16px] py-[14px] text-left hover:border-result-hover-border hover:bg-result-hover-bg"
          onClick={() => onOpen(playlist)}
        >
          <span className="flex min-w-0 flex-col gap-[4px]">
            <span className="truncate text-subheading font-medium">{playlist.name}</span>
            <span className="truncate font-mono text-mono-meta tracking-[0.04em] text-mono-dim-2">
              {playlist.entries.length} {playlist.entries.length === 1 ? "PIECE" : "PIECES"} ·{" "}
              {formatPlaylistDuration(playlist.durationSeconds)}
            </span>
          </span>
          <span aria-hidden="true" className="text-subheading text-mono-dim-2">
            ›
          </span>
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
            className="grid grid-cols-[1fr_auto_auto] items-center gap-[10px] rounded-card border border-border-2 bg-card px-[14px] py-[12px] hover:border-border-4 md:gap-[16px] md:px-[16px] md:py-[14px]"
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
  catalogEntries: readonly CatalogEntry[];
  playlists?: readonly LoadedPlaylist[];
  results: readonly CatalogEntry[];
  searched: boolean;
  catalogUnavailable: boolean;
  library: readonly SavedPieceSummary[];
  uploadError?: string | null;
  uploadErrorOrigin?: UploadOrigin;
  assetError?: string | null;
  storageWarning?: string | null;
  now: number;
  sort?: CatalogSort;
  onSortChange?: (sort: CatalogSort) => void;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onUpload: (file: File, origin: UploadOrigin) => void;
  onOpenResult: (entry: CatalogEntry) => void;
  onOpenPlaylist?: (playlist: LoadedPlaylist) => void;
  onOpenSaved: (piece: SavedPieceSummary) => void;
  onDelete: (piece: SavedPieceSummary) => void;
}

export type UploadOrigin = "search" | "library";

export function HomeView({
  query,
  catalogEntries,
  playlists = [],
  results,
  searched,
  catalogUnavailable,
  library,
  uploadError,
  uploadErrorOrigin = "search",
  assetError,
  storageWarning,
  now,
  sort = "composer",
  onSortChange = () => undefined,
  onQueryChange,
  onClear,
  onUpload,
  onOpenResult,
  onOpenPlaylist = () => undefined,
  onOpenSaved,
  onDelete,
}: HomeViewProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [composer, setComposer] = useState(ALL_COMPOSERS);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);
  const showUpload = catalogUnavailable || (searched && results.length === 0);
  const [mostRecent] = library;

  function closeAbout() {
    setAboutOpen(false);
    aboutButtonRef.current?.focus();
  }

  return (
    <>
      <main className="min-h-screen overflow-x-hidden px-[18px] pb-[80px] pt-[26px] md:px-[32px] md:pb-[120px] md:pt-[40px]">
        <div className="mx-auto flex max-w-[880px] flex-col gap-[26px] md:gap-[36px]">
          <AppHeader
            action={
              <button
                ref={aboutButtonRef}
                type="button"
                className={GHOST_BUTTON_CLASS_NAME}
                onClick={() => setAboutOpen(true)}
              >
                About
              </button>
            }
          />
          {catalogUnavailable ? <StatusBanner>{CATALOG_UNAVAILABLE_COPY}</StatusBanner> : null}
          {storageWarning ? <StatusBanner>{storageWarning}</StatusBanner> : null}

          {mostRecent ? (
            <ContinueCard piece={mostRecent} now={now} onOpen={onOpenSaved} />
          ) : (
            <p className="max-w-[54ch] text-body leading-[1.6] text-secondary">
              Search the catalogue or upload your own MIDI or MusicXML file, and the score falls
              down the screen over a labelled keyboard. Everything you open is kept on this device
              for tomorrow.
            </p>
          )}

          <Playlists playlists={playlists} onOpen={onOpenPlaylist} />

          <MyPieces
            pieces={library}
            now={now}
            onOpen={onOpenSaved}
            onDelete={onDelete}
            onUpload={(file) => onUpload(file, "library")}
            uploadError={uploadErrorOrigin === "library" ? uploadError : null}
            showUpload={!catalogUnavailable}
          />

          <div className="flex flex-col gap-[14px]">
            <h2 className="text-body font-medium tracking-[0.01em]">Find something to play</h2>
            <CatalogSearch query={query} onQueryChange={onQueryChange} onClear={onClear} />
            {!catalogUnavailable && !searched && catalogEntries.length > 0 ? (
              <CatalogBrowse
                entries={catalogEntries}
                onOpen={onOpenResult}
                sort={sort}
                onSortChange={onSortChange}
                composer={composer}
                onComposerChange={setComposer}
              />
            ) : null}
            {!catalogUnavailable && searched && results.length > 0 ? (
              <SearchResults
                entries={results}
                onOpen={onOpenResult}
                sort={sort}
                onSortChange={onSortChange}
              />
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
        </div>
      </main>
      {aboutOpen ? <AboutPanel onClose={closeAbout} /> : null}
    </>
  );
}
