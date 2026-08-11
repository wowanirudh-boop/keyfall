import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { alpha, color } from "../design/tokens";
import type { PieceDocument } from "../music/types";
import type { PlaybackSnapshot } from "../playback";
import { PlayerView } from "../player";
import { PlayerShortcuts } from "./PlayerShortcuts";
import { PlayerTransport, SeekBar, TransportRow2 } from "./Transport";

const basePlayback: PlaybackSnapshot = {
  position: 12,
  duration: 60,
  playing: false,
  speed: 1,
  loop: { a: null, b: null },
  muted: false,
};

function setSeekBounds(element: HTMLElement) {
  Object.defineProperties(element, {
    getBoundingClientRect: {
      value: () => ({
        left: 100,
        right: 500,
        top: 0,
        bottom: 34,
        width: 400,
        height: 34,
        x: 100,
        y: 0,
        toJSON: () => undefined,
      }),
    },
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: vi.fn() },
  });
}

function normalizedStyle(property: "background" | "border", value: string) {
  const element = document.createElement("div");
  element.style[property] = value;
  return element.style[property];
}

describe("transport controls", () => {
  it("[AC1] maps mouse and synthetic touch pointer drags to identical positions", () => {
    const positions: number[] = [];
    const view = render(
      <SeekBar
        position={0}
        duration={600}
        loop={{ a: null, b: null }}
        onSeek={(position) => positions.push(position)}
        onLoopChange={() => undefined}
      />,
    );
    let bar = screen.getByTestId("seek-bar");
    setSeekBounds(bar);
    fireEvent.pointerDown(bar, { clientX: 100, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(bar, { clientX: 340, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(bar, { clientX: 340, pointerId: 1, pointerType: "mouse" });
    const mousePosition = positions.at(-1);

    view.unmount();
    positions.length = 0;
    render(
      <SeekBar
        position={0}
        duration={600}
        loop={{ a: null, b: null }}
        onSeek={(position) => positions.push(position)}
        onLoopChange={() => undefined}
      />,
    );
    bar = screen.getByTestId("seek-bar");
    setSeekBounds(bar);
    fireEvent.pointerDown(bar, { clientX: 100, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerMove(bar, { clientX: 340, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerUp(bar, { clientX: 340, pointerId: 2, pointerType: "touch" });

    expect(positions.at(-1)).toBe(mousePosition);
    expect(mousePosition).toBe(360);
  });

  it.each([true, false])(
    "[AC3] preserves playing=%s throughout a drag",
    (initialPlaying) => {
      function Harness() {
        const [playback, setPlayback] = useState({ ...basePlayback, playing: initialPlaying });
        return (
          <PlayerTransport
            playback={playback}
            onTogglePlay={() =>
              setPlayback((current) => ({ ...current, playing: !current.playing }))
            }
            onSeek={(position) => setPlayback((current) => ({ ...current, position }))}
            onSpeedChange={() => undefined}
            onLoopChange={() => undefined}
          />
        );
      }

      render(<Harness />);
      const bar = screen.getByTestId("seek-bar");
      setSeekBounds(bar);
      fireEvent.pointerDown(bar, { clientX: 200, pointerId: 1, pointerType: "mouse" });
      fireEvent.pointerMove(bar, { clientX: 300, pointerId: 1, pointerType: "mouse" });
      fireEvent.pointerUp(bar, { clientX: 300, pointerId: 1, pointerType: "mouse" });

      expect(screen.getByRole("button", { name: initialPlaying ? "Pause" : "Play" })).toBeTruthy();
    },
  );

  it("[AC4] updates the waterfall visualization before a scrub is released", () => {
    class ResizeObserverMock {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { height: 300 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    const piece: PieceDocument = {
      id: "scrub-piece",
      title: "Scrub piece",
      composer: "",
      source: "midi-upload",
      duration: 60,
      notes: [],
      hasHandData: false,
      notices: [],
    };

    function Harness() {
      const [playback, setPlayback] = useState(basePlayback);
      return (
        <PlayerView
          piece={piece}
          playback={playback}
          onLibrary={() => undefined}
          onMutedChange={() => undefined}
          onSeek={(position) => setPlayback((current) => ({ ...current, position }))}
        />
      );
    }

    render(<Harness />);
    const bar = screen.getByTestId("seek-bar");
    setSeekBounds(bar);
    const before = screen.getByTestId("waterfall-layer").style.transform;
    fireEvent.pointerDown(bar, { clientX: 300, pointerId: 1, pointerType: "mouse" });

    expect(screen.getByTestId("scrub-tooltip")).toBeTruthy();
    expect(screen.getByTestId("waterfall-layer").style.transform).not.toBe(before);
    vi.unstubAllGlobals();
  });

  it("[AC5] changes speed immediately while preserving the displayed position", () => {
    function Harness() {
      const [playback, setPlayback] = useState(basePlayback);
      return (
        <PlayerTransport
          playback={playback}
          onTogglePlay={() => undefined}
          onSeek={() => undefined}
          onSpeedChange={(speed) => setPlayback((current) => ({ ...current, speed }))}
          onLoopChange={() => undefined}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "0.5x" }));

    expect(screen.getByRole("button", { name: "0.5x" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("0:12 / 1:00")).toBeTruthy();
  });

  it("[AC6] clamps marker drags and renders the token-defined loop treatment", () => {
    const onLoopChange = vi.fn();
    render(
      <SeekBar
        position={12}
        duration={60}
        loop={{ a: 10, b: 20 }}
        onSeek={() => undefined}
        onLoopChange={onLoopChange}
      />,
    );
    const bar = screen.getByTestId("seek-bar");
    setSeekBounds(bar);
    fireEvent.pointerDown(screen.getByTestId("loop-marker-a"), {
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerMove(bar, { clientX: 300, pointerId: 1, pointerType: "touch" });

    expect(onLoopChange).toHaveBeenLastCalledWith(19.5, 20);
    const region = screen.getByTestId("loop-region");
    expect(region.style.background).toBe(
      normalizedStyle("background", `${color.amber}${alpha.loopFill}`),
    );
    expect(region.style.border).toBe(
      normalizedStyle("border", `1px solid ${color.amber}${alpha.loopBorder}`),
    );
  });

  it("[AC8] scopes shortcuts to its mounted player and ignores text inputs", () => {
    const onTogglePlay = vi.fn();
    const onSeek = vi.fn();
    const view = render(
      <>
        <input aria-label="Search" />
        <PlayerShortcuts position={20} onTogglePlay={onTogglePlay} onSeek={onSeek} />
      </>,
    );
    const space = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
    window.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(onTogglePlay).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenNthCalledWith(1, 15);
    expect(onSeek).toHaveBeenNthCalledWith(2, 25);

    const input = screen.getByRole("textbox", { name: "Search" });
    fireEvent.keyDown(input, { code: "Space" });
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(onTogglePlay).toHaveBeenCalledOnce();
    expect(onSeek).toHaveBeenCalledTimes(2);

    view.unmount();
    fireEvent.keyDown(window, { code: "Space" });
    expect(onTogglePlay).toHaveBeenCalledOnce();
  });

  it("[AC10] keeps transport row 2 wrapping", () => {
    render(
      <TransportRow2
        playback={basePlayback}
        onSpeedChange={() => undefined}
        onLoopChange={() => undefined}
      />,
    );
    expect(screen.getByTestId("transport-row-2").className).toContain("flex-wrap");
  });

  it("renders the loop label with formatted marker times", () => {
    render(
      <PlayerTransport
        playback={{ ...basePlayback, loop: { a: 7, b: 15 } }}
        onTogglePlay={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
        onLoopChange={() => undefined}
      />,
    );
    expect(screen.getByText("LOOPING 0:07–0:15")).toBeTruthy();
  });
});
