# T05a — Volume control in the player header

**Depends on:** T04a (fix the velocity bug first — do not tune loudness against
broken gain staging)
**Handoff sections:** README §4 header, §4 transport row 1 (seek bar styling)
**PRD:** F3 — "Volume slider is P1" · **Decisions:** D-020

---

## Why this exists

The PRD shipped a mute toggle and deferred a volume slider to P1. Real use showed
that was the wrong call: mute is all-or-nothing, and the core V1 activity is
**playing along with the reference audio**. For that you need the app quieter
than your own piano — not silent, not full. Device volume cannot do this, because
it moves the app and everything else together.

## Behaviour

- A compact horizontal slider in the player header, immediately **left of the
  existing "Audio on / Muted" toggle**, so the two audio controls sit together.
- Range 0–100%. **Default 100%**, persisted in `localStorage` alongside the mute
  preference (`BUILD_PLAN.md` §Persistence).
- **Perceptual mapping, not linear.** Loudness perception is roughly logarithmic;
  a linear slider crams everything useful into the bottom third and feels broken.
  Map slider position `p` to gain as `p²` (or an equivalent dB curve) so the
  midpoint sounds like "about half".
- **Volume and mute are independent.** Muting does not reset the volume; unmuting
  restores the previous level. Dragging volume to 0 is not the same as muting —
  the mute pill's state must not silently change underneath the user.
- Pointer-event driven with `setPointerCapture`, identical for mouse and touch,
  exactly like the seek bar. `touch-action: none`.
- Changing volume never affects playback position or scheduling.

## Styling — reuse, do not invent

This element is not in the handoff (D-020), so it borrows the seek bar's existing
visual language rather than introducing a new one:

- Track: 4px tall, `radius.chip`, `color.border3`.
- Filled portion: `color.handRight`.
- Handle: a small circle in `color.text`, sized to the header's scale.
- Width: compact — roughly 64–80px, so the header still fits at 1024px wide with
  the ← Library button, title, hand legend, both toggles and this control.
- No numeric percentage label, no icon. The handoff ships zero image assets and
  its controls are unlabelled where the affordance is obvious.

## Acceptance criteria

1. Moving the slider changes output gain and **nothing else** — position,
   playing state, speed and scheduling are untouched.
2. The mapping is perceptual: gain at 50% is `0.25` (`p²`), not `0.5`.
3. Volume persists across a full page reload and browser restart.
4. Mute at any volume silences completely; unmuting restores that same volume.
5. Setting volume to 0 leaves the mute toggle reading "Audio on" — the two
   controls stay independent.
6. Mouse and synthetic touch drags produce identical values; the page never
   scrolls while dragging.
7. The header still fits with no horizontal scroll and no wrapping at both
   1440×900 and 1024×768, with every existing header element still present.
8. Volume survives opening a different piece within the session.

## Verify

```bash
npm test -- src/player
npm run test:e2e -- --grep "volume|header"
npm run check
npm run build && npm run preview -- --host   # confirm by ear on the iPad
```

## Done

- [ ] Eight criteria asserted, 2 and 5 explicitly
- [ ] Header verified at both viewports with a screenshot per state saved under
      `test-results/visual/`
- [ ] D-020 recorded before the component was built, not after

## Traps

- Do not fold volume into the mute toggle as a three-state control. Mute is a
  fast, reversible "shut up now" while playing; volume is a set-and-forget level.
  Merging them makes the fast action slow.
- Do not add a percentage readout or a speaker icon. Neither exists in the
  handoff's vocabulary.
- The header is already dense at 1024px. If it does not fit, report that rather
  than dropping an existing element to make room.
