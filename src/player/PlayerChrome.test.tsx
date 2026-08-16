import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { motion } from "../design/tokens";
import type { PieceDocument } from "../music/types";
import { PlaybackEngine } from "../playback";
import { ImportNoticeStrip, TransientNotice } from "./Notices";
import { PlayerHeader, VolumeSlider } from "./PlayerHeader";
import { PlayerView, stabilizePlayerHeight } from "./PlayerView";

const piece: PieceDocument = {
  id: "chrome-fixture",
  title: "Prelude in C major",
  composer: "J. S. Bach",
  source: "musicxml-upload",
  duration: 30,
  notes: [],
  hasHandData: true,
  notices: [
    { kind: "dropped-notes", message: "Dropped notes remain visible." },
    { kind: "structural-fallback", message: "Structural fallback remains visible." },
    { kind: "ornament-handling", message: "Ornament handling remains visible." },
  ],
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "fullscreenEnabled");
  Reflect.deleteProperty(document, "fullscreenElement");
  Reflect.deleteProperty(document, "exitFullscreen");
  Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
});

describe("Player chrome", () => {
  it("[AC10, AC12] renders the full header and collapses the legend without hand data", () => {
    const onLibrary = vi.fn();
    const onMutedChange = vi.fn();
    const onListenToggle = vi.fn();
    const { rerender } = render(
      <PlayerHeader
        piece={piece}
        muted={false}
        volume={1}
        onLibrary={onLibrary}
        onMutedChange={onMutedChange}
        onVolumeChange={() => undefined}
        onListenToggle={onListenToggle}
      />,
    );

    expect(screen.getByRole("button", { name: "← Library" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: piece.title })).toBeTruthy();
    expect(screen.getByText("J. S. BACH · MUSICXML UPLOAD")).toBeTruthy();
    expect(screen.getByTestId("hand-legend")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Audio on" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Listen mode" })).toBeTruthy();

    rerender(
      <PlayerHeader
        piece={{ ...piece, hasHandData: false }}
        muted
        volume={1}
        onLibrary={onLibrary}
        onMutedChange={onMutedChange}
        onVolumeChange={() => undefined}
      />,
    );
    expect(screen.queryByTestId("hand-legend")).toBeNull();
    expect(screen.getByRole("button", { name: "Muted" })).toBeTruthy();
  });

  it("[T14 AC5] ignores zero measurements and applies 12px of density hysteresis", () => {
    expect(stabilizePlayerHeight(0, 0)).toBe(0);
    expect(stabilizePlayerHeight(0, 430)).toBe(430);
    expect(stabilizePlayerHeight(430, 625)).toBe(430);
    expect(stabilizePlayerHeight(430, 632)).toBe(632);
    expect(stabilizePlayerHeight(900, 615)).toBe(900);
    expect(stabilizePlayerHeight(900, 608)).toBe(608);
  });

  it("[T14 AC3, AC7, AC11] keeps every compact header control in one row with merged metadata", () => {
    render(
      <PlayerHeader
        piece={{ ...piece, source: "catalog", sourceCollection: "Mutopia Project" }}
        muted={false}
        volume={1}
        density="compact"
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
        onListenToggle={() => undefined}
      />,
    );

    const header = screen.getByTestId("player-header");
    expect(header.className).toContain("flex-nowrap");
    expect(header.className).toContain("h-[44px]");
    expect(screen.getByRole("button", { name: "Library" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Note colours" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Volume" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Audio on" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Listen mode" })).toBeTruthy();
    expect(screen.getByTestId("player-title-line").textContent).toBe(
      "Prelude in C major · J. S. BACH · Mutopia Project",
    );
    expect(screen.queryByTestId("hand-legend")).toBeNull();
  });

  it("[T14 AC8] omits fullscreen when the browser reports it unavailable", () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    render(
      <PlayerView
        piece={piece}
        playback={{
          position: 0,
          duration: 30,
          playing: false,
          speed: 1,
          loop: { a: null, b: null },
          muted: false,
          audioBlocked: false,
          volume: 1,
        }}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    expect(screen.queryByTestId("fullscreen-toggle")).toBeNull();
  });

  it("[T14 AC1] keeps the fullscreen addition out of comfortable density", () => {
    render(
      <PlayerHeader
        piece={piece}
        muted={false}
        volume={1}
        fullscreenSupported
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    expect(screen.queryByTestId("fullscreen-toggle")).toBeNull();
  });

  it("[T14 AC8, AC9] keeps fullscreen active when orientation locking rejects", async () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(430);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(932);
    let fullscreenElement: Element | null = null;
    const lock = vi.fn().mockRejectedValue(new Error("unsupported"));
    const unlock = vi.fn();
    vi.stubGlobal("screen", { orientation: { lock, unlock } });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    const requestFullscreen = vi.fn(async () => {
      fullscreenElement = screen.getByTestId("player-view");
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    const exitFullscreen = vi.fn(async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });

    render(
      <PlayerView
        piece={piece}
        playback={{
          position: 0,
          duration: 30,
          playing: false,
          speed: 1,
          loop: { a: null, b: null },
          muted: false,
          audioBlocked: false,
          volume: 1,
        }}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("player-view").getAttribute("data-density")).toBe("compact"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Exit full screen" })).toBeTruthy());
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(lock).toHaveBeenCalledWith("landscape");
    expect(fullscreenElement).toBeTruthy();
    expect(exitFullscreen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Full screen" })).toBeTruthy());
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(unlock).not.toHaveBeenCalled();
  });

  it("[AC12] mutes the playback engine without changing musical position", () => {
    const engine = new PlaybackEngine();
    engine.load(piece);
    engine.seek(12.25);
    const before = engine.getSnapshot().position;

    function Harness() {
      const [snapshot, setSnapshot] = useState(engine.getSnapshot());
      return (
        <PlayerHeader
          piece={piece}
          muted={snapshot.muted}
          volume={snapshot.volume}
          onLibrary={() => undefined}
          onMutedChange={(muted) => {
            engine.setMuted(muted);
            setSnapshot(engine.getSnapshot());
          }}
          onVolumeChange={() => undefined}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Audio on" }));

    expect(screen.getByRole("button", { name: "Muted" })).toBeTruthy();
    expect(engine.getSnapshot().muted).toBe(true);
    expect(engine.getSnapshot().position).toBe(before);
  });

  it("[T13a AC2] shows a Mutopia collection and its typesetter", () => {
    render(
      <PlayerHeader
        piece={{
          ...piece,
          source: "catalog",
          sourceCollection: "Mutopia Project",
          sourceCreator: "Careful Typesetter",
        }}
        muted={false}
        volume={1}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    expect(
      screen.getByText("J. S. BACH · Mutopia Project · CAREFUL TYPESETTER"),
    ).toBeTruthy();
  });

  it("[T13a AC1] shows piano-midi.de and Bernd Krueger without a Mutopia label", () => {
    render(
      <PlayerHeader
        piece={{
          ...piece,
          composer: "Ravel, Maurice",
          source: "catalog",
          sourceCollection: "piano-midi.de",
          sourceCreator: "Bernd Krueger",
        }}
        muted={false}
        volume={1}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    expect(
      screen.getByText("RAVEL, MAURICE · piano-midi.de · BERND KRUEGER"),
    ).toBeTruthy();
    expect(screen.queryByText(/mutopia/i)).toBeNull();
  });

  it("[T13a AC3] omits the source label from a legacy catalog document", () => {
    render(
      <PlayerHeader
        piece={{ ...piece, source: "catalog", sourceCreator: "Legacy Typesetter" }}
        muted={false}
        volume={1}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    expect(screen.getByText("J. S. BACH · LEGACY TYPESETTER")).toBeTruthy();
    expect(screen.queryByText(/mutopia|catalog/i)).toBeNull();
  });

  it("[T13a AC5] leaves MIDI and MusicXML upload labels unchanged", () => {
    const view = render(
      <PlayerHeader
        piece={{ ...piece, source: "midi-upload" }}
        muted={false}
        volume={1}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );
    expect(screen.getByText("J. S. BACH · MIDI UPLOAD")).toBeTruthy();

    view.rerender(
      <PlayerHeader
        piece={{ ...piece, source: "musicxml-upload" }}
        muted={false}
        volume={1}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );
    expect(screen.getByText("J. S. BACH · MUSICXML UPLOAD")).toBeTruthy();
  });

  it("[T13a AC6] renders a future collection without header-specific mapping", () => {
    render(
      <PlayerHeader
        piece={{ ...piece, source: "catalog", sourceCollection: "Future Archive" }}
        muted={false}
        volume={1}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    expect(screen.getByText("J. S. BACH · Future Archive")).toBeTruthy();
  });

  it("[T05a AC5] keeps zero volume visually independent from mute", () => {
    render(
      <PlayerHeader
        piece={piece}
        muted={false}
        volume={0}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Audio on" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Volume" }).getAttribute("value")).toBe("0");
  });

  it("[T05a AC6] maps mouse and synthetic touch drags identically with pointer capture", () => {
    const values: number[] = [];
    const view = render(
      <VolumeSlider volume={0} onVolumeChange={(volume) => values.push(volume)} />,
    );
    let slider = screen.getByRole("slider", { name: "Volume" });
    const setPointerCapture = vi.fn();
    Object.defineProperties(slider, {
      getBoundingClientRect: {
        value: () => ({ left: 100, right: 172, width: 72, top: 0, bottom: 30, height: 30, x: 100, y: 0, toJSON: () => undefined }),
      },
      setPointerCapture: { value: setPointerCapture },
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: vi.fn() },
    });
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(slider, { clientX: 154, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerUp(slider, { clientX: 154, pointerId: 1, pointerType: "mouse" });
    const mouseVolume = values.at(-1);

    view.unmount();
    values.length = 0;
    render(<VolumeSlider volume={0} onVolumeChange={(volume) => values.push(volume)} />);
    slider = screen.getByRole("slider", { name: "Volume" });
    Object.defineProperties(slider, {
      getBoundingClientRect: {
        value: () => ({ left: 100, right: 172, width: 72, top: 0, bottom: 30, height: 30, x: 100, y: 0, toJSON: () => undefined }),
      },
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: vi.fn() },
    });
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerMove(slider, { clientX: 154, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerUp(slider, { clientX: 154, pointerId: 2, pointerType: "touch" });

    expect(values.at(-1)).toBe(mouseVolume);
    expect(mouseVolume).toBe(0.75);
    expect(setPointerCapture).toHaveBeenCalledWith(1);
    expect(slider.className).toContain("touch-none");
  });

  it("[AC13] keeps every import notice visible and expires a transient at 4200 ms", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <>
        <ImportNoticeStrip notices={piece.notices} />
        <TransientNotice message="Loop disabled while listening." onDismiss={onDismiss} />
      </>,
    );

    for (const notice of piece.notices) expect(screen.getByText(notice.message)).toBeTruthy();
    expect(screen.getByText("Loop disabled while listening.")).toBeTruthy();
    act(() => vi.advanceTimersByTime(motion.noticeMs - 1));
    expect(screen.getByText("Loop disabled while listening.")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Loop disabled while listening.")).toBeNull();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps the T05 player shell at viewport height without page overflow", () => {
    render(
      <PlayerView
        piece={{ ...piece, hasHandData: false }}
        playback={{
          position: 0,
          duration: 30,
          playing: false,
          speed: 1,
          loop: { a: null, b: null },
          muted: false,
          audioBlocked: false,
          volume: 1,
        }}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    const player = screen.getByTestId("player-view");
    expect(player.className).toContain("h-screen");
    expect(player.className).toContain("overflow-hidden");
  });
});
