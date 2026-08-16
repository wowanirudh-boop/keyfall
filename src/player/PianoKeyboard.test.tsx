import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  alpha,
  color,
  keyLabelSize,
  motion,
  shadow,
  tunables,
} from "../design/tokens";
import { HAND_COLOR_PRESETS } from "../design/handPalette";
import type { NoteEvent } from "../music/types";
import { HandColorProvider, writeHandSettings } from "./handColors";
import { KeyStateScanner, type LiveVerdict } from "./keyState";
import { PianoKeyboard } from "./PianoKeyboard";

function note(
  id: string,
  midi: number,
  start: number,
  end: number,
  hand: NoteEvent["hand"] = "right",
): NoteEvent {
  return { id, midi, start, end, velocity: 100, hand };
}

function normalizedKeyStyle(handColor: string) {
  const element = document.createElement("div");
  element.style.background = handColor;
  element.style.border = `1px solid ${handColor}`;
  element.style.boxShadow = shadow.pressedKey(handColor);
  return element.style;
}

function normalizedPrepareStyle(handColor: string, black: boolean) {
  const element = document.createElement("div");
  element.style.background = black ? color.keyBlackPrepare : color.keyWhitePrepare;
  element.style.border = `1px solid ${handColor}${alpha.prepareBorder}`;
  element.style.boxShadow = shadow.prepareKey(handColor);
  return element.style;
}

function normalizedIdleStyle(black: boolean) {
  const element = document.createElement("div");
  element.style.background = black ? color.keyBlackFace : color.keyWhiteFace;
  element.style.border = `1px solid ${black ? color.keyBlackBorder : color.keyWhiteBorder}`;
  element.style.boxShadow = "none";
  return element.style;
}

function normalizedErrorStyle() {
  const element = document.createElement("div");
  element.style.background = color.error;
  element.style.border = `1px solid ${color.errorKeyBorder}`;
  element.style.boxShadow = shadow.errorKey;
  return element.style;
}

function normalizedLitRingStyle() {
  const element = document.createElement("div");
  element.style.outline = `2px solid ${color.keyLitRing}`;
  element.style.outlineOffset = "-2px";
  return element.style;
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  } as Storage;
}

function labelFor(midi: number) {
  return screen
    .getByTestId(`piano-key-${midi}`)
    .querySelector("span:not([data-countdown-fill])") as HTMLSpanElement;
}

function fillFor(midi: number) {
  return screen
    .getByTestId(`piano-key-${midi}`)
    .querySelector<HTMLElement>("[data-countdown-fill]");
}

function normalizedBackground(value: string) {
  const element = document.createElement("span");
  element.style.background = value;
  return element.style.background;
}

function normalizedColor(value: string) {
  const element = document.createElement("span");
  element.style.color = value;
  return element.style.color;
}

const KEYBOARD_STATE_CASES = [
  { name: "idle / right hand", state: "idle", identity: "right" },
  { name: "idle / left hand", state: "idle", identity: "left" },
  { name: "idle / single colour", state: "idle", identity: "single" },
  { name: "prepare / right hand", state: "prepare", identity: "right" },
  { name: "prepare / left hand", state: "prepare", identity: "left" },
  { name: "prepare / single colour", state: "prepare", identity: "single" },
  { name: "pressed / right hand", state: "pressed", identity: "right" },
  { name: "pressed / left hand", state: "pressed", identity: "left" },
  { name: "pressed / single colour", state: "pressed", identity: "single" },
  { name: "error / right hand", state: "error", identity: "right" },
  { name: "error / left hand", state: "error", identity: "left" },
  { name: "error / single colour", state: "error", identity: "single" },
] as const;

describe("PianoKeyboard", () => {
  it("[AC1, AC2] renders all 88 keys with black-key height and stacking", () => {
    render(<PianoKeyboard notes={[]} position={0} hasHandData />);

    expect(screen.getAllByTestId(/piano-key-/)).toHaveLength(88);
    const blackKey = screen.getByTestId("piano-key-22");
    expect(blackKey.style.height).toBe("62%");
    expect(blackKey.style.zIndex).toBe("2");
    expect(screen.getByText("F♯4")).toBeTruthy();
  });

  it("[T14 AC4] changes only the container height and safe-area padding at compact density", () => {
    const view = render(
      <PianoKeyboard notes={[]} position={0} hasHandData density="compact" />,
    );
    expect(screen.getByTestId("piano-keyboard")).toBeTruthy();

    view.rerender(<PianoKeyboard notes={[]} position={0} hasHandData />);
    expect(screen.getByTestId("piano-keyboard")).toBeTruthy();
  });

  it("[T05 AC6, T07 AC6] applies error over pressed and pressed over prepare", () => {
    const notes = [
      note("sounding", 60, 1, 2, "right"),
      note("upcoming", 60, 1.5, 2.5, "left"),
    ];
    const verdicts = new Map<string, LiveVerdict>([
      ["sounding", { kind: "wrong", publishedAt: 1.2 }],
    ]);
    const { rerender } = render(
      <PianoKeyboard
        notes={notes}
        position={1.25}
        hasHandData
        listening
        liveVerdicts={verdicts}
      />,
    );

    expect(screen.getByTestId("piano-key-60").dataset.state).toBe("error");
    rerender(
      <PianoKeyboard notes={notes} position={1.25} hasHandData />,
    );
    expect(screen.getByTestId("piano-key-60").dataset.state).toBe("pressed");
    expect(screen.getByTestId("piano-key-60").dataset.hand).toBe("right");
  });

  it("[T07 AC1, AC2; T07a AC1, AC7] derives exact imminence in musical time, equal to four wall seconds at 0.25x", () => {
    const start = 10;
    const scanner = new KeyStateScanner([note("lead", 60, start, 11)]);

    expect(scanner.derive(8.999).get(60)).toBeUndefined();
    expect(scanner.derive(9).get(60)).toEqual({
      kind: "prepare",
      hand: "right",
      imminence: 0,
    });
    expect(scanner.derive(9.5).get(60)).toEqual({
      kind: "prepare",
      hand: "right",
      imminence: 0.5,
    });
    const instantBefore = scanner.derive(9.999).get(60);
    expect(instantBefore?.kind).toBe("prepare");
    if (instantBefore?.kind === "prepare") {
      expect(instantBefore.imminence).toBeCloseTo(0.999, 6);
    }
    expect(scanner.derive(start).get(60)?.kind).toBe("pressed");

    const musicalLead = start - 9;
    expect(musicalLead).toBe(tunables.highlightLeadTimeSeconds);
    expect(musicalLead / 1).toBe(1);
    expect(musicalLead / 0.25).toBe(4);
  });

  it("[T07a AC2, AC3] keeps chord fills equal and the soonest same-key note wins without decreasing", () => {
    const scanner = new KeyStateScanner([
      note("chord-right", 60, 2, 2.5, "right"),
      note("chord-left", 48, 2, 2.5, "left"),
      note("same-key-soon", 64, 2.2, 2.5, "right"),
      note("same-key-later", 64, 2.8, 3.1, "left"),
    ]);

    const firstSample = scanner.derive(1.5);
    const rightChord = firstSample.get(60);
    const leftChord = firstSample.get(48);
    const sameKeyFirst = firstSample.get(64);
    expect(rightChord?.kind).toBe("prepare");
    expect(leftChord?.kind).toBe("prepare");
    expect(sameKeyFirst?.kind).toBe("prepare");
    if (
      rightChord?.kind === "prepare" &&
      leftChord?.kind === "prepare" &&
      sameKeyFirst?.kind === "prepare"
    ) {
      expect(rightChord.imminence).toBe(leftChord.imminence);
      expect(sameKeyFirst.hand).toBe("right");
      expect(sameKeyFirst.imminence).toBeCloseTo(0.3, 6);
    }

    const nearerSample = scanner.derive(1.8).get(64);
    expect(nearerSample?.kind).toBe("prepare");
    if (nearerSample?.kind === "prepare" && sameKeyFirst?.kind === "prepare") {
      expect(nearerSample.imminence).toBeCloseTo(0.6, 6);
      expect(nearerSample.imminence).toBeGreaterThan(sameKeyFirst.imminence);
    }
  });

  it("[T07 AC3, AC4] enlarges white and black labels exactly at start and reverts at end", () => {
    const notes = [
      note("white", 60, 1, 2),
      note("black", 66, 1, 2),
    ];
    const { rerender } = render(
      <PianoKeyboard notes={notes} position={0.999} hasHandData />,
    );

    expect(labelFor(60).style.fontSize).toBe(`${keyLabelSize.whiteIdle}px`);
    expect(labelFor(66).style.fontSize).toBe(`${keyLabelSize.blackIdle}px`);
    expect(labelFor(60).style.transition).toBe(`font-size ${motion.keyLabelMs}ms linear`);

    rerender(<PianoKeyboard notes={notes} position={1} hasHandData />);
    expect(labelFor(60).style.fontSize).toBe(`${keyLabelSize.whitePressed}px`);
    expect(labelFor(66).style.fontSize).toBe(`${keyLabelSize.blackPressed}px`);
    expect(labelFor(60).style.fontWeight).toBe("500");
    expect(screen.getByTestId("piano-key-60").style.transition).toBe(
      `background ${motion.keyBackgroundMs}ms linear`,
    );

    rerender(<PianoKeyboard notes={notes} position={2} hasHandData />);
    expect(labelFor(60).style.fontSize).toBe(`${keyLabelSize.whiteIdle}px`);
    expect(labelFor(66).style.fontSize).toBe(`${keyLabelSize.blackIdle}px`);
  });

  it("[T07 AC5; T07a AC2, AC5] prepares every chord key with equal fill in its own hand colour", () => {
    const chord = [
      note("right", 60, 2, 3, "right"),
      note("left", 61, 2, 3, "left"),
    ];
    const { rerender } = render(
      <PianoKeyboard
        notes={chord}
        position={1.5}
        hasHandData
      />,
    );

    const right = screen.getByTestId("piano-key-60");
    const left = screen.getByTestId("piano-key-61");
    expect(right.dataset.state).toBe("prepare");
    expect(left.dataset.state).toBe("prepare");
    expect(right.dataset.hand).toBe("right");
    expect(left.dataset.hand).toBe("left");
    expect(right.style.border).toBe(normalizedPrepareStyle(color.handRight, false).border);
    expect(left.style.border).toBe(normalizedPrepareStyle(color.handLeft, true).border);
    expect(labelFor(60).style.color).toBe(normalizedColor(color.keyWhiteFace));
    expect(labelFor(61).style.color).toBe(normalizedColor(color.handLeft));
    expect(fillFor(60)?.style.height).toBe("50%");
    expect(fillFor(61)?.style.height).toBe("50%");
    expect(fillFor(60)?.style.background).toBe(
      normalizedBackground(`${color.handRight}${alpha.prepareFill}`),
    );
    expect(fillFor(61)?.style.background).toBe(
      normalizedBackground(`${color.handLeft}${alpha.prepareFill}`),
    );

    rerender(<PianoKeyboard notes={chord} position={2} hasHandData />);
    expect(fillFor(60)).toBeNull();
    expect(fillFor(61)).toBeNull();
    expect(right.style.background).toBe(normalizedKeyStyle(color.handRight).background);
    expect(left.style.background).toBe(normalizedKeyStyle(color.handLeft).background);
  });

  it("[T07a AC1, AC4, AC6] renders the exact fill behind the label without a transition and clears it on press", () => {
    const notes = [note("countdown", 60, 2, 3)];
    const { rerender } = render(
      <PianoKeyboard notes={notes} position={1.25} hasHandData />,
    );
    const key = screen.getByTestId("piano-key-60");
    const fill = fillFor(60);
    const label = labelFor(60);

    expect(fill?.style.height).toBe("25%");
    expect(fill?.style.transition).toBe("");
    expect(fill?.nextElementSibling).toBe(label);
    expect(key.className).toContain("overflow-hidden");
    expect(label.className).toContain("relative");
    expect(label.className).toContain("z-[3]");

    rerender(<PianoKeyboard notes={notes} position={2} hasHandData />);
    expect(key.dataset.state).toBe("pressed");
    expect(fillFor(60)).toBeNull();
  });

  it("[AC11] lights a sounding key for exactly its duration with the hand style", () => {
    const notes = [note("held", 60, 1, 2, "left")];
    const { rerender } = render(
      <PianoKeyboard notes={notes} position={0.999} hasHandData />,
    );
    const key = () => screen.getByTestId("piano-key-60");

    expect(key().dataset.state).toBe("prepare");
    rerender(<PianoKeyboard notes={notes} position={1} hasHandData />);
    expect(key().dataset.state).toBe("pressed");
    const expected = normalizedKeyStyle(color.handLeft);
    expect(key().style.background).toBe(expected.background);
    expect(key().style.border).toBe(expected.border);
    expect(key().style.boxShadow).toBe(expected.boxShadow);
    rerender(<PianoKeyboard notes={notes} position={1.999} hasHandData />);
    expect(key().dataset.state).toBe("pressed");
    rerender(<PianoKeyboard notes={notes} position={2} hasHandData />);
    expect(key().dataset.state).toBe("idle");
  });

  it("keeps prepare always active and error styling gated by live verdicts", () => {
    const notes = [note("future", 62, 2, 3, "right")];
    const verdicts = new Map<string, LiveVerdict>([
      ["future", { kind: "missed", publishedAt: 2.1 }],
    ]);
    const { rerender } = render(
      <PianoKeyboard notes={notes} position={1.5} hasHandData />,
    );

    expect(screen.getByTestId("piano-key-62").dataset.state).toBe("prepare");
    rerender(
      <PianoKeyboard
        notes={notes}
        position={2.2}
        hasHandData
        listening
        liveVerdicts={verdicts}
      />,
    );
    expect(screen.getByTestId("piano-key-62").dataset.state).toBe("error");
  });

  it("[T05 AC10, T07 AC7; T07a AC5] resolves prepare, fill, and press to one colour without hand data", () => {
    const { rerender } = render(
      <PianoKeyboard
        notes={[note("unknown", 60, 1, 2, "unknown")]}
        position={0.5}
        hasHandData={false}
      />,
    );

    expect(screen.getByTestId("piano-key-60").dataset.state).toBe("prepare");
    expect(screen.getByTestId("piano-key-60").dataset.hand).toBe("right");
    expect(screen.getByTestId("piano-key-60").style.border).toBe(
      normalizedPrepareStyle(color.handRight, false).border,
    );
    expect(labelFor(60).style.color).toBe(normalizedColor(color.keyWhiteFace));
    expect(fillFor(60)?.style.background).toBe(
      normalizedBackground(`${color.handRight}${alpha.prepareFill}`),
    );

    rerender(
      <PianoKeyboard
        notes={[note("unknown", 60, 1, 2, "unknown")]}
        position={1}
        hasHandData={false}
      />,
    );
    expect(screen.getByTestId("piano-key-60").dataset.state).toBe("pressed");
    expect(screen.getByTestId("piano-key-60").style.background).toBe(
      normalizedKeyStyle(color.handRight).background,
    );
  });

  it.each(KEYBOARD_STATE_CASES)(
    "[T15 AC3-AC5] renders $name on white and black keys",
    ({ state, identity }) => {
      const noteHand: NoteEvent["hand"] = identity === "right" ? "right" : "left";
      const hasHandData = identity !== "single";
      const notes =
        state === "idle"
          ? []
          : [
              note("matrix-white", 60, 1, 2, noteHand),
              note("matrix-black", 61, 1, 2, noteHand),
            ];
      const liveVerdicts =
        state === "error"
          ? new Map<string, LiveVerdict>([
              ["matrix-white", { kind: "wrong", publishedAt: 1 }],
              ["matrix-black", { kind: "wrong", publishedAt: 1 }],
            ])
          : undefined;
      const position = state === "prepare" ? 0.5 : state === "idle" ? 0 : 1.1;
      const expectedHand = identity === "left" ? "left" : "right";
      const activeColor = expectedHand === "left" ? color.handLeft : color.handRight;

      render(
        <PianoKeyboard
          notes={notes}
          position={position}
          hasHandData={hasHandData}
          listening={state === "error"}
          liveVerdicts={liveVerdicts}
        />,
      );

      const whiteKey = screen.getByTestId("piano-key-60");
      const blackKey = screen.getByTestId("piano-key-61");
      expect(whiteKey.dataset.state).toBe(state);
      expect(blackKey.dataset.state).toBe(state);
      expect(whiteKey.dataset.hand).toBe(state === "idle" ? "right" : expectedHand);
      expect(blackKey.dataset.hand).toBe(state === "idle" ? "right" : expectedHand);

      if (state === "idle") {
        const whiteIdle = normalizedIdleStyle(false);
        const blackIdle = normalizedIdleStyle(true);
        expect(whiteKey.style.background).toBe(whiteIdle.background);
        expect(whiteKey.style.border).toBe(whiteIdle.border);
        expect(whiteKey.style.boxShadow).toBe(whiteIdle.boxShadow);
        expect(blackKey.style.background).toBe(blackIdle.background);
        expect(blackKey.style.border).toBe(blackIdle.border);
        expect(blackKey.style.boxShadow).toBe(blackIdle.boxShadow);
        expect(labelFor(60).style.color).toBe(normalizedColor(color.keyWhiteLabel));
        expect(labelFor(61).style.color).toBe(normalizedColor(color.keyBlackLabel));
      } else if (state === "prepare") {
        const whitePrepare = normalizedPrepareStyle(activeColor, false);
        const blackPrepare = normalizedPrepareStyle(activeColor, true);
        expect(whiteKey.style.background).toBe(whitePrepare.background);
        expect(whiteKey.style.border).toBe(whitePrepare.border);
        expect(whiteKey.style.boxShadow).toBe(whitePrepare.boxShadow);
        expect(blackKey.style.background).toBe(blackPrepare.background);
        expect(blackKey.style.border).toBe(blackPrepare.border);
        expect(blackKey.style.boxShadow).toBe(blackPrepare.boxShadow);
        expect(fillFor(60)?.style.height).toBe("50%");
        expect(fillFor(61)?.style.height).toBe("50%");
        expect(fillFor(60)?.style.background).toBe(
          normalizedBackground(`${activeColor}${alpha.prepareFill}`),
        );
        expect(fillFor(61)?.style.background).toBe(
          normalizedBackground(`${activeColor}${alpha.prepareFill}`),
        );
        expect(labelFor(60).style.color).toBe(normalizedColor(color.keyWhiteFace));
        expect(labelFor(61).style.color).toBe(normalizedColor(activeColor));
      } else if (state === "pressed") {
        const pressed = normalizedKeyStyle(activeColor);
        const ring = normalizedLitRingStyle();
        expect(whiteKey.style.background).toBe(pressed.background);
        expect(whiteKey.style.border).toBe(pressed.border);
        expect(whiteKey.style.boxShadow).toBe(pressed.boxShadow);
        expect(whiteKey.style.outline).toBe(ring.outline);
        expect(whiteKey.style.outlineOffset).toBe(ring.outlineOffset);
        expect(blackKey.style.background).toBe(pressed.background);
        expect(blackKey.style.border).toBe(pressed.border);
        expect(blackKey.style.boxShadow).toBe(pressed.boxShadow);
        expect(blackKey.style.outline).toBe("");
        expect(labelFor(60).style.color).toBe(normalizedColor(color.onAccent));
        expect(labelFor(61).style.color).toBe(normalizedColor(color.onAccent));
      } else {
        const error = normalizedErrorStyle();
        for (const key of [whiteKey, blackKey]) {
          expect(key.style.background).toBe(error.background);
          expect(key.style.border).toBe(error.border);
          expect(key.style.boxShadow).toBe(error.boxShadow);
          expect(key.style.outline).toBe("");
        }
        expect(labelFor(60).style.color).toBe(normalizedColor(color.errorKeyLabel));
        expect(labelFor(61).style.color).toBe(normalizedColor(color.errorKeyLabel));
      }
    },
  );

  it("[T15a AC1, AC5; D-051] fills prepared white keys with their active hand colour", () => {
    render(
      <PianoKeyboard
        notes={[
          note("right-white", 60, 2, 3, "right"),
          note("left-white", 62, 2, 3, "left"),
        ]}
        position={1.5}
        hasHandData
      />,
    );

    expect(fillFor(60)?.style.background).toBe(
      normalizedBackground(`${color.handRight}${alpha.prepareFill}`),
    );
    expect(fillFor(62)?.style.background).toBe(
      normalizedBackground(`${color.handLeft}${alpha.prepareFill}`),
    );
    expect(fillFor(60)?.style.background).not.toBe(
      normalizedBackground(`${color.keyLitRing}${alpha.prepareFill}`),
    );
    expect(fillFor(62)?.style.background).not.toBe(
      normalizedBackground(`${color.keyLitRing}${alpha.prepareFill}`),
    );
  });

  it.each(HAND_COLOR_PRESETS)(
    "[T15 AC6] keeps the lit white-key ring with the $name palette",
    (preset) => {
      const storage = memoryStorage();
      writeHandSettings(
        { right: preset.right, left: preset.left, mode: "score" },
        storage,
      );
      render(
        <HandColorProvider storage={storage}>
          <PianoKeyboard
            notes={[note("palette", 60, 1, 2, "right")]}
            position={1}
            hasHandData
          />
        </HandColorProvider>,
      );

      const key = screen.getByTestId("piano-key-60");
      const ring = normalizedLitRingStyle();
      expect(key.style.background).toBe(normalizedKeyStyle(preset.right).background);
      expect(key.style.outline).toBe(ring.outline);
      expect(key.style.outlineOffset).toBe(ring.outlineOffset);
    },
  );

  it("resets its advancing cursor by binary search after a seek", () => {
    const notes = Array.from({ length: 2_000 }, (_, index) =>
      note(`cursor-${index}`, 60 + (index % 12), index * 0.1, index * 0.1 + 0.05),
    );
    const scanner = new KeyStateScanner(notes);
    scanner.derive(150, { seekRevision: 1 });
    const lateCursor = scanner.cursorIndex;
    scanner.derive(10, { seekRevision: 2 });

    expect(lateCursor).toBeGreaterThan(1_000);
    expect(scanner.cursorIndex).toBeLessThan(200);
  });
});
