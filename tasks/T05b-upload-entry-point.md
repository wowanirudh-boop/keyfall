# T05b — Upload must be reachable without failing a search first

**Depends on:** T03
**Handoff sections:** README §1 Home, §2 no-results/upload card
**PRD:** F1, F2 · **Decisions:** D-017 (the offline half of this problem), D-021

---

## The bug

Verified live: on the default Home screen — catalog working, search box empty —
**there is no upload control anywhere on the page.** The only way to upload a
file is to type a query that matches nothing, so the no-results card appears.

A learner who has just downloaded a MIDI file has to first search for something
they know does not exist. That is not a discoverable path.

This is inherited from the handoff, where upload lives only inside the §2
no-results card. D-017 already found the same hole in the *offline* state and
fixed it there; this is the same problem in the normal state, and the fix should
be consistent with it.

## The fix

Give **My pieces** a permanent upload affordance. That section is the learner's
own library, it is always visible, and "add a piece to my library" belongs there
far more naturally than beside a catalog search box.

- A compact upload control in the **My pieces heading row**, right-aligned,
  opposite the "N SAVED LOCALLY" label.
- Style it as the existing `GhostButton` (§4 ghost button: `1px solid
  color.border3`, 12px, `color.secondary`, hover `color.text` / `color.border5`).
  It is a secondary action here — the primary blue upload button stays as-is
  inside the no-results card, where it is the main thing being offered.
- Same `<label>` wrapping a hidden file input as §2, so behaviour, validation,
  accepted formats and error handling are identical. **Reuse the component; do
  not write a second upload path.**
- The empty-library dashed panel keeps its exact handoff copy. Do not rewrite it
  into a call to action.
- Upload errors render the same §2 error treatment, in place, wherever the
  upload was initiated from.

## Acceptance criteria

1. On a fresh Home with an empty query and a working catalog, an upload control
   is present and functional.
2. It is reachable with the library empty **and** populated.
3. Uploading from it produces exactly the same result as uploading from the
   no-results card — same validation, same errors, same piece in the library.
4. All five upload failures still render their specific message, in place,
   without navigating away.
5. The no-results card is unchanged; its primary upload button still works.
6. The offline/catalog-unavailable state (D-017) still shows its upload card and
   does not now show two competing upload controls.
7. Home layout is unchanged at 1440×900 and 1024×768 apart from this control;
   no horizontal scroll, screenshots saved for both.

## Verify

```bash
npm test -- src/home
npm run test:e2e -- --grep "upload"
npm run check
```

## Done

- [ ] Seven criteria asserted, 1 and 6 explicitly
- [ ] One upload implementation, two entry points — verified by reading the code,
      not just the tests
- [ ] D-021 recorded

## Traps

- Do not duplicate the file-input logic. Two upload paths means two places for
  validation to drift.
- Do not turn the empty-library panel into the upload affordance. Once the
  learner has pieces it disappears, and the problem returns.
