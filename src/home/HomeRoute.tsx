import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  catalogRepository,
  playlistRepository,
  searchCatalog,
  type CatalogEntry,
  type CatalogSort,
  type LoadedPlaylist,
} from "../catalog";
import { LibraryRepository, type SavedPieceSummary } from "../library";
import { importPiece, type ImportError, type PieceDocument } from "../music";
import { importAndSaveCatalogEntry, savePiecePreservingSpeed } from "../openPiece";
import { HomeView, type UploadOrigin } from "./HomeView";

export const libraryRepository = new LibraryRepository();

function uploadError(file: File, error: ImportError) {
  return `“${file.name}” — ${error.message}`;
}

export function HomeRoute() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [playlists, setPlaylists] = useState<LoadedPlaylist[]>([]);
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
    void (async () => {
      let entries: CatalogEntry[];
      try {
        entries = await catalogRepository.load();
        if (active) setCatalogEntries(entries);
      } catch {
        if (active) setCatalogUnavailable(true);
        return;
      }
      try {
        const loadedPlaylists = await playlistRepository.load(entries);
        if (active) setPlaylists(loadedPlaylists);
      } catch {
        if (active) setPlaylists([]);
      }
    })();
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
    const result = await savePiecePreservingSpeed(
      libraryRepository,
      piece,
      originalName,
      bytes,
    );
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
      const result = await importAndSaveCatalogEntry(
        entry,
        catalogRepository,
        libraryRepository,
      );
      if (!result.saved) {
        setStorageWarning(
          "This piece is usable for this session but was not saved locally because browser storage is full.",
        );
      }
      navigate(`/pieces/${encodeURIComponent(result.pieceId)}`, {
        state: { storageWarning: !result.saved },
      });
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
      playlists={playlists}
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
      onOpenPlaylist={(playlist) =>
        navigate(`/playlists/${encodeURIComponent(playlist.id)}`)
      }
      onOpenSaved={(piece) => void openSaved(piece)}
      onDelete={(piece) => void deleteSaved(piece)}
    />
  );
}
