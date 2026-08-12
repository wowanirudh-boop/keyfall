import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { motion } from "../design/tokens";
import type { PieceDocument } from "../music/types";
import { PlaybackEngine } from "../playback";
import { ImportNoticeStrip, TransientNotice } from "./Notices";
import { PlayerHeader, VolumeSlider } from "./PlayerHeader";
import { PlayerView } from "./PlayerView";

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

  it("[T03b AC9] shows a catalog creator in the existing player metadata line", () => {
    render(
      <PlayerHeader
        piece={{ ...piece, source: "catalog", sourceCreator: "Careful Typesetter" }}
        muted={false}
        volume={1}
        onLibrary={() => undefined}
        onMutedChange={() => undefined}
        onVolumeChange={() => undefined}
      />,
    );

    expect(
      screen.getByText("J. S. BACH · MUTOPIA CATALOG · CAREFUL TYPESETTER"),
    ).toBeTruthy();
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
