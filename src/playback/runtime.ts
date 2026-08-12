export interface ScheduledPlaybackNote {
  noteId: string;
  midi: number;
  frequencyHz: number;
  musicalStart: number;
  audioStart: number;
  audioDuration: number;
  velocity: number;
}

export interface PlaybackRuntime {
  now(): number;
  setInterval(callback: () => void, intervalSeconds: number): number;
  clearInterval(id: number): void;
  scheduleNote(note: ScheduledPlaybackNote): void;
  cancelScheduledNotes(): void;
  getScheduledNoteCount(): number;
  setOutputGain(gain: number): void;
  startSamplerLoad(): void;
  dispose(): void | Promise<void>;
  /**
   * Underlying audio context state. Optional: fakes in tests are always
   * running, so only the Tone runtime implements it. Anything other than
   * "running" means the browser is holding audio back (D-024).
   */
  getAudioState?(): string;
}

export type PlaybackRuntimeFactory = () =>
  | PlaybackRuntime
  | Promise<PlaybackRuntime>;
