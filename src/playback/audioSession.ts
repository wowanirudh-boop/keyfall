/**
 * iOS keeps Web Audio in the "ambient" audio session by default, and an ambient
 * session is silenced by the iPhone's physical Ring/Silent switch — with no
 * error, no state change and a context that still reports "running". iPads have
 * no such switch, which is why the same build is audible there and silent on a
 * phone (D-024).
 *
 * Two escapes, in order of preference:
 *   1. `navigator.audioSession.type = "playback"` (Safari 16.4+) — declares the
 *      page a media player, which outranks the silent switch.
 *   2. A silent looping <audio> element — an HTMLMediaElement pulls the page
 *      into the media session on older iOS. Costs a decoder, so it is only used
 *      when (1) is unavailable.
 *
 * Both must be triggered inside the user gesture that starts playback.
 */

interface AudioSessionLike {
  type: string;
}

type NavigatorWithAudioSession = Navigator & { audioSession?: AudioSessionLike };

/**
 * Declares this page a media-playback client so iOS ignores the ringer switch.
 * Returns false when the API is missing (every non-Safari browser, iOS < 16.4),
 * which is the signal to fall back to {@link createSilentSessionKeeper}.
 */
export function claimPlaybackAudioSession(
  navigatorLike: NavigatorWithAudioSession | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
): boolean {
  const session = navigatorLike?.audioSession;
  if (!session) return false;
  try {
    session.type = "playback";
    return true;
  } catch {
    return false;
  }
}

/** 1024 frames of silence, 8 kHz mono PCM — the smallest loop Safari accepts. */
export function silentWavBytes(frames = 1024) {
  const bytes = new Uint8Array(44 + frames * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + frames * 2, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM header length
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // sample rate
  view.setUint32(28, 16_000, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, frames * 2, true);
  return bytes;
}

export interface SilentSessionKeeper {
  /** Must be called inside a user gesture. */
  start(): void;
  stop(): void;
}

/**
 * Only devices that can actually be muted by hardware need this. A desktop
 * browser has no ringer switch, so it would pay for a permanently looping
 * decoder and get nothing back.
 */
export function needsSilentSessionKeeper(
  navigatorLike: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator,
) {
  return (navigatorLike?.maxTouchPoints ?? 0) > 0;
}

export function createSilentSessionKeeper(): SilentSessionKeeper {
  let element: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;

  return {
    start() {
      if (typeof document === "undefined" || element) return;
      objectUrl = URL.createObjectURL(new Blob([silentWavBytes()], { type: "audio/wav" }));
      element = document.createElement("audio");
      element.src = objectUrl;
      element.loop = true;
      element.volume = 0;
      element.setAttribute("playsinline", "");
      element.setAttribute("aria-hidden", "true");
      element.style.display = "none";
      // Detached media elements are unreliable on iOS; it has to be in the tree.
      document.body.append(element);
      // Older Safari returns undefined from play() rather than a promise.
      void Promise.resolve(element.play()).catch(() => undefined);
    },
    stop() {
      element?.pause();
      element?.remove();
      element = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    },
  };
}

export interface ResumableContext {
  readonly state: string;
  resume(): Promise<void>;
}

/**
 * iOS suspends (state "suspended") or interrupts (Safari-only "interrupted")
 * the context when the screen locks, a call arrives or the tab backgrounds, and
 * never resumes it on its own. Without this the transport keeps ticking against
 * a frozen clock and the piece plays in silence.
 */
export function keepContextRunning(context: ResumableContext) {
  const resume = () => {
    if (context.state === "running") return;
    void context.resume().catch(() => undefined);
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", resume);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pointerdown", resume);
  }

  return () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", resume);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pointerdown", resume);
    }
  };
}
