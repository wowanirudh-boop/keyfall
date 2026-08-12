import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  CatalogAssetError,
  CatalogRepository,
  searchCatalog,
  type CatalogEntry,
  type CatalogSort,
} from "../catalog";
import { LibraryRepository, type SavedPieceSummary } from "../library";
import { importPiece, type ImportError, type PieceDocument } from "../music";
import type { PlaybackSpeed } from "../playback";
import { HomeView, type UploadOrigin } from "./HomeView";

const catalogRepository = new CatalogRepository();
export const libraryRepository = new LibraryRepository();

function uploadError(file: File, error: ImportError) {
  return `“${file.name}” — ${error.message}`;
}

export function HomeRoute() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [library, setLibrary] = useState<SavedPieceSummary[]>([]);
  const [currentUploadError, setCurrentUploadError] = useState<{
    message: string;
    origin: UploadOrigin;
  } | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [sort, setSort] = useState<CatalogSort>("composer");
  const [now] = useState(Date.now);

  useEffect(() => {
    let active = true;
    catalogRepository
      .load()
      .then((entries) => {
        if (active) setCatalogEntries(entries);
      })
      .catch(() => {
        if (active) setCatalogUnavailable(true);
      });
    libraryRepository
      .list()
      .then((pieces) => {
        if (active) setLibrary(pieces);
      })
      .catch(() => {
        if (active) setLibrary([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(
    () => searchCatalog(catalogEntries, query, sort),
    [catalogEntries, query, sort],
  );

  async function saveAndOpen(piece: PieceDocument, originalName: string, bytes: Uint8Array) {
    // Re-opening a piece from search re-imports and re-saves it. Without this
    // the save reset lastSpeed to 1x and threw away the practice speed the
    // learner had settled on (D-030).
    let lastSpeed: PlaybackSpeed | undefined;
    try {
      lastSpeed = (await libraryRepository.get(piece.id))?.lastSpeed;
    } catch {
      lastSpeed = undefined;
    }

    const result = await libraryRepository.save({
      piece,
      originalName,
      originalBytes: bytes,
      lastSpeed,
    });
    if (!result.saved) {
      setStorageWarning(
        "This piece is usable for this session but was not saved locally because browser storage is full.",
      );
    }
    navigate(`/pieces/${encodeURIComponent(piece.id)}`, {
      state: { storageWarning: !result.saved },
    });
  }

  async function openCatalogEntry(entry: CatalogEntry) {
    setAssetError(null);
    setCurrentUploadError(null);
    try {
      const bytes = await catalogRepository.open(entry);
      const file = new File([bytes.slice().buffer], entry.asset);
      const imported = await importPiece(file);
      if (!imported.ok) throw new CatalogAssetError(imported.error.message);
      await saveAndOpen(
        {
          ...imported.piece,
          id: entry.id,
          title: entry.title,
          composer: entry.composer,
          source: "catalog",
          sourceCreator: entry.licence.creator,
        },
        entry.asset,
        bytes,
      );
    } catch {
      setAssetError(
        `The score file for “${entry.title}” could not be opened. Upload a MIDI or MusicXML copy below instead.`,
      );
    }
  }

  async function openUpload(file: File, origin: UploadOrigin) {
    setCurrentUploadError(null);
    setAssetError(null);
    const imported = await importPiece(file);
    if (!imported.ok) {
      setCurrentUploadError({ message: uploadError(file, imported.error), origin });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await saveAndOpen(imported.piece, file.name, bytes);
  }

  async function openSaved(piece: SavedPieceSummary) {
    await libraryRepository.touch(piece.id);
    navigate(`/pieces/${encodeURIComponent(piece.id)}`);
  }

  async function deleteSaved(piece: SavedPieceSummary) {
    await libraryRepository.delete(piece.id);
    setLibrary((current) => current.filter((candidate) => candidate.id !== piece.id));
  }

  return (
    <HomeView
      query={query}
      catalogEntries={catalogEntries}
      results={results}
      searched={searched}
      catalogUnavailable={catalogUnavailable}
      library={library}
      uploadError={currentUploadError?.message}
      uploadErrorOrigin={currentUploadError?.origin}
      assetError={assetError}
      storageWarning={storageWarning}
      now={now}
      sort={sort}
      onSortChange={setSort}
      onQueryChange={(nextQuery) => {
        setQuery(nextQuery);
        setSearched(nextQuery.length > 0);
        setCurrentUploadError(null);
        setAssetError(null);
      }}
      onClear={() => {
        setQuery("");
        setSearched(false);
        setCurrentUploadError(null);
        setAssetError(null);
      }}
      onUpload={(file, origin) => void openUpload(file, origin)}
      onOpenResult={(entry) => void openCatalogEntry(entry)}
      onOpenSaved={(piece) => void openSaved(piece)}
      onDelete={(piece) => void deleteSaved(piece)}
    />
  );
}
