import { CatalogRepository } from "./CatalogRepository";
import { PlaylistRepository } from "./PlaylistRepository";

export const catalogRepository = new CatalogRepository();
export const playlistRepository = new PlaylistRepository();

export async function loadCatalogAndPlaylists() {
  const loadedCatalog = catalogRepository.list();
  const catalog = loadedCatalog.length > 0 ? loadedCatalog : await catalogRepository.load();
  const loadedPlaylists = playlistRepository.list();
  const playlists =
    loadedPlaylists.length > 0 ? loadedPlaylists : await playlistRepository.load(catalog);
  return { catalog, playlists };
}
