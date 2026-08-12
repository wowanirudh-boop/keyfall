import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_HAND_COLORS,
  handColorVariables,
  isHandColor,
  type HandColorPair,
} from "../design/handPalette";
import type { NoteHand } from "../music/types";

/**
 * How the two staves of a score are painted.
 *
 * `score` is the default and the honest one: a note is coloured by the staff it
 * is written on. Scores where the hands genuinely trade a figure back and forth
 * — Für Elise's coda alternates the E/D♯ tremolo between hands for two beats —
 * therefore alternate colour, which reads as a glitch until you know that is
 * the score talking. `single` is the escape hatch for those passages, and for
 * files whose staff split is simply wrong (D-026).
 */
export type HandDisplayMode = "score" | "swapped" | "single";

export interface HandColorSettings {
  right: string;
  left: string;
  mode: HandDisplayMode;
}

const RIGHT_STORAGE_KEY = "piano-practice-player.handRight";
const LEFT_STORAGE_KEY = "piano-practice-player.handLeft";
const MODE_STORAGE_KEY = "piano-practice-player.handMode";

const DISPLAY_MODES: readonly HandDisplayMode[] = ["score", "swapped", "single"];

export const DEFAULT_HAND_SETTINGS: HandColorSettings = {
  right: DEFAULT_HAND_COLORS.right,
  left: DEFAULT_HAND_COLORS.left,
  mode: "score",
};

function safeStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Safari private browsing throws on access rather than returning null.
    return null;
  }
}

export function readHandSettings(storage?: Storage): HandColorSettings {
  const store = safeStorage(storage);
  if (!store) return DEFAULT_HAND_SETTINGS;

  const right = store.getItem(RIGHT_STORAGE_KEY);
  const left = store.getItem(LEFT_STORAGE_KEY);
  const mode = store.getItem(MODE_STORAGE_KEY);

  return {
    right: isHandColor(right) ? right : DEFAULT_HAND_SETTINGS.right,
    left: isHandColor(left) ? left : DEFAULT_HAND_SETTINGS.left,
    mode: DISPLAY_MODES.includes(mode as HandDisplayMode)
      ? (mode as HandDisplayMode)
      : DEFAULT_HAND_SETTINGS.mode,
  };
}

export function writeHandSettings(settings: HandColorSettings, storage?: Storage) {
  const store = safeStorage(storage);
  if (!store) return;
  try {
    store.setItem(RIGHT_STORAGE_KEY, settings.right);
    store.setItem(LEFT_STORAGE_KEY, settings.left);
    store.setItem(MODE_STORAGE_KEY, settings.mode);
  } catch {
    // A full or locked storage must not take the player down with it.
  }
}

/**
 * Which of the two colours a note is painted in. Pure so the waterfall, the
 * keyboard and the legend cannot drift apart.
 */
export function displayHand(
  hand: NoteHand,
  hasHandData: boolean,
  mode: HandDisplayMode,
): "left" | "right" {
  if (!hasHandData || mode === "single") return "right";
  const isLeft = hand === "left";
  return (mode === "swapped" ? !isLeft : isLeft) ? "left" : "right";
}

export interface HandColorContextValue extends HandColorSettings {
  setColors(pair: Pick<HandColorPair, "right" | "left">): void;
  setMode(mode: HandDisplayMode): void;
  reset(): void;
  /** Colour for a note, already resolved through the display mode. */
  colorFor(hand: NoteHand, hasHandData: boolean): string;
}

const HandColorContext = createContext<HandColorContextValue | null>(null);

export function HandColorProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage?: Storage;
}) {
  const [settings, setSettings] = useState<HandColorSettings>(() => readHandSettings(storage));

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const variables = handColorVariables(settings.right, settings.left);
    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value);
    }
  }, [settings.left, settings.right]);

  const update = useCallback(
    (next: HandColorSettings) => {
      setSettings(next);
      writeHandSettings(next, storage);
    },
    [storage],
  );

  const value = useMemo<HandColorContextValue>(
    () => ({
      ...settings,
      setColors: (pair) => update({ ...settings, right: pair.right, left: pair.left }),
      setMode: (mode) => update({ ...settings, mode }),
      reset: () => update(DEFAULT_HAND_SETTINGS),
      colorFor: (hand, hasHandData) =>
        displayHand(hand, hasHandData, settings.mode) === "left" ? settings.left : settings.right,
    }),
    [settings, update],
  );

  return <HandColorContext.Provider value={value}>{children}</HandColorContext.Provider>;
}

/**
 * Falls back to the defaults outside a provider so isolated component tests and
 * the design primitives keep rendering.
 */
export function useHandColors(): HandColorContextValue {
  const context = useContext(HandColorContext);
  if (context) return context;
  return {
    ...DEFAULT_HAND_SETTINGS,
    setColors: () => undefined,
    setMode: () => undefined,
    reset: () => undefined,
    colorFor: (hand, hasHandData) =>
      displayHand(hand, hasHandData, DEFAULT_HAND_SETTINGS.mode) === "left"
        ? DEFAULT_HAND_SETTINGS.left
        : DEFAULT_HAND_SETTINGS.right,
  };
}
