import type { CatalogEntry, LoadedPlaylist } from "../catalog";
import { GHOST_BUTTON_CLASS_NAME, ErrorPanel } from "../design/primitives";
import { formatTime } from "../transport";
import { formatPlaylistDuration, joinNames } from "./format";

export function PlaylistView({
  playlist,
  assetError,
  onBack,
  onOpen,
}: {
  playlist: LoadedPlaylist;
  assetError?: string | null;
  onBack: () => void;
  onOpen: (entry: CatalogEntry) => void;
}) {
  const listedWorks = playlist.counts.resolved + playlist.counts.missing;
  const composerNames = joinNames(playlist.missingComposers);

  return (
    <main className="min-h-screen overflow-x-hidden px-[18px] pb-[80px] pt-[26px] md:px-[32px] md:pb-[120px] md:pt-[34px]">
      <div className="mx-auto flex max-w-[880px] min-w-0 flex-col gap-[26px] md:gap-[30px]">
        <header className="flex min-w-0 items-start gap-[12px] border-b border-border-1 pb-[18px]">
          <button
            type="button"
            className={`${GHOST_BUTTON_CLASS_NAME} shrink-0`}
            onClick={onBack}
          >
            ← Home
          </button>
          <div className="flex min-w-0 flex-col gap-[5px] pt-[2px]">
            <h1 className="truncate text-heading font-medium">{playlist.name}</h1>
            <span className="truncate font-mono text-mono-meta uppercase tracking-[0.08em] text-mono-dim-2">
              {playlist.entries.length} OF {listedWorks} ·{" "}
              {formatPlaylistDuration(playlist.durationSeconds)}
            </span>
          </div>
        </header>

        {assetError ? <ErrorPanel>{assetError}</ErrorPanel> : null}

        <section
          aria-label={`${playlist.name} pieces`}
          className="flex min-w-0 flex-col gap-[7px]"
        >
          {playlist.entries.map((entry, index) => (
            <button
              key={entry.ref}
              type="button"
              className="grid min-w-0 cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-[10px] rounded-card border border-border-2 bg-card px-[11px] py-[12px] text-left hover:border-result-hover-border hover:bg-result-hover-bg md:grid-cols-[28px_minmax(0,1fr)_auto] md:gap-[16px] md:px-[16px] md:py-[14px]"
              onClick={() => onOpen(entry.catalogEntry)}
            >
              <span className="text-right font-mono text-mono-meta tabular-nums text-mono-dim-3">
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="truncate text-subheading font-medium">
                  {entry.catalogEntry.title}
                </span>
                <span className="truncate text-body-sm text-secondary">
                  {entry.catalogEntry.composer}
                </span>
              </span>
              {entry.catalogEntry.durationSeconds !== undefined ? (
                <span className="whitespace-nowrap font-mono text-small tabular-nums text-hand-right">
                  {formatTime(entry.catalogEntry.durationSeconds)}
                </span>
              ) : null}
            </button>
          ))}
        </section>

        {playlist.counts.missing > 0 ? (
          <section
            aria-label="Catalog gaps"
            className="border-t border-border-1 pt-[14px] font-mono text-mono-meta leading-[1.6] tracking-[0.03em] text-mono-dim-1"
          >
            <p className="text-amber-text">
              {playlist.counts.missing} more {playlist.counts.missing === 1 ? "work" : "works"}{" "}
              from this playlist {playlist.counts.missing === 1 ? "is" : "are"} not in the catalog yet.
            </p>
            {composerNames ? (
              <p>
                {composerNames} {playlist.missingComposers.length === 1 ? "is" : "are"} the big{" "}
                {playlist.missingComposers.length === 1 ? "gap" : "gaps"}.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
