import {
  CatalogAssetError,
  type CatalogEntry,
  type CatalogRepository,
} from "./catalog";
import type { LibraryRepository } from "./library";
import { importPiece, type PieceDocument } from "./music";

type SaveRepository = Pick<LibraryRepository, "get" | "save">;

function sourceCollectionFromLicenceUrl(licenceUrl: string) {
  return licenceUrl === "http://piano-midi.de/copy.htm"
    ? "piano-midi.de"
    : "Mutopia Project";
}

export async function savePiecePreservingSpeed(
  repository: SaveRepository,
  piece: PieceDocument,
  originalName: string,
  bytes: Uint8Array,
) {
  const lastSpeed = await repository
    .get(piece.id)
    .then((stored) => stored?.lastSpeed)
    .catch(() => undefined);
  return repository.save({
    piece,
    originalName,
    originalBytes: bytes,
    lastSpeed,
  });
}

export async function importAndSaveCatalogEntry(
  entry: CatalogEntry,
  catalog: Pick<CatalogRepository, "open">,
  library: SaveRepository,
) {
  const bytes = await catalog.open(entry);
  const file = new File([bytes.slice().buffer], entry.asset);
  const imported = await importPiece(file);
  if (!imported.ok) throw new CatalogAssetError(imported.error.message);
  const result = await savePiecePreservingSpeed(
    library,
    {
      ...imported.piece,
      id: entry.id,
      title: entry.title,
      composer: entry.composer,
      source: "catalog",
      sourceCollection: sourceCollectionFromLicenceUrl(entry.licence.url),
      sourceCreator: entry.licence.creator,
    },
    entry.asset,
    bytes,
  );
  return { pieceId: entry.id, saved: result.saved };
}
