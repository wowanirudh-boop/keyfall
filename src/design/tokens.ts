/**
 * Design tokens — extracted verbatim from the design handoff.
 *
 * AUTHORITATIVE. Every colour, radius, spacing step, shadow and duration in the
 * app must come from this file. Raw hex literals anywhere else under src/ are a
 * build failure (see scripts/check-guardrails.mjs).
 *
 * Source: "PRD design scope discussion/design_handoff_piano_practice_player/README.md"
 *         + "Piano Practice Player.dc.html"
 * Do not add, rename or "improve" tokens. If a value is missing, it is missing
 * from the design too — stop and ask rather than inventing one.
 */

export const color = {
  // Surfaces
  bg: '#0B0C0E',
  stage: '#0A0B0D',
  /** Waterfall background gradient runs stage -> stageGradientEnd. */
  stageGradientEnd: '#0D0F13',
  /** 1px rule at the bottom of the waterfall; a note touching it is sounding. */
  strikeLine: '#2A2F36',
  panel: '#0E1013',
  card: '#101216',
  raised: '#14161A',
  control: '#1D2026',
  controlHover: '#262A31',
  backdrop: 'rgba(6,7,9,0.78)',

  // Borders (ascending prominence)
  border1: '#1A1D22',
  border2: '#1D2026',
  border3: '#23262C',
  border4: '#2C3037',
  border5: '#3A3F47',

  // Text
  text: '#E8EAED',
  secondary: '#8A9099',
  monoDim1: '#6B727C',
  monoDim2: '#5B626B',
  monoDim3: '#3E444C',
  onAccent: '#06121A',

  // Keyboard
  keyWhiteFace: '#F0F2F6',
  keyBlackFace: '#0B0D11',
  keyWhiteBorder: '#767D88',
  /** Dimension only: keyBlackBorder is not the contrast cue that identifies a black key. */
  keyBlackBorder: '#363D48',
  keyWhitePrepare: '#EAEDF3',
  keyBlackPrepare: '#12161C',
  keyWhiteLabel: '#5B626B',
  keyBlackLabel: '#9AA1AB',
  keyLitRing: '#06121A',

  // Hands
  handRight: '#4CC2FF',
  handRightHover: '#77D2FF',
  handRightTint: '#0E2331',
  handLeft: '#FF7A45',

  // Search result hover
  resultHoverBorder: '#34576B',
  resultHoverBg: '#131820',

  // Amber / loop / notices
  amber: '#FFB25E',
  amberBg: '#1B1509',
  amberBorder: '#4A3A22',
  amberBorderDim: '#2E2513',
  amberText: '#E0C9A5',
  amberTextDim: '#C9A874',
  noticeBg: '#14110A',

  // Error
  error: '#FF3B6B',
  errorBg: '#1A0E14',
  errorBorder: '#4A2230',
  errorText: '#F0B9C6',
  errorKeyBorder: '#FF6E90',
  errorKeyLabel: '#2A0A12',

  // Listening
  listening: '#3ED598',
  listeningText: '#7FD4AE',
  listeningBg: '#0D1512',
  listeningBorder: '#2A3B33',
} as const;

/**
 * Alpha suffixes appended to a base colour — the handoff writes 8-digit hex.
 * Named by use site, so two entries may share a value.
 */
export const alpha = {
  noteGlow: '55',
  pressedGlow: '66',
  prepareInset: '22',
  prepareBorder: '88',
  toggleOnBg: '18',
  /** Countdown fill on a prepared key (D-022). */
  prepareFill: '88',
  /** A–B loop region fill over the seek bar. */
  loopFill: '1F',
  /** A–B loop region border. */
  loopBorder: '55',
  /** Ordinary (non-hot) bar in the report's mistake timeline. */
  timelineBar: '66',
  /** Error glow on a flashed key. */
  errorGlow: '88',
} as const;

/**
 * The handoff's declared spacing scale. This is a REFERENCE, not an allowlist —
 * individual components in the handoff README specify exact paddings that are
 * not on this scale (e.g. `7px 11px` on the toggle pill, `9px 22px` on the
 * notice strip, `40px 32px 120px` on the Home page). Those per-component values
 * are authoritative; use them literally and reach for this scale only where the
 * handoff does not state a value.
 */
export const space = [3, 4, 6, 7, 8, 10, 12, 14, 16, 18, 22, 26, 30, 36, 40] as const;

/**
 * Type scale in px. Same rule as `space`: where the handoff states a size for a
 * specific element, that wins. These are the recurring sizes.
 */
export const type = {
  display: 46,   // report stat numerals, 700, -0.03em
  title: 19,     // wordmark, 700, -0.01em
  heading: 17,   // modal title, 500
  subheading: 15,// screen/section titles, 500
  body: 14,
  bodySm: 13,
  small: 12,
  monoCount: 24, // mistake-type counts
  monoTime: 13,  // transport time readout
  monoMeta: 11,  // metadata rows, footnotes
  monoLabel: 10, // uppercase section labels, 0.1em tracking
  monoTiny: 9,   // A/B marker chips
} as const;

export const radius = {
  chip: 2,
  note: 3,
  keyWhite: 4,
  button: 5,
  input: 6,
  deviceRow: 7,
  card: 8,
  modal: 10,
  pill: 20,
} as const;

export const shadow = {
  note: (hand: string) => `0 0 14px ${hand}${alpha.noteGlow}`,
  pressedKey: (hand: string) => `0 -2px 20px ${hand}${alpha.pressedGlow}`,
  prepareKey: (hand: string) => `inset 0 -8px 14px ${hand}${alpha.prepareInset}`,
  errorKey: `0 0 18px ${color.error}${alpha.errorGlow}`,
  playhead: `0 0 10px ${color.handRight}88`,
} as const;

export const motion = {
  /** Key background colour transition. */
  keyBackgroundMs: 40,
  /** Key label font-size transition — the "font goes bigger" cue. */
  keyLabelMs: 60,
  /** Transient notice strip auto-dismiss. */
  noticeMs: 4200,
} as const;

export const font = {
  ui: "'Space Grotesk', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

/** Key label sizes in px — idle vs pressed/error. The jump IS the design cue. */
export const keyLabelSize = {
  whiteIdle: 9,
  whitePressed: 13,
  blackIdle: 7,
  blackPressed: 10,
} as const;

/**
 * Tunable constants exposed in the prototype. Keep as constants, NOT a settings
 * screen (PRD explicitly excludes settings expansion).
 */
export const tunables = {
  /** Musical seconds of waterfall visible above the strike line. */
  lookaheadSeconds: 3,
  /** Musical seconds a key enters "prepare" state before its note sounds. */
  highlightLeadTimeSeconds: 1.0,
  /** Key label mode. */
  keyLabels: 'all' as 'all' | 'naturals' | 'c-only',
  /**
   * Listen mode starts playback immediately when a device is picked (handoff
   * behaviour, "Piano Practice Player.dc.html" device pick handler).
   * Flip to false for an armed/ready state — see docs/decisions.md D-009.
   */
  listenAutoStart: true,
} as const;

export const keyboard = {
  /** MIDI note range: A0 (21) .. C8 (108) = 88 keys, 52 white + 36 black. */
  midiLow: 21,
  midiHigh: 108,
  whiteCount: 52,
  blackCount: 36,
  /** Pitch classes that are black keys. */
  blackPitchClasses: [1, 3, 6, 8, 10] as const,
  /** Black key width as a fraction of white key width. */
  blackWidthRatio: 0.62,
  /** Black key height as a fraction of keyboard height. */
  blackHeightRatio: 0.62,
  heightCss: 'clamp(112px, 15vh, 158px)',
} as const;

export const waterfall = {
  /** Note width as a fraction of its key lane, with symmetric-ish left margin. */
  noteWidthRatio: 0.86,
  noteMarginLeftRatio: 0.07,
  /** Minimum rendered note height in px so grace notes stay visible. */
  minNoteHeightPx: 5,
} as const;

export const report = {
  /** Fixed timeline bucket count. Divides the FULL piece duration. */
  bucketCount: 26,
  /** A bucket at or above this fraction of the max renders in the error colour. */
  hotBucketThreshold: 0.7,
} as const;

export const grading = {
  /** Correct-vs-early/late boundary, real milliseconds. */
  toleranceMs: 300,
  /** Outer window for pairing a played note to an expectation, real milliseconds. */
  candidateWindowMs: 900,
  /** Error flash duration on the keyboard, in MUSICAL seconds (prototype uses 0.35). */
  errorFlashMusicalSeconds: 0.35,
} as const;
