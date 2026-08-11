import type { PieceDocument } from "../music/types";
import type {
  PlaybackRuntime,
  PlaybackRuntimeFactory,
  ScheduledPlaybackNote,
} from "./runtime";
import { createTonePlaybackRuntime } from "./TonePlaybackRuntime";

export type PlaybackSpeed = 1 | 0.5 | 0.25;

export interface PlaybackLoop {
  a: number | null;
  b: number | null;
}

export interface PlaybackSnapshot {
  position: number;
  duration: number;
  playing: boolean;
  speed: PlaybackSpeed;
  loop: PlaybackLoop;
  muted: boolean;
}

export interface PlaybackEngineOptions {
  createRuntime?: PlaybackRuntimeFactory;
}

const SCHEDULE_AHEAD_SECONDS = 2;
const UPDATE_INTERVAL_SECONDS = 0.025;
const END_RESTART_THRESHOLD_SECONDS = 0.01;
const MINIMUM_NOTE_DURATION_SECONDS = 0.01;
const CLOCK_COMPARISON_EPSILON_SECONDS = 1e-9;

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function firstNoteAtOrAfter(piece: PieceDocument, position: number) {
  let low = 0;
  let high = piece.notes.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (piece.notes[middle].start < position) low = middle + 1;
    else high = middle;
  }

  return low;
}

export class PlaybackEngine {
  private readonly createRuntime: PlaybackRuntimeFactory;
  private readonly listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  private piece: PieceDocument | null = null;
  private runtime: PlaybackRuntime | null = null;
  private runtimePromise: Promise<PlaybackRuntime> | null = null;
  private runtimeDisposePromise: Promise<void> | null = null;
  private timerId: number | null = null;
  private anchorPosition = 0;
  private anchorAudioTime = 0;
  private playing = false;
  private speed: PlaybackSpeed = 1;
  private loop: PlaybackLoop = { a: null, b: null };
  private muted = false;
  private nextNoteIndex = 0;
  private playRequest = 0;
  private disposed = false;

  constructor({ createRuntime = createTonePlaybackRuntime }: PlaybackEngineOptions = {}) {
    this.createRuntime = createRuntime;
  }

  load(piece: PieceDocument) {
    if (this.disposed) return;
    this.playRequest += 1;
    this.stopTimer();
    this.runtime?.cancelScheduledNotes();
    this.piece = piece;
    this.anchorPosition = 0;
    this.anchorAudioTime = this.runtime?.now() ?? 0;
    this.playing = false;
    this.loop = { a: null, b: null };
    this.nextNoteIndex = 0;
    this.notify();
  }

  async play() {
    if (this.disposed || this.playing || !this.piece) return;
    const request = ++this.playRequest;
    const runtime = await this.ensureRuntime();

    if (!runtime || this.disposed || request !== this.playRequest || this.playing || !this.piece) {
      return;
    }

    if (this.anchorPosition >= this.piece.duration - END_RESTART_THRESHOLD_SECONDS) {
      this.anchorPosition = this.loop.a ?? 0;
    }

    this.anchorAudioTime = runtime.now();
    this.playing = true;
    runtime.setMuted(this.muted);
    runtime.startSamplerLoad();
    this.rebuildQueue(this.anchorPosition, this.anchorAudioTime);
    this.timerId = runtime.setInterval(this.tick, UPDATE_INTERVAL_SECONDS);
    this.notify();
  }

  pause() {
    if (this.disposed) return;
    this.playRequest += 1;

    if (this.playing && this.runtime) {
      const now = this.runtime.now();
      this.anchorPosition = this.synchronizeAt(now);
      this.anchorAudioTime = now;
    }

    this.playing = false;
    this.stopTimer();
    this.runtime?.cancelScheduledNotes();
    this.notify();
  }

  seek(position: number) {
    if (this.disposed || !this.piece) return;
    const now = this.runtime?.now() ?? 0;
    this.anchorPosition = Math.min(this.piece.duration, Math.max(0, position));
    this.anchorAudioTime = now;

    if (this.playing && this.runtime) {
      this.anchorPosition = this.synchronizeAt(now);
      if (this.playing) this.rebuildQueue(this.anchorPosition, now);
    }

    this.notify();
  }

  setSpeed(speed: PlaybackSpeed) {
    if (this.disposed || speed === this.speed) return;
    const now = this.runtime?.now() ?? 0;

    if (this.playing && this.runtime) {
      this.anchorPosition = this.synchronizeAt(now);
      this.anchorAudioTime = now;
    }

    this.speed = speed;
    if (this.playing && this.runtime) {
      this.rebuildQueue(this.anchorPosition, now);
    }
    this.notify();
  }

  setLoop(a: number | null, b: number | null) {
    if (this.disposed) return;
    const now = this.runtime?.now() ?? 0;

    if (this.playing && this.runtime) {
      this.anchorPosition = this.synchronizeAt(now);
      this.anchorAudioTime = now;
    }

    this.loop = { a, b };
    if (this.playing && this.runtime) {
      this.anchorPosition = this.synchronizeAt(now);
      if (this.playing) this.rebuildQueue(this.anchorPosition, now);
    }
    this.notify();
  }

  setMuted(muted: boolean) {
    if (this.disposed || muted === this.muted) return;
    this.muted = muted;
    this.runtime?.setMuted(muted);
    this.notify();
  }

  subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): PlaybackSnapshot {
    const position =
      this.playing && this.runtime
        ? this.synchronizeAt(this.runtime.now())
        : this.anchorPosition;

    return {
      position,
      duration: this.piece?.duration ?? 0,
      playing: this.playing,
      speed: this.speed,
      loop: { ...this.loop },
      muted: this.muted,
    };
  }

  async dispose() {
    if (this.disposed) {
      await this.runtimeDisposePromise;
      return;
    }

    this.disposed = true;
    this.playRequest += 1;
    this.playing = false;
    this.stopTimer();
    this.listeners.clear();

    const runtime = this.runtime ?? (this.runtimePromise ? await this.runtimePromise : null);
    if (runtime) {
      runtime.cancelScheduledNotes();
      this.runtimeDisposePromise ??= Promise.resolve(runtime.dispose());
      await this.runtimeDisposePromise;
    }

    this.runtime = null;
    this.runtimePromise = null;
    this.piece = null;
  }

  private readonly tick = () => {
    if (!this.playing || !this.runtime) return;
    const now = this.runtime.now();
    const position = this.synchronizeAt(now);
    if (this.playing) this.topUpQueue(position, now);
    this.notify();
  };

  private async ensureRuntime() {
    if (this.runtime) return this.runtime;
    this.runtimePromise ??= Promise.resolve(this.createRuntime());
    const runtime = await this.runtimePromise;

    if (this.disposed) {
      this.runtimeDisposePromise ??= Promise.resolve(runtime.dispose());
      await this.runtimeDisposePromise;
      return null;
    }

    this.runtime = runtime;
    return runtime;
  }

  private synchronizeAt(audioTime: number) {
    if (!this.playing || !this.piece) return this.anchorPosition;
    const position =
      this.anchorPosition + (audioTime - this.anchorAudioTime) * this.speed;
    const { a, b } = this.loop;

    if (
      a !== null &&
      b !== null &&
      position >= b - CLOCK_COMPARISON_EPSILON_SECONDS
    ) {
      this.anchorPosition = a;
      this.anchorAudioTime = audioTime;
      if (this.runtime) this.rebuildQueue(a, audioTime);
      return a;
    }

    if (position >= this.piece.duration - CLOCK_COMPARISON_EPSILON_SECONDS) {
      this.anchorPosition = this.piece.duration;
      this.anchorAudioTime = audioTime;
      this.playing = false;
      this.stopTimer();
      this.runtime?.cancelScheduledNotes();
      return this.anchorPosition;
    }

    return position;
  }

  private rebuildQueue(position: number, audioTime: number) {
    if (!this.runtime || !this.piece) return;
    this.runtime.cancelScheduledNotes();
    this.nextNoteIndex = firstNoteAtOrAfter(this.piece, position);
    this.topUpQueue(position, audioTime);
  }

  private topUpQueue(position: number, audioTime: number) {
    if (!this.runtime || !this.piece) return;
    const loopEnd = this.loop.a !== null && this.loop.b !== null ? this.loop.b : null;
    const musicalHorizon = position + SCHEDULE_AHEAD_SECONDS * this.speed;

    while (this.nextNoteIndex < this.piece.notes.length) {
      const note = this.piece.notes[this.nextNoteIndex];
      if (note.start > musicalHorizon) break;
      if (loopEnd !== null && note.start >= loopEnd) break;

      const musicalEnd = Math.min(note.end, loopEnd ?? this.piece.duration);
      const scheduled: ScheduledPlaybackNote = {
        noteId: note.id,
        midi: note.midi,
        frequencyHz: midiToFrequency(note.midi),
        musicalStart: note.start,
        audioStart: audioTime + Math.max(0, (note.start - position) / this.speed),
        audioDuration: Math.max(
          MINIMUM_NOTE_DURATION_SECONDS,
          (musicalEnd - note.start) / this.speed,
        ),
        velocity: Math.min(1, Math.max(0, note.velocity / 127)),
      };
      this.runtime.scheduleNote(scheduled);
      this.nextNoteIndex += 1;
    }
  }

  private stopTimer() {
    if (this.timerId === null || !this.runtime) return;
    this.runtime.clearInterval(this.timerId);
    this.timerId = null;
  }

  private notify() {
    if (this.listeners.size === 0) return;
    const snapshot = this.getSnapshot();
    for (const listener of [...this.listeners]) listener(snapshot);
  }
}
