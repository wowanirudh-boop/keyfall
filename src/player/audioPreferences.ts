export interface AudioPreferences {
  muted: boolean;
  volume: number;
}

const MUTED_STORAGE_KEY = "piano-practice-player.muted";
const VOLUME_STORAGE_KEY = "piano-practice-player.volume";

export function readAudioPreferences(storage: Storage = localStorage): AudioPreferences {
  const storedVolume = storage.getItem(VOLUME_STORAGE_KEY);
  const parsedVolume = Number(storedVolume);
  const volume =
    storedVolume !== null &&
    Number.isFinite(parsedVolume) &&
    parsedVolume >= 0 &&
    parsedVolume <= 1
      ? parsedVolume
      : 1;

  return {
    muted: storage.getItem(MUTED_STORAGE_KEY) === "true",
    volume,
  };
}

export function writeMutedPreference(muted: boolean, storage: Storage = localStorage) {
  storage.setItem(MUTED_STORAGE_KEY, String(muted));
}

export function writeVolumePreference(volume: number, storage: Storage = localStorage) {
  storage.setItem(VOLUME_STORAGE_KEY, String(volume));
}
