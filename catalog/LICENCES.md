# Catalog licence audit

All 12 candidate rows are **verified** and present in `manifest.json`.
Verification is per downloaded asset, not per composition. Each row below records
the exact source page, licence, shipped filename, and SHA-256.

| Candidate | Status | Source page / licence | Shipped asset / SHA-256 |
|---|---|---|---|
| Für Elise | **Verified** | [Mutopia 931](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931) · Public Domain | `fur-elise.mid` · `1c12c21c7bbf4cf163896732672648a69d497636059837abd153c71abe50215a` |
| Gymnopédie No. 1 | **Verified** | [Mutopia 37](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37) · Public Domain | `gymnopedie-no-1.mid` · `09ce7337b4bf42ba12e1aa64b4c7dc7fcfa6455f1070cb12f8880a755df97384` |
| Moonlight Sonata I | **Verified** | [Mutopia 276](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=276) · CC-BY-SA-2.5 | `moonlight-sonata-i.mid` (the `moonlight1.mid` member of the linked MIDI archive) · `a34e969c4957f0e9e98fc9ff0278cc1284931bdae6d463469797faa2b73a9c5c` |
| Clair de Lune | **Verified** | [Mutopia 1778](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778) · Public Domain | `clair-de-lune.mid` · `4eee9a1546ffde1ff74cb9824ba0e57cbc821185a15185bfea9faed97820bf8c` |
| Prelude in C, BWV 846 | **Verified** | [Mutopia 5](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5) · Public Domain | `bach-bwv846.mid` · `874e07d0479542971bfceaf420d6117da8d602d89d26eea4610e7dd1ef58bf26` |
| Minuet in G | **Verified** | [Mutopia 75](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75) · Public Domain | `minuet-in-g.mid` · `fd87a6673e18104047842a1c858d2c9d8eb9ad845d7a8fa46e3664b17642cb75` |
| Mozart K.545 I | **Verified** | [Mutopia 998](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998) · CC-BY-SA-3.0 | `mozart-k545-i.mid` · `54e510ba1e5865aeedc4e96bf70b83c93ecddf5b66660033ef98a5a8204ab02d` |
| Chopin Prelude Op. 28 No. 4 | **Verified** | [Mutopia 468](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=468) · Public Domain | `chopin-prelude-op28-no4.mid` · `c1d7e05aa4e6e2baeec2e9108402a969c16d5df302b82fd66d110634697f2e3b` |
| Chopin Nocturne Op. 9 No. 2 | **Verified** | [Mutopia 1590](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590) · CC-BY-SA-3.0 | `chopin-nocturne-op9-no2.mid` · `e202d3941ce5f26397f57f59f0e2e4e3ad9e19061fa3c4dc596c5ee6a6a2548e` |
| Gnossienne No. 1 | **Verified** | [Mutopia 2035](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2035) · CC-BY-SA-4.0 | `gnossienne-no-1.mid` · `f49fc6c6653295e09350d64479d09b4c31091aa5dade81f2494383ab7e71708a` |
| Burgmüller Arabesque | **Verified** | [Mutopia 203](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=203) · Public Domain | `burgmuller-arabesque.mid` · `9b689a9b3f178e7bb2b5899d0559e223e9d8de7081d83fc087760ac2b4d378e1` |
| Schumann Melody | **Verified** | [Mutopia 647](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=647) · CC-BY-SA-2.5 | `schumann-melody.mid` · `f05a2e1f1fa397f4617d13d6b7bf679550ad9ae8032ed8c6b0f8446d519f5419` |

Licence texts: [Mutopia Public Domain statement](https://www.mutopiaproject.org/legal.html),
[CC-BY-SA-2.5](https://creativecommons.org/licenses/by-sa/2.5/),
[CC-BY-SA-3.0](https://creativecommons.org/licenses/by-sa/3.0/), and
[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Checksums were computed from the exact bytes stored in `catalog/scores/` after
download. The three existing `src/music/__fixtures__/real-scores/` files were
not promoted; their own README marks them test-only.
