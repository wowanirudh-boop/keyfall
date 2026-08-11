import { Midi } from "@tonejs/midi";

function midiAtTempo(bpm = 120) {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  return midi;
}

export function knownMidiBytes() {
  const midi = midiAtTempo();
  midi.name = "Known timing fixture";
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 0.25, duration: 0.5, velocity: 0.8 });
  track.addNote({ midi: 64, time: 1.25, duration: 0.25, velocity: 0.7 });
  track.addNote({ midi: 67, time: 2.5, duration: 0.75, velocity: 0.6 });
  return midi.toArray();
}

export function tempoChangeMidiBytes() {
  const midi = new Midi();
  midi.header.tempos = [
    { ticks: 0, bpm: 120 },
    { ticks: 960, bpm: 60 },
  ];
  midi.header.update();
  const track = midi.addTrack();
  track.addNote({ midi: 60, ticks: 0, durationTicks: 240 });
  track.addNote({ midi: 62, ticks: 960, durationTicks: 240 });
  track.addNote({ midi: 64, ticks: 1_440, durationTicks: 240 });
  return midi.toArray();
}

export function percussionOnlyMidiBytes() {
  const midi = midiAtTempo();
  const track = midi.addTrack();
  track.channel = 9;
  track.addNote({ midi: 36, time: 0, duration: 0.1 });
  return midi.toArray();
}

export function outOfRangeMidiBytes() {
  const midi = midiAtTempo();
  const track = midi.addTrack();
  track.addNote({ midi: 20, time: 0, duration: 0.25 });
  track.addNote({ midi: 21, time: 0.5, duration: 0.25 });
  track.addNote({ midi: 108, time: 1, duration: 0.25 });
  track.addNote({ midi: 109, time: 1.5, duration: 0.25 });
  return midi.toArray();
}

export function twoTrackMidiBytes() {
  const midi = midiAtTempo();
  const highTrack = midi.addTrack();
  highTrack.addNote({ midi: 72, time: 0, duration: 0.25 });
  highTrack.addNote({ midi: 76, time: 1, duration: 0.25 });
  const lowTrack = midi.addTrack();
  lowTrack.addNote({ midi: 40, time: 0.5, duration: 0.25 });
  lowTrack.addNote({ midi: 45, time: 1.5, duration: 0.25 });
  return midi.toArray();
}

export function singleTrackMidiBytes() {
  const midi = midiAtTempo();
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 0, duration: 0.25 });
  track.addNote({ midi: 64, time: 0.5, duration: 0.25 });
  return midi.toArray();
}

export function longMidiBytes() {
  const midi = midiAtTempo();
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 1_800, duration: 0.001 });
  return midi.toArray();
}

export function emptyMidiBytes() {
  return midiAtTempo().toArray();
}
