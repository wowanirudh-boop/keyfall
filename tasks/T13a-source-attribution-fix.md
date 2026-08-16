# T13a — The player names the wrong source on second-source pieces

**Depends on:** T13 · **PRD:** F2 (legal guardrail) · **Decisions:** D-040, D-044

---

## Goal

`src/player/PlayerHeader.tsx:102` reads:

```ts
if (piece.source === "catalog") return "MUTOPIA CATALOG";
```

Every bundled piece is labelled `MUTOPIA CATALOG`. Until T13 that was true. It
is now false for 13 pieces: opening *Gaspard de la nuit* shows
`RAVEL · MUTOPIA CATALOG · BERND KRUEGER`, crediting a Mutopia typesetter who
had nothing to do with the file and naming a source that did not supply it.

**This is a licence-compliance defect, not a cosmetic one, and T13 introduced
it.** The cc-by-sa Germany licence requires attribution naming the creator *and*
the source (D-040). Displaying the wrong source is worse than displaying none:
it asserts a false provenance about Bernd Krueger's work and attaches Mutopia's
name to files Mutopia never produced. The app is publicly deployed, so this is
live.

The creator line is already correct — `piece.sourceCreator` renders "BERND
KRUEGER". Only the collection name is wrong.

## Deliverables

`PieceDocument` (`src/music/types.ts`) carries `source: PieceSource`, a coarse
enum with no room for *which* catalog. Add an optional field — name it
`sourceCollection?: string` unless you find a better fit — populated from the
manifest at import.

- Mutopia rows → `Mutopia Project`
- piano-midi.de rows → `piano-midi.de`

Derive it in the build or at import from data already in `manifest.json`
(`licence.url` distinguishes the two cleanly); do **not** hardcode a mapping
keyed by piece id, and do not infer it from the composer.

`sourceLabel()` uses the field when present. Uploads are unchanged.

**The fallback must be silence, not a guess.** Pieces already saved in a
learner's IndexedDB predate this field, so `sourceCollection` will be
`undefined` for them. When it is absent, render **no source label at all** —
composer and creator only. Printing `MUTOPIA CATALOG` as a default is exactly
the bug. Re-opening a catalog piece re-imports it and repopulates the field, so
existing libraries heal on next open without a migration.

Do not bump the database version. This is an optional field on a stored
document, not a schema change; T12b owns the v2 upgrade.

## Acceptance criteria

1. A piano-midi.de piece (e.g. Gaspard de la nuit, Moonlight complete,
   Winter Wind) shows `piano-midi.de` and `Bernd Krueger` in the player header,
   and never the word Mutopia.
2. A Mutopia piece still shows `Mutopia Project` and its typesetter.
3. A piece stored before this change, loaded without re-import, shows composer
   and creator and **no** source label — not a wrong one. Test this by seeding a
   stored document without the field.
4. Re-opening that piece from the catalog repopulates the label.
5. Uploaded MIDI and MusicXML pieces are unaffected.
6. No hardcoded id→source mapping anywhere; adding a third source later needs no
   change to `PlayerHeader.tsx`.
7. `npm run check` passes; no database version bump.

## Verify

```bash
npm run check
npm run build && npm run preview
```

Open one piano-midi.de piece and one Mutopia piece and read the header on each.

## Traps

- The header is a `·`-joined list that filters falsy values, so returning
  `undefined` from `sourceLabel()` already drops the segment cleanly. Do not
  emit an empty string or a placeholder.
- `catalog/LICENCES.md` and the per-row `licence` records are already correct
  (T13 criterion 4). This task changes what the **player** displays; it must not
  touch the licence data.
- Do not "improve" the wording to something like "BUNDLED CATALOG" that hides
  which source a file came from. Naming the source is the requirement.
