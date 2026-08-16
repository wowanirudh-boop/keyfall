import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  catalogRepository,
  loadCatalogAndPlaylists,
  type CatalogEntry,
  type LoadedPlaylist,
} from "../catalog";
import { MissingRecord, RouteShell } from "../design/RouteShell";
import { libraryRepository } from "../home/HomeRoute";
import { importAndSaveCatalogEntry } from "../openPiece";
import { PlaylistView } from "./PlaylistView";

export function PlaylistRoute() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<LoadedPlaylist | null | undefined>(null);
  const [assetError, setAssetError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadCatalogAndPlaylists()
      .then(({ playlists }) => {
        if (active) setPlaylist(playlists.find((candidate) => candidate.id === playlistId));
      })
      .catch(() => {
        if (active) setPlaylist(undefined);
      });
    return () => {
      active = false;
    };
  }, [playlistId]);

  async function openEntry(entry: CatalogEntry) {
    setAssetError(null);
    try {
      const result = await importAndSaveCatalogEntry(
        entry,
        catalogRepository,
        libraryRepository,
      );
      navigate(`/pieces/${encodeURIComponent(result.pieceId)}`, {
        state: { storageWarning: !result.saved },
      });
    } catch {
      setAssetError(`The score file for “${entry.title}” could not be opened.`);
    }
  }

  if (!playlistId || playlist === undefined) {
    return <MissingRecord title="This playlist is not available." />;
  }
  if (playlist === null) return <RouteShell label="Playlist" title="Opening playlist…" />;
  return (
    <PlaylistView
      playlist={playlist}
      assetError={assetError}
      onBack={() => navigate("/")}
      onOpen={(entry) => void openEntry(entry)}
    />
  );
}
