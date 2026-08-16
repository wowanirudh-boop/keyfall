import { describe, expect, it } from 'vitest';

import { alpha, color } from './tokens';

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(1 + offset, 3 + offset), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance(value: Rgb) {
  const [red, green, blue] = value.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string | Rgb, second: string | Rgb) {
  const firstLuminance = luminance(typeof first === 'string' ? rgb(first) : first);
  const secondLuminance = luminance(typeof second === 'string' ? rgb(second) : second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function composite(foreground: string, alphaHex: string, background: string): Rgb {
  const foregroundRgb = rgb(foreground);
  const backgroundRgb = rgb(background);
  const opacity = Number.parseInt(alphaHex, 16) / 255;
  return foregroundRgb.map((channel, index) =>
    Math.round(channel * opacity + backgroundRgb[index] * (1 - opacity)),
  ) as [number, number, number];
}

describe('keyboard contrast palette', () => {
  it('[T15 AC1] carries D-047\'s exact keyboard colours and fill alphas', () => {
    expect(color).toMatchObject({
      keyWhiteFace: '#F0F2F6',
      keyBlackFace: '#0B0D11',
      keyWhiteBorder: '#767D88',
      keyBlackBorder: '#363D48',
      keyWhitePrepare: '#EAEDF3',
      keyBlackPrepare: '#12161C',
      keyWhiteLabel: '#5B626B',
      keyBlackLabel: '#9AA1AB',
      keyLitRing: '#06121A',
    });
    expect(alpha).toMatchObject({ prepareFill: '88' });
  });

  it('[T15 AC2] keeps every identification, label, state, and fill contrast above its WCAG floor', () => {
    expect(contrast(color.keyWhiteFace, color.keyBlackFace)).toBeGreaterThanOrEqual(3);
    expect(contrast(color.keyWhiteFace, color.keyWhiteBorder)).toBeGreaterThanOrEqual(3);
    expect(contrast(color.keyWhiteLabel, color.keyWhiteFace)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.keyBlackLabel, color.keyBlackFace)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.keyLitRing, color.keyWhiteFace)).toBeGreaterThanOrEqual(3);
    expect(contrast(color.keyLitRing, color.handRight)).toBeGreaterThanOrEqual(3);
    expect(contrast(color.error, color.keyWhiteFace)).toBeGreaterThanOrEqual(3);

    const blackCountdownFill = composite(
      color.handRight,
      alpha.prepareFill,
      color.keyBlackFace,
    );
    expect(contrast(blackCountdownFill, color.keyBlackFace)).toBeGreaterThanOrEqual(3);
  });
});
