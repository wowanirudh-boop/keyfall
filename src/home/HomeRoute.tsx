import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  CatalogAssetError,
  CatalogRepository,
  searchCatalog,
  type CatalogEntry,
} from "../catalog";
import { LibraryRepository, type SavedPieceSummary } from "../library";
import { importPiece, type ImportError, type PieceDocument } from "../music";
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

  const results = useMemo(() => searchCatalog(catalogEntries, query), [catalogEntries, query]);

  async function saveAndOpen(piece: PieceDocument, originalName: string, bytes: Uint8Array) {
    const result = await libraryRepository.save({ piece, originalName, originalBytes: bytes });
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
      results={results}
      searched={searched}
      catalogUnavailable={catalogUnavailable}
      library={library}
      uploadError={currentUploadError?.message}
      uploadErrorOrigin={currentUploadError?.origin}
      assetError={assetError}
      storageWarning={storageWarning}
      now={now}
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
