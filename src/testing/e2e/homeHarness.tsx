import { createRoot } from "react-dom/client";

import { FIXTURE_MANIFEST } from "../../catalog/__fixtures__/manifest";
import "../../design/globals.css";
import { HomeView } from "../../home";
import type { SavedPieceSummary } from "../../library";
import { IMPORT_ERROR_MESSAGES, type ImportErrorKind } from "../../music";

const state = new URLSearchParams(window.location.search).get("state") ?? "empty";
const errorKind = state.startsWith("upload-")
  ? (state.slice("upload-".length) as ImportErrorKind)
  : null;
const saved: SavedPieceSummary[] = [
  {
    id: "saved-fixture",
    title: "Für Elise",
    composer: "Ludwig van Beethoven",
    duration: 130,
    lastOpened: 0,
    lastSpeed: 0.5,
  },
];
const query =
  state === "results" || state === "asset-failure"
    ? "fur elise"
    : state === "query"
      ? "moonlight"
      : state === "no-results" || errorKind
        ? "Nuvole Bianche"
        : "";

createRoot(document.getElementById("root")!).render(
  <HomeView
    query={query}
    results={
      state === "results"
        ? FIXTURE_MANIFEST.slice(0, 2)
        : state === "asset-failure"
          ? [FIXTURE_MANIFEST[0]]
          : []
    }
    searched={Boolean(query)}
    catalogUnavailable={state === "catalog-unavailable"}
    library={state === "populated" || state === "catalog-unavailable" ? saved : []}
    uploadError={errorKind ? `“score.mid” — ${IMPORT_ERROR_MESSAGES[errorKind]}` : null}
    assetError={
      state === "asset-failure"
        ? "The score file for “Für Elise” could not be opened. Upload a MIDI or MusicXML copy below instead."
        : null
    }
    now={0}
    onQueryChange={() => undefined}
    onClear={() => undefined}
    onUpload={() => undefined}
    onOpenResult={() => undefined}
    onOpenSaved={() => undefined}
    onDelete={() => undefined}
  />,
);
