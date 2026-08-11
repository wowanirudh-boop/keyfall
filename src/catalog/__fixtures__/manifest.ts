import type { CatalogEntry } from "../CatalogRepository";

export const FIXTURE_ASSETS: Readonly<Record<string, Uint8Array>> = Object.freeze({
  "fur-elise.mid": new TextEncoder().encode("fur"),
  "gymnopedie-no-1.mid": new TextEncoder().encode("gym"),
  "arranged-study.mid": new TextEncoder().encode("arr"),
});

export const FIXTURE_MANIFEST: CatalogEntry[] = [
  {
    id: "fur-elise",
    title: "Für Elise",
    composer: "Ludwig van Beethoven",
    aliases: ["bagatelle no 25", "woo 59"],
    asset: "fur-elise.mid",
    format: "midi",
    durationSeconds: 130,
    licence: {
      name: "Public Domain",
      url: "https://example.test/licence",
      sourceUrl: "https://example.test/fur-elise.mid",
      sha256: "be1130b77b9d58d66a21ef4b2c84cfb3ea182c69d071d4032df5b17829d703c6",
    },
  },
  {
    id: "gymnopedie-no-1",
    title: "Gymnopédie No. 1",
    composer: "Erik Satie",
    aliases: ["first gymnopedie"],
    asset: "gymnopedie-no-1.mid",
    format: "midi",
    durationSeconds: 141,
    licence: {
      name: "Public Domain",
      url: "https://example.test/licence",
      sourceUrl: "https://example.test/gymnopedie-no-1.mid",
      sha256: "e326cff641fb950a5bdb458e0d52ec6809f041c1618e70bfd22dd61165882aad",
    },
  },
  {
    id: "arranged-study",
    title: "Catalog Study",
    composer: "Example Composer",
    arranger: "Example Arranger",
    aliases: ["teaching arrangement"],
    asset: "arranged-study.mid",
    format: "midi",
    durationSeconds: 65,
    licence: {
      name: "CC0-1.0",
      url: "https://example.test/licence",
      sourceUrl: "https://example.test/arranged-study.mid",
      sha256: "2e6839f29b1ea4ae7bedab9223832ba40e51fd637755656065729aca231e2c86",
    },
  },
];
