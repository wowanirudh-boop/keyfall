import * as Tone from "tone";

import type { PlaybackRuntime, ScheduledPlaybackNote } from "./runtime";
import { TONE_SAMPLER_OPTIONS } from "./sampler";

export async function createTonePlaybackRuntime(): Promise<PlaybackRuntime> {
  let context = Tone.getContext();

  if (context.state === "closed") {
    context = new Tone.Context({ latencyHint: "interactive" });
    Tone.setContext(context);
  }

  await Tone.start();

  const output = new Tone.Gain(1).toDestination();
  const synth = new Tone.PolySynth(Tone.Synth).connect(output);
  const noteTimeouts = new Map<number, number>();
  const intervalIds = new Set<number>();
  let nextNoteId = 0;
  let sampler: InstanceType<typeof Tone.Sampler> | null = null;
  let samplerReady = false;
  let samplerLoadStarted = false;
  let disposed = false;

  const cancelScheduledNotes = () => {
    for (const timeoutId of noteTimeouts.values()) {
      context.clearTimeout(timeoutId);
    }
    noteTimeouts.clear();
    const now = context.now();
    synth.releaseAll(now);
    sampler?.releaseAll(now);
  };

  return {
    now: () => context.now(),
    setInterval(callback, intervalSeconds) {
      const id = context.setInterval(callback, intervalSeconds);
      intervalIds.add(id);
      return id;
    },
    clearInterval(id) {
      context.clearInterval(id);
      intervalIds.delete(id);
    },
    scheduleNote(note: ScheduledPlaybackNote) {
      const id = ++nextNoteId;
      const timeoutId = context.setTimeout(() => {
        noteTimeouts.delete(id);
        if (disposed) return;

        const instrument = samplerReady && sampler ? sampler : synth;
        instrument.triggerAttackRelease(
          note.frequencyHz,
          note.audioDuration,
          note.audioStart,
          note.velocity,
        );
      }, Math.max(0, note.audioStart - context.now()));
      noteTimeouts.set(id, timeoutId);
    },
    cancelScheduledNotes,
    getScheduledNoteCount: () => noteTimeouts.size,
    setMuted(muted) {
      output.gain.setValueAtTime(muted ? 0 : 1, context.now());
    },
    startSamplerLoad() {
      if (samplerLoadStarted || disposed) return;
      samplerLoadStarted = true;
      sampler = new Tone.Sampler({
        ...TONE_SAMPLER_OPTIONS,
        onload: () => {
          samplerReady = !disposed;
        },
        onerror: () => {
          samplerReady = false;
        },
      }).connect(output);
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      cancelScheduledNotes();
      for (const intervalId of intervalIds) {
        context.clearInterval(intervalId);
      }
      intervalIds.clear();
      sampler?.dispose();
      synth.dispose();
      output.dispose();

      if (context instanceof Tone.Context) {
        await context.close();
        context.dispose();
      }
    },
  };
}
