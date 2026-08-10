import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  alpha,
  color,
  font,
  grading,
  keyboard,
  keyLabelSize,
  motion,
  radius,
  report,
  shadow,
  space,
  tunables,
  type,
  waterfall,
} from './tokens';

const css = readFileSync(resolve(process.cwd(), 'src/design/globals.css'), 'utf8');

function kebabCase(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
    .toLowerCase();
}

function stringEntries(prefix: string, values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [`--${prefix}-${kebabCase(name)}`, value]),
  );
}

function pixelEntries(prefix: string, values: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [`--${prefix}-${kebabCase(name)}`, `${value}px`]),
  );
}

describe('Tailwind theme contract', () => {
  it('matches every declared theme value to the authoritative TypeScript tokens', () => {
    const block = css.match(/@theme(?:\s+static)?\s*\{([\s\S]*?)\}/)?.[1];
    expect(block).toBeTruthy();

    const actual = Object.fromEntries(
      [...block!.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
    );
    const expected = {
      ...stringEntries('color', color),
      '--color-hand-right-toggle-on-bg': `${color.handRight}${alpha.toggleOnBg}`,
      ...stringEntries('alpha', alpha),
      ...Object.fromEntries(space.map((value) => [`--spacing-${value}`, `${value}px`])),
      ...pixelEntries('text', type),
      ...pixelEntries('text-key', keyLabelSize),
      ...pixelEntries('radius', radius),
      '--shadow-note-right': shadow.note(color.handRight),
      '--shadow-note-left': shadow.note(color.handLeft),
      '--shadow-pressed-key-right': shadow.pressedKey(color.handRight),
      '--shadow-pressed-key-left': shadow.pressedKey(color.handLeft),
      '--shadow-prepare-key-right': shadow.prepareKey(color.handRight),
      '--shadow-prepare-key-left': shadow.prepareKey(color.handLeft),
      '--shadow-error-key': shadow.errorKey,
      '--shadow-playhead': shadow.playhead,
      '--duration-key-background': `${motion.keyBackgroundMs}ms`,
      '--duration-key-label': `${motion.keyLabelMs}ms`,
      '--duration-notice': `${motion.noticeMs}ms`,
      ...stringEntries('font', font),
      '--lookahead-seconds': String(tunables.lookaheadSeconds),
      '--highlight-lead-time-seconds': String(tunables.highlightLeadTimeSeconds),
      '--key-label-mode': tunables.keyLabels,
      '--listen-auto-start': String(Number(tunables.listenAutoStart)),
      '--keyboard-midi-low': String(keyboard.midiLow),
      '--keyboard-midi-high': String(keyboard.midiHigh),
      '--keyboard-white-count': String(keyboard.whiteCount),
      '--keyboard-black-count': String(keyboard.blackCount),
      '--keyboard-black-pitch-classes': keyboard.blackPitchClasses.join(' '),
      '--keyboard-black-width-ratio': String(keyboard.blackWidthRatio),
      '--keyboard-black-height-ratio': String(keyboard.blackHeightRatio),
      '--keyboard-height': keyboard.heightCss,
      '--waterfall-note-width-ratio': String(waterfall.noteWidthRatio),
      '--waterfall-note-margin-left-ratio': String(waterfall.noteMarginLeftRatio),
      '--waterfall-min-note-height': `${waterfall.minNoteHeightPx}px`,
      '--report-bucket-count': String(report.bucketCount),
      '--report-hot-bucket-threshold': String(report.hotBucketThreshold),
      '--grading-tolerance': `${grading.toleranceMs}ms`,
      '--grading-candidate-window': `${grading.candidateWindowMs}ms`,
      '--grading-error-flash-musical-seconds': String(grading.errorFlashMusicalSeconds),
    };

    expect(actual).toEqual(expected);
  });
});
