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
}

export type PlaybackRuntimeFactory = () =>
  | PlaybackRuntime
  | Promise<PlaybackRuntime>;
