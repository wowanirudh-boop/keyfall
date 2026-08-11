import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { NoteEvent, PieceDocument } from "../music/types";
import { createDenseFixture } from "../testing/denseFixture";
import { PlaybackEngine, type PlaybackSpeed } from "./PlaybackEngine";
import type { PlaybackRuntime, ScheduledPlaybackNote } from "./runtime";
import {
  SALAMANDER_ATTRIBUTION,
  SALAMANDER_SAMPLE_BUDGET_BYTES,
  SALAMANDER_SAMPLE_BYTES,
  SALAMANDER_SAMPLE_ROOTS,
  TONE_SAMPLER_OPTIONS,
} from "./sampler";

interface FakeInterval {
  callback: () => void;
  interval: number;
  next: number;
}

class FakeToneRuntime implements PlaybackRuntime {
  private time = 0;
  private nextId = 0;
  private readonly intervals = new Map<number, FakeInterval>();
  private readonly scheduled = new Map<number, ScheduledPlaybackNote>();
  readonly history: ScheduledPlaybackNote[] = [];
  cancelCount = 0;
  disposeCount = 0;
  maxScheduledCount = 0;
  muted = false;
  samplerLoadCount = 0;
  private samplerLoadStarted = false;

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
    const id = ++this.nextId;
    this.scheduled.set(id, note);
    this.history.push({ ...note });
    this.maxScheduledCount = Math.max(this.maxScheduledCount, this.scheduled.size);
  }

  cancelScheduledNotes() {
    this.cancelCount += 1;
    this.scheduled.clear();
  }

  getScheduledNoteCount() {
    return this.scheduled.size;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  startSamplerLoad() {
    if (this.samplerLoadStarted) return;
    this.samplerLoadStarted = true;
    this.samplerLoadCount += 1;
  }

  dispose() {
    this.disposeCount += 1;
    this.intervals.clear();
    this.scheduled.clear();
  }

  advance(seconds: number) {
    const target = this.time + seconds;

    while (true) {
      let nextTick = Number.POSITIVE_INFINITY;
      for (const interval of this.intervals.values()) {
        nextTick = Math.min(nextTick, interval.next);
      }
      if (nextTick > target + Number.EPSILON) break;

      this.time = nextTick;
      this.removeStartedNotes();
      const due = [...this.intervals.entries()].filter(
        ([, interval]) => Math.abs(interval.next - nextTick) < 1e-9,
      );
      for (const [id, interval] of due) {
        if (!this.intervals.has(id)) continue;
        interval.next += interval.interval;
        interval.callback();
      }
    }

    this.time = target;
    this.removeStartedNotes();
  }

  get intervalCount() {
    return this.intervals.size;
  }

  private removeStartedNotes() {
    for (const [id, note] of this.scheduled) {
      if (note.audioStart <= this.time + Number.EPSILON) this.scheduled.delete(id);
    }
  }
}

function note(id: string, start: number, midi = 69): NoteEvent {
  return {
    id,
    midi,
    start,
    end: start + 0.5,
    velocity: 96,
    hand: "right",
  };
}

function piece(duration = 100, notes: NoteEvent[] = []): PieceDocument {
  return {
    id: "playback-fixture",
    title: "Playback fixture",
    composer: "",
    source: "midi-upload",
    duration,
    notes,
    hasHandData: true,
    notices: [],
  };
}

function setup(document = piece()) {
  const runtime = new FakeToneRuntime();
  const engine = new PlaybackEngine({ createRuntime: () => runtime });
  engine.load(document);
  return { engine, runtime };
}

function deterministicPositions(count: number, duration: number) {
  let state = 0x4a17b2c3;
  return Array.from({ length: count }, () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return (state / 0x1_0000_0000) * duration;
  });
}

const SPEEDS: PlaybackSpeed[] = [1, 0.5, 0.25];

describe("PlaybackEngine", () => {
  it.each(SPEEDS)(
    "[AC1] advances musical position at %sx wall-clock speed",
    async (speed) => {
      const { engine, runtime } = setup();
      engine.setSpeed(speed);
      await engine.play();
      runtime.advance(8);

      expect(engine.getSnapshot().position).toBe(8 * speed);
    },
  );

  it("[AC2] preserves exact position on a live speed change and rebuilds the next note", async () => {
    const { engine, runtime } = setup(piece(20, [note("next", 1.5)]));
    await engine.play();
    const initiallyScheduled = runtime.history.at(-1);
    runtime.advance(0.75);

    const before = engine.getSnapshot().position;
    engine.setSpeed(0.5);
    const after = engine.getSnapshot().position;
    const rescheduled = runtime.history.at(-1);

    expect(after).toBe(before);
    expect(initiallyScheduled?.audioStart).toBe(1.5);
    expect(rescheduled?.noteId).toBe("next");
    expect(rescheduled?.audioStart).toBe(2.25);
    expect(runtime.cancelCount).toBeGreaterThan(1);
  });

  it.each(SPEEDS)(
    "[AC3] seeks within ±100 ms at 20 positions across 10 minutes at %sx",
    async (speed) => {
      const { engine, runtime } = setup(piece(600));
      engine.setSpeed(speed);
      await engine.play();

      for (const target of deterministicPositions(20, 600)) {
        runtime.advance(0.031);
        engine.seek(target);
        expect(Math.abs(engine.getSnapshot().position - target)).toBeLessThanOrEqual(0.1);
      }
    },
  );

  it.each(SPEEDS)(
    "[AC4] wraps 7.8–15.5 fifty times without overshoot or cumulative drift at %sx",
    async (speed) => {
      const { engine, runtime } = setup(piece(100));
      let greatestReportedPosition = 0;
      engine.setSpeed(speed);
      engine.setLoop(7.8, 15.5);
      engine.seek(7.8);
      engine.subscribe((snapshot) => {
        greatestReportedPosition = Math.max(greatestReportedPosition, snapshot.position);
      });
      await engine.play();

      for (let wrap = 0; wrap < 50; wrap += 1) {
        runtime.advance((15.5 - 7.8) / speed);
        expect(engine.getSnapshot().position).toBeCloseTo(7.8, 8);
      }

      expect(greatestReportedPosition).toBeLessThanOrEqual(15.5);
    },
  );

  it("[AC5] restarts from zero or marker A when play is pressed at the end", async () => {
    const withoutLoop = setup(piece(20));
    withoutLoop.engine.seek(20);
    await withoutLoop.engine.play();
    expect(withoutLoop.engine.getSnapshot()).toMatchObject({ position: 0, playing: true });

    const withLoop = setup(piece(20));
    withLoop.engine.setLoop(7.8, 15.5);
    withLoop.engine.seek(20);
    await withLoop.engine.play();
    expect(withLoop.engine.getSnapshot()).toMatchObject({ position: 7.8, playing: true });
  });

  it("[AC6] keeps fewer than 200 live scheduled notes through a dense 30-minute piece", async () => {
    const { engine, runtime } = setup(createDenseFixture());
    await engine.play();

    for (let second = 0; second < 1_800; second += 1) {
      runtime.advance(1);
      expect(runtime.getScheduledNoteCount()).toBeLessThan(200);
    }

    expect(runtime.maxScheduledCount).toBeLessThan(200);
    expect(engine.getSnapshot()).toMatchObject({ position: 1_800, playing: false });
  });

  it("[AC7] constructs audio and starts the sampler only from the first play", async () => {
    const runtime = new FakeToneRuntime();
    let audioContextConstructions = 0;
    const engine = new PlaybackEngine({
      createRuntime: () => {
        audioContextConstructions += 1;
        return runtime;
      },
    });

    engine.load(piece(20, [note("mute-check", 1)]));
    engine.seek(0.5);
    engine.setSpeed(0.5);
    engine.setMuted(true);
    engine.getSnapshot();
    expect(audioContextConstructions).toBe(0);
    expect(runtime.samplerLoadCount).toBe(0);

    await engine.play();
    expect(audioContextConstructions).toBe(1);
    expect(runtime.samplerLoadCount).toBe(1);
    expect(runtime.muted).toBe(true);

    const scheduledBeforeMute = runtime.getScheduledNoteCount();
    const positionBeforeMute = engine.getSnapshot().position;
    engine.setMuted(false);
    expect(runtime.getScheduledNoteCount()).toBe(scheduledBeforeMute);
    expect(engine.getSnapshot().position).toBe(positionBeforeMute);
    engine.pause();
    await engine.play();
    expect(audioContextConstructions).toBe(1);
    expect(runtime.samplerLoadCount).toBe(1);
  });

  it.each(SPEEDS)(
    "[AC8] stays within 50 ms of Tone.now-derived position for 60 seconds at %sx",
    async (speed) => {
      const { engine, runtime } = setup(piece(200));
      engine.seek(17);
      engine.setSpeed(speed);
      await engine.play();
      const audioAnchor = runtime.now();
      let greatestDrift = 0;

      for (let step = 0; step < 600; step += 1) {
        runtime.advance(0.1);
        const audioDerivedPosition = 17 + (runtime.now() - audioAnchor) * speed;
        const drift = Math.abs(engine.getSnapshot().position - audioDerivedPosition);
        greatestDrift = Math.max(greatestDrift, drift);
      }

      expect(greatestDrift).toBeLessThan(0.05);
    },
  );

  it("[AC9] disposes context, timer, events, and subscriptions across repeated cycles", async () => {
    const runtimes: FakeToneRuntime[] = [];

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const fixture = piece(10, [note(`cycle-${cycle}`, 1)]);
      const { engine, runtime } = setup(fixture);
      runtimes.push(runtime);
      let notifications = 0;
      engine.subscribe(() => {
        notifications += 1;
      });
      await engine.play();

      expect(runtime.intervalCount).toBe(1);
      expect(runtime.getScheduledNoteCount()).toBeGreaterThan(0);
      expect(
        (engine as unknown as { listeners: Set<unknown> }).listeners.size,
      ).toBe(1);

      await engine.dispose();
      const notificationsAtDispose = notifications;
      runtime.advance(1);

      expect(runtime.disposeCount).toBe(1);
      expect(runtime.intervalCount).toBe(0);
      expect(runtime.getScheduledNoteCount()).toBe(0);
      expect(
        (engine as unknown as { listeners: Set<unknown> }).listeners.size,
      ).toBe(0);
      expect(notifications).toBe(notificationsAtDispose);
    }

    expect(runtimes.every((runtime) => runtime.disposeCount === 1)).toBe(true);
    expect(runtimes.every((runtime) => runtime.intervalCount === 0)).toBe(true);
    expect(runtimes.every((runtime) => runtime.getScheduledNoteCount() === 0)).toBe(true);
  });

  it("[AC10] keeps pitch fixed and changes only scheduled spacing at slower speeds", async () => {
    const optionKeys = Object.keys(TONE_SAMPLER_OPTIONS);
    expect(optionKeys).not.toContain("playbackRate");
    expect(optionKeys).not.toContain("detune");
    expect(optionKeys).not.toContain("PitchShift");
    const productionSource = readdirSync(resolve(process.cwd(), "src/playback"))
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) =>
        readFileSync(resolve(process.cwd(), "src/playback", file), "utf8"),
      )
      .join("\n");
    expect(productionSource).not.toMatch(/playbackRate|detune|PitchShift/);

    const frequencies: number[] = [];
    const spacings: number[] = [];
    for (const speed of SPEEDS) {
      const { engine, runtime } = setup(
        piece(10, [note("first", 0.25), note("second", 0.5)]),
      );
      engine.setSpeed(speed);
      await engine.play();
      const [first, second] = runtime.history;
      frequencies.push(first.frequencyHz);
      spacings.push(second.audioStart - first.audioStart);
    }

    expect(frequencies).toEqual([440, 440, 440]);
    expect(spacings).toEqual([0.25, 0.5, 1]);
  });
});

describe("playback delivery guardrails", () => {
  it("measures the self-hosted Salamander subset below the 8 MiB cap", () => {
    const sampleDirectory = resolve(process.cwd(), "public/audio/salamander");
    const expectedFiles = Object.values(SALAMANDER_SAMPLE_ROOTS).sort();
    const actualFiles = readdirSync(sampleDirectory)
      .filter((file) => file.endsWith(".mp3"))
      .sort();
    const measuredBytes = actualFiles.reduce(
      (total, file) => total + statSync(resolve(sampleDirectory, file)).size,
      0,
    );

    expect(actualFiles).toEqual(expectedFiles);
    expect(measuredBytes).toBe(SALAMANDER_SAMPLE_BYTES);
    expect(measuredBytes).toBeLessThanOrEqual(SALAMANDER_SAMPLE_BUDGET_BYTES);
  });

  it("exports the required Home-footer attribution and records its license", () => {
    const attribution = readFileSync(
      resolve(process.cwd(), "public/audio/salamander/ATTRIBUTION.md"),
      "utf8",
    );

    expect(SALAMANDER_ATTRIBUTION).toContain("Alexander Holm");
    expect(SALAMANDER_ATTRIBUTION).toContain("CC BY 3.0");
    expect(attribution).toContain("1,036,423 bytes");
    expect(attribution).toContain("Creative Commons Attribution 3.0 Unported");
  });

  it("keeps src/playback framework-free", () => {
    const playbackDirectory = resolve(process.cwd(), "src/playback");
    const source = readdirSync(playbackDirectory)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => readFileSync(resolve(playbackDirectory, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/from ["']react["']/);
    expect(source).not.toMatch(/import\(["']react["']\)/);
  });
});
