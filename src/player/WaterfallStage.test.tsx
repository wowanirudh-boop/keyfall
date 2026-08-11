import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { color, tunables } from "../design/tokens";
import type { NoteEvent } from "../music/types";
import { createDenseFixture } from "../testing/denseFixture";
import { WaterfallStage, visibleNotesAt } from "./WaterfallStage";

let resizeCallback: ResizeObserverCallback;
let observedHeight = 300;

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  observe(target: Element) {
    resizeCallback(
      [{ target, contentRect: { height: observedHeight } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  disconnect() {}
  unobserve() {}
}

function note(id: string, start: number, end: number, hand: NoteEvent["hand"] = "right") {
  return { id, midi: 60, start, end, velocity: 100, hand } satisfies NoteEvent;
}

function transformPixels(transform: string) {
  return Number(transform.match(/translateY\(([-\d.]+)px\)/)?.[1]);
}

function normalizedBackground(background: string) {
  const element = document.createElement("div");
  element.style.background = background;
  return element.style.background;
}

beforeEach(() => {
  observedHeight = 300;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WaterfallStage", () => {
  it("[AC3] places a note beginning now on the strike line", () => {
    render(
      <WaterfallStage
        notes={[note("strike", 2, 2.5)]}
        position={2}
        speed={1}
        hasHandData
      />,
    );

    const renderedNote = document.querySelector<HTMLElement>('[data-note-id="strike"]');
    const layer = screen.getByTestId("waterfall-layer");
    const bottomAtStage =
      Number.parseFloat(renderedNote?.style.bottom ?? "0") - transformPixels(layer.style.transform);
    expect(Math.abs(bottomAtStage)).toBeLessThanOrEqual(1);
  });

  it("[AC4] renders an identical musical note set at every speed", () => {
    const notes = [
      note("before", 7, 8.1),
      note("now", 10, 10.5),
      note("ahead", 12.5, 13),
      note("margin", 14.9, 15.2),
      note("outside", 15.1, 15.5),
    ];
    const { rerender } = render(
      <WaterfallStage notes={notes} position={10} speed={1} hasHandData />,
    );
    const ids = () =>
      [...document.querySelectorAll<HTMLElement>("[data-note-id]")].map(
        (element) => element.dataset.noteId,
      );
    const atOne = ids();

    rerender(<WaterfallStage notes={notes} position={10} speed={0.5} hasHandData />);
    const atHalf = ids();
    rerender(<WaterfallStage notes={notes} position={10} speed={0.25} hasHandData />);

    expect(atHalf).toEqual(atOne);
    expect(ids()).toEqual(atOne);
  });

  it("[AC5] formats the slow-speed wall-clock lookahead overlay", () => {
    const { rerender } = render(
      <WaterfallStage notes={[]} position={0} speed={0.5} hasHandData />,
    );
    expect(screen.getByText("3S MUSICAL LOOKAHEAD · 6.0S AT 0.5x")).toBeTruthy();

    rerender(<WaterfallStage notes={[]} position={0} speed={0.25} hasHandData />);
    expect(screen.getByText("3S MUSICAL LOOKAHEAD · 12.0S AT 0.25x")).toBeTruthy();
  });

  it("[AC7] windows the dense fixture below 400 exact reference notes", () => {
    const dense = createDenseFixture();
    const position = 900;
    const expected = dense.notes
      .filter(
        (candidate) =>
          candidate.end >= position - 2 &&
          candidate.start <= position + tunables.lookaheadSeconds + 2,
      )
      .map((candidate) => candidate.id);
    render(
      <WaterfallStage
        notes={dense.notes}
        position={position}
        speed={1}
        hasHandData
      />,
    );
    const actual = [...document.querySelectorAll<HTMLElement>("[data-note-id]")].map(
      (element) => element.dataset.noteId,
    );

    expect(actual.length).toBeLessThan(400);
    expect(actual).toEqual(expected);
    expect(visibleNotesAt(dense.notes, position).map((candidate) => candidate.id)).toEqual(
      expected,
    );
  });

  it("[AC9] recomputes pps on resize while the sounding note stays at the playhead", () => {
    render(
      <WaterfallStage
        notes={[note("resize", 4, 4.5)]}
        position={4}
        speed={1}
        hasHandData
      />,
    );
    const stage = screen.getByTestId("waterfall-stage");
    const layer = screen.getByTestId("waterfall-layer");
    const renderedNote = document.querySelector<HTMLElement>('[data-note-id="resize"]');
    expect(stage.dataset.pixelsPerSecond).toBe("100");

    observedHeight = 600;
    act(() => {
      resizeCallback(
        [
          { target: stage, contentRect: { height: 600 } } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });

    expect(stage.dataset.pixelsPerSecond).toBe("200");
    const bottomAtStage =
      Number.parseFloat(renderedNote?.style.bottom ?? "0") - transformPixels(layer.style.transform);
    expect(Math.abs(bottomAtStage)).toBeLessThanOrEqual(1);
  });

  it("[AC10] uses one colour for every note when hand data is absent", () => {
    render(
      <WaterfallStage
        notes={[note("left", 0, 1, "left"), note("right", 0.5, 1.5, "right")]}
        position={0}
        speed={1}
        hasHandData={false}
      />,
    );
    const rendered = [...document.querySelectorAll<HTMLElement>("[data-note-id]")];

    expect(new Set(rendered.map((element) => element.style.background))).toEqual(
      new Set([normalizedBackground(color.handRight)]),
    );
    expect(rendered.every((element) => element.dataset.hand === "right")).toBe(true);
  });

  it("[AC14] uses the stage gradient and one-pixel strike rule", () => {
    render(<WaterfallStage notes={[]} position={0} speed={1} hasHandData />);
    const stage = screen.getByTestId("waterfall-stage");
    const expected = document.createElement("div");
    expected.style.backgroundImage = `linear-gradient(180deg, ${color.stage} 0%, ${color.stageGradientEnd} 100%)`;

    expect(stage.style.backgroundImage).toBe(expected.style.backgroundImage);
    expect(screen.getByTestId("strike-line").className).toContain("h-px");
    expect(screen.getByTestId("strike-line").className).toContain("bg-strike-line");
  });
});
