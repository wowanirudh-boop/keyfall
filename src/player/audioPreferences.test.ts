import { describe, expect, it } from "vitest";

import {
  readAudioPreferences,
  writeMutedPreference,
  writeVolumePreference,
} from "./audioPreferences";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("player audio preferences", () => {
  it("[T05a AC3] defaults to 100% and restores persisted volume and mute", () => {
    const storage = memoryStorage();
    expect(readAudioPreferences(storage)).toEqual({ muted: false, volume: 1 });

    writeVolumePreference(0.37, storage);
    writeMutedPreference(true, storage);

    expect(readAudioPreferences(storage)).toEqual({ muted: true, volume: 0.37 });
  });
});
