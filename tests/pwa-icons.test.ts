import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { color } from "../src/design/tokens";

const EXPECTED_ICONS = {
  "apple-touch-icon.png": 180,
  "icon-192.png": 192,
  "icon-512-maskable.png": 512,
  "icon-512.png": 512,
} as const;

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(",");
}

function readPng(path: string) {
  const png = readFileSync(path);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const compressed: Buffer[] = [];

  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") compressed.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  return { width, height, pixels: inflateSync(Buffer.concat(compressed)) };
}

describe("T10 PWA icons", () => {
  it("[T10 AC7, AC9] ships exactly the four D-035 two-colour install icons", () => {
    const iconDirectory = resolve("public/icons");
    expect(readdirSync(iconDirectory).sort()).toEqual(Object.keys(EXPECTED_ICONS).sort());

    const expectedColours = [rgb(color.bg), rgb(color.handRight)].sort();
    for (const [name, size] of Object.entries(EXPECTED_ICONS)) {
      const { width, height, pixels } = readPng(resolve(iconDirectory, name));
      expect({ width, height }).toEqual({ width: size, height: size });

      const stride = 1 + width * 3;
      const colours = new Set<string>();
      for (let y = 0; y < height; y += 1) {
        const row = y * stride;
        expect(pixels[row]).toBe(0);
        for (let x = 0; x < width; x += 1) {
          const pixel = row + 1 + x * 3;
          colours.add(`${pixels[pixel]},${pixels[pixel + 1]},${pixels[pixel + 2]}`);
        }
      }
      expect([...colours].sort()).toEqual(expectedColours);
    }
  });
});
