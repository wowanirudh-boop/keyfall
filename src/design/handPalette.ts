/**
 * Selectable hand colours (D-026).
 *
 * `tokens.ts` stays authoritative for the *default* pair — "Sky & ember" below
 * is `color.handRight` / `color.handLeft` verbatim, so an untouched install
 * renders exactly what the handoff specifies. The other pairs exist because the
 * handoff's single fixed pair is not readable for everyone, and because a dark
 * stage read at arm's length on an iPad is a different viewing condition from
 * the design mockup.
 *
 * Every pair is separable under deuteranopia and protanopia: the two colours
 * differ in luminance as well as hue, so they stay distinguishable even when
 * the hue difference collapses.
 */

import { color } from "./tokens";

export interface HandColorPair {
  id: string;
  name: string;
  right: string;
  left: string;
}

export const HAND_COLOR_PRESETS: readonly HandColorPair[] = Object.freeze([
  { id: "sky-ember", name: "Sky & ember", right: color.handRight, left: color.handLeft },
  { id: "ice-violet", name: "Ice & violet", right: '#5AD8CE', left: '#C08CFF' },
  { id: "lemon-indigo", name: "Lemon & indigo", right: '#F2D14E', left: '#7C8CFF' },
  { id: "mint-rose", name: "Mint & rose", right: '#4FD69C', left: '#FF6B9D' },
  { id: "paper-ink", name: "Paper & slate", right: '#E4E7EB', left: '#8B93FF' },
]);

export const DEFAULT_HAND_COLORS: HandColorPair = HAND_COLOR_PRESETS[0];

/** A hex colour the app is willing to render. Anything else falls back. */
export function isHandColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * CSS custom properties to stamp on the document root. Overriding the same
 * names Tailwind's `@theme` block emits keeps the utility classes
 * (`bg-hand-right`, `text-hand-right`) in step with the inline styles the
 * waterfall and keyboard compute.
 */
export function handColorVariables(right: string, left: string) {
  return {
    '--color-hand-right': right,
    '--color-hand-left': left,
    '--color-hand-right-toggle-on-bg': `${right}${'18'}`,
    '--shadow-note-right': `0 0 14px ${right}55`,
    '--shadow-note-left': `0 0 14px ${left}55`,
    '--shadow-pressed-key-right': `0 -2px 20px ${right}66`,
    '--shadow-pressed-key-left': `0 -2px 20px ${left}66`,
    '--shadow-prepare-key-right': `inset 0 -8px 14px ${right}22`,
    '--shadow-prepare-key-left': `inset 0 -8px 14px ${left}22`,
    '--shadow-playhead': `0 0 10px ${right}88`,
  } as const;
}
