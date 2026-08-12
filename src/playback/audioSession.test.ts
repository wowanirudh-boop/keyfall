import { describe, expect, it, vi } from "vitest";

import {
  claimPlaybackAudioSession,
  createSilentSessionKeeper,
  keepContextRunning,
  needsSilentSessionKeeper,
  silentWavBytes,
} from "./audioSession";

describe("audioSession", () => {
  it("[D-024] declares the page a playback client when Safari exposes audioSession", () => {
    const audioSession = { type: "auto" };
    expect(claimPlaybackAudioSession({ audioSession } as unknown as Navigator)).toBe(true);
    expect(audioSession.type).toBe("playback");
  });

  it("[D-024] reports failure so the caller falls back to the silent element", () => {
    expect(claimPlaybackAudioSession({} as Navigator)).toBe(false);
    expect(claimPlaybackAudioSession(undefined)).toBe(false);

    const hostile = {
      get audioSession() {
        return {
          set type(_value: string) {
            throw new Error("locked");
          },
          get type() {
            return "auto";
          },
        };
      },
    };
    expect(claimPlaybackAudioSession(hostile as unknown as Navigator)).toBe(false);
  });

  it("[D-024] emits a WAV Safari will loop", () => {
    const bytes = silentWavBytes(1024);
    const text = new TextDecoder("latin1").decode(bytes.slice(0, 4));
    expect(text).toBe("RIFF");
    expect(new TextDecoder("latin1").decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(bytes.byteLength).toBe(44 + 1024 * 2);
    expect(bytes.slice(44).every((sample) => sample === 0)).toBe(true);
  });

  it("[D-024] resumes an interrupted context and stops listening when torn down", () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    const context = { state: "suspended", resume };

    const stop = keepContextRunning(context);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(resume).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("pointerdown"));
    expect(resume).toHaveBeenCalledTimes(2);

    stop();
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pointerdown"));
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it("[D-024] only pays for the silent element on devices that can be hardware-muted", () => {
    expect(needsSilentSessionKeeper({ maxTouchPoints: 5 } as Navigator)).toBe(true);
    expect(needsSilentSessionKeeper({ maxTouchPoints: 0 } as Navigator)).toBe(false);
    expect(needsSilentSessionKeeper(undefined)).toBe(false);
  });

  it("[D-024] puts the silent element in the document and takes it back out", () => {
    // jsdom has no media stack; play() rejecting is the expected path here.
    const keeper = createSilentSessionKeeper();
    keeper.start();

    const element = document.querySelector("audio");
    expect(element).not.toBeNull();
    expect(element?.loop).toBe(true);
    expect(element?.volume).toBe(0);
    expect(element?.getAttribute("playsinline")).toBe("");

    keeper.stop();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("[D-024] leaves a running context alone", () => {
    const running = { state: "running", resume: vi.fn() };
    const stop = keepContextRunning(running);

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("pageshow"));
    expect(running.resume).not.toHaveBeenCalled();

    stop();
  });
});
