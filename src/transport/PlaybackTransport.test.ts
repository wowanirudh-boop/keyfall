import { describe, expect, it } from "vitest";

import type { NoteEvent, PieceDocument } from "../music/types";
import { PlaybackEngine, type PlaybackSpeed } from "../playback";
import type { PlaybackRuntime, ScheduledPlaybackNote } from "../playback/runtime";

interface FakeInterval {
  callback: () => void;
  interval: number;
  next: number;
}

class FakeRuntime implements PlaybackRuntime {
  private time = 0;
  private nextId = 0;
  private readonly intervals = new Map<number, FakeInterval>();
  readonly scheduled: ScheduledPlaybackNote[] = [];

  now() {
    return this.time;
  }

  setInterval(callback: () => void, interval: number) {
    const id = ++this.nextId;
    this.intervals.set(id, { callback, interval, next: this.time + interval });
    return id;
  }

  clearInterval(id: number) {
    this.intervals.delete(id);
  }

  scheduleNote(note: ScheduledPlaybackNote) {
    this.scheduled.push({ ...note });
  }

  cancelScheduledNotes() {}
  getScheduledNoteCount() {
    return this.scheduled.length;
  }
  setMuted() {}
  startSamplerLoad() {}
  dispose() {}

  advance(seconds: number) {
    const target = this.time + seconds;
    while (true) {
      const next = Math.min(...[...this.intervals.values()].map((interval) => interval.next));
      if (!Number.isFinite(next) || next > target + Number.EPSILON) break;
      this.time = next;
      for (const interval of this.intervals.values()) {
        if (Math.abs(interval.next - next) > Number.EPSILON) continue;
        interval.next += interval.interval;
        interval.callback();
      }
    }
    this.time = target;
  }
}

function note(start: number): NoteEvent {
  return {
    id: `note-${start}`,
    midi: 60,
    start,
    end: start + 0.5,
    velocity: 100,
    hand: "right",
  };
}

function piece(duration: number, notes: NoteEvent[] = []): PieceDocument {
  return {
    id: "transport-piece",
    title: "Transport piece",
    composer: "",
    source: "midi-upload",
    duration,
    notes,
    hasHandData: true,
    notices: [],
  };
}

function setup(document: PieceDocument) {
  const runtime = new FakeRuntime();
  const engine = new PlaybackEngine({ createRuntime: () => runtime });
  engine.load(document);
  return { engine, runtime };
}

const SPEEDS: PlaybackSpeed[] = [1, 0.5, 0.25];

describe("transport integration with PlaybackEngine", () => {
  it.each(SPEEDS)(
    "[AC2] seeks to 20 exact positions across 10 minutes at %sx",
    async (speed) => {
      const { engine } = setup(piece(600));
      engine.setSpeed(speed);
      await engine.play();
      for (let index = 0; index < 20; index += 1) {
        const target = (index / 19) * 600;
        engine.seek(target);
        expect(Math.abs(engine.getSnapshot().position - target)).toBeLessThanOrEqual(0.1);
      }
    },
  );

  it("[AC5] preserves position and reschedules the next note immediately at the new speed", async () => {
    const { engine, runtime } = setup(piece(10, [note(1.5)]));
    engine.seek(0.5);
    await engine.play();
    runtime.advance(0.25);
    const before = engine.getSnapshot().position;

    engine.setSpeed(0.5);
    const rescheduled = runtime.scheduled.at(-1);

    expect(engine.getSnapshot().position).toBe(before);
    expect(rescheduled?.noteId).toBe("note-1.5");
    expect(rescheduled?.audioStart).toBe(1.75);
    expect(rescheduled?.frequencyHz).toBeCloseTo(261.6256, 4);
  });

  it.each(SPEEDS)(
    "[AC7] wraps at B to A without drift or overshoot over 50 wraps at %sx",
    async (speed) => {
      const { engine, runtime } = setup(piece(100));
      let maximum = 0;
      engine.setSpeed(speed);
      engine.setLoop(7.8, 15.5);
      engine.seek(7.8);
      engine.subscribe((snapshot) => {
        maximum = Math.max(maximum, snapshot.position);
      });
      await engine.play();

      for (let wrap = 0; wrap < 50; wrap += 1) {
        runtime.advance((15.5 - 7.8) / speed);
        expect(engine.getSnapshot().position).toBeCloseTo(7.8, 8);
      }
      expect(maximum).toBeLessThanOrEqual(15.5);
    },
  );

  it("[AC9] restarts play at zero or A when positioned at the end", async () => {
    const plain = setup(piece(20));
    plain.engine.seek(20);
    await plain.engine.play();
    expect(plain.engine.getSnapshot()).toMatchObject({ position: 0, playing: true });

    const looped = setup(piece(20));
    looped.engine.setLoop(7.8, 15.5);
    looped.engine.seek(20);
    await looped.engine.play();
    expect(looped.engine.getSnapshot()).toMatchObject({ position: 7.8, playing: true });
  });
});
