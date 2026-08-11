const RUN_DURATION_MS = 60_000;
const BEAT_SECONDS = 0.5;

const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const downloadButton = document.querySelector("#download");
const statusElement = document.querySelector("#status");
const devicesElement = document.querySelector("#devices");
const resultElement = document.querySelector("#result");
const eventsElement = document.querySelector("#events");
const promptText = document.querySelector("#prompt-text");

let midiAccess = null;
let audioContext = null;
let clockTimer = null;
let metronomeTimer = null;
let stopTimer = null;
let runStartedAt = 0;
let nextBeatContextTime = 0;
let clockSamples = [];
let noteSamples = [];
let portEvents = [];
let permissionFlow = [];
let latestResult = null;

function logPermission(step, detail = "") {
  permissionFlow.push({ atPerformanceMs: performance.now(), step, detail });
  renderEvents();
}

function renderEvents() {
  eventsElement.textContent = JSON.stringify({ permissionFlow, portEvents }, null, 2);
}

function portSnapshot(port) {
  return {
    id: port.id,
    manufacturer: port.manufacturer,
    name: port.name,
    state: port.state,
    connection: port.connection,
    type: port.type,
  };
}

function renderDevices() {
  if (!midiAccess) {
    devicesElement.textContent = "No MIDIAccess yet.";
    return;
  }

  devicesElement.textContent = JSON.stringify(
    {
      inputs: [...midiAccess.inputs.values()].map(portSnapshot),
      outputs: [...midiAccess.outputs.values()].map(portSnapshot),
    },
    null,
    2,
  );
}

function sampleClock(source) {
  const sampledAtPerformanceMs = performance.now();
  const { contextTime, performanceTime } = audioContext.getOutputTimestamp();
  const offsetMs = performanceTime - contextTime * 1000;
  const sample = {
    source,
    sampledAtPerformanceMs,
    contextTimeSeconds: contextTime,
    performanceTimeMs: performanceTime,
    offsetMs,
    outputLatencyMs: audioContext.outputLatency * 1000,
  };
  clockSamples.push(sample);
  return sample;
}

function handleMidiMessage(event) {
  const [status, note, velocity] = event.data;
  if ((status & 0xf0) !== 0x90 || velocity === 0) {
    return;
  }

  const clock = sampleClock("note-on");
  const eventContextTimeSeconds = (event.timeStamp - clock.offsetMs) / 1000;
  const audibleEventContextTimeSeconds =
    eventContextTimeSeconds - audioContext.outputLatency;
  const nearestBeat =
    nextBeatContextTime +
    Math.round((eventContextTimeSeconds - nextBeatContextTime) / BEAT_SECONDS) *
      BEAT_SECONDS;

  noteSamples.push({
    inputId: event.currentTarget.id,
    note,
    velocity,
    midiEventPerformanceMs: event.timeStamp,
    clockOffsetMs: clock.offsetMs,
    eventContextTimeSeconds,
    outputLatencyMs: clock.outputLatencyMs,
    audibleEventContextTimeSeconds,
    nearestAudibleBeatContextTimeSeconds: nearestBeat + audioContext.outputLatency,
    tapResidualMs:
      (audibleEventContextTimeSeconds -
        (nearestBeat + audioContext.outputLatency)) *
      1000,
  });
}

function subscribeInputs() {
  for (const input of midiAccess.inputs.values()) {
    input.onmidimessage = handleMidiMessage;
  }
}

function scheduleMetronome() {
  while (nextBeatContextTime < audioContext.currentTime + 0.15) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, nextBeatContextTime);
    gain.gain.exponentialRampToValueAtTime(0.12, nextBeatContextTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, nextBeatContextTime + 0.05);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(nextBeatContextTime);
    oscillator.stop(nextBeatContextTime + 0.06);
    nextBeatContextTime += BEAT_SECONDS;
  }
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values) {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function driftOverRun(samples) {
  const origin = samples[0].sampledAtPerformanceMs;
  const xs = samples.map((sample) => (sample.sampledAtPerformanceMs - origin) / 1000);
  const ys = samples.map((sample) => sample.offsetMs);
  const xMean = mean(xs);
  const yMean = mean(ys);
  const numerator = xs.reduce(
    (total, value, index) => total + (value - xMean) * (ys[index] - yMean),
    0,
  );
  const denominator = xs.reduce((total, value) => total + (value - xMean) ** 2, 0);
  const slopeMsPerSecond = denominator === 0 ? 0 : numerator / denominator;
  return {
    slopeMsPerSecond,
    fittedDriftOver60SecondsMs: slopeMsPerSecond * 60,
  };
}

function calculateResult() {
  const offsets = clockSamples.map((sample) => sample.offsetMs);
  const latencies = clockSamples.map((sample) => sample.outputLatencyMs);
  const drift = offsets.length > 1 ? driftOverRun(clockSamples) : null;

  return {
    browserUserAgent: navigator.userAgent,
    requestedMidiOptions: { sysex: false },
    exactPermissionPromptText: promptText.value,
    permissionFlow,
    durationMs: performance.now() - runStartedAt,
    clockSampleCount: clockSamples.length,
    noteOnCount: noteSamples.length,
    meanOffsetMs: offsets.length ? mean(offsets) : null,
    offsetStandardDeviationMs: offsets.length ? standardDeviation(offsets) : null,
    drift,
    meanOutputLatencyMs: latencies.length ? mean(latencies) : null,
    tapResidualStandardDeviationMs:
      noteSamples.length > 1
        ? standardDeviation(noteSamples.map((sample) => sample.tapResidualMs))
        : null,
    portsAtEnd: midiAccess
      ? {
          inputs: [...midiAccess.inputs.values()].map(portSnapshot),
          outputs: [...midiAccess.outputs.values()].map(portSnapshot),
        }
      : null,
    powerCycleEvents: portEvents,
    noteSamples,
  };
}

function stopRun() {
  clearInterval(clockTimer);
  clearInterval(metronomeTimer);
  clearTimeout(stopTimer);
  clockTimer = null;
  metronomeTimer = null;
  latestResult = calculateResult();
  resultElement.textContent = JSON.stringify(latestResult, null, 2);
  statusElement.textContent = "Run complete";
  startButton.disabled = false;
  stopButton.disabled = true;
  downloadButton.disabled = false;
}

async function startRun() {
  startButton.disabled = true;
  downloadButton.disabled = true;
  statusElement.textContent = "Requesting MIDI permission…";
  permissionFlow = [];
  portEvents = [];
  clockSamples = [];
  noteSamples = [];
  latestResult = null;
  logPermission("request-started", "navigator.requestMIDIAccess({ sysex: false })");

  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    logPermission("request-resolved", "MIDIAccess granted without SysEx");
  } catch (error) {
    logPermission("request-rejected", String(error));
    statusElement.textContent = `MIDI request failed: ${error}`;
    startButton.disabled = false;
    return;
  }

  audioContext ??= new AudioContext();
  await audioContext.resume();
  midiAccess.onstatechange = (event) => {
    portEvents.push({ atPerformanceMs: performance.now(), port: portSnapshot(event.port) });
    subscribeInputs();
    renderDevices();
    sampleClock("device-change");
    renderEvents();
  };
  subscribeInputs();
  renderDevices();
  runStartedAt = performance.now();
  nextBeatContextTime = audioContext.currentTime + 0.25;
  sampleClock("attempt-start");
  scheduleMetronome();
  clockTimer = setInterval(() => sampleClock("periodic"), 250);
  metronomeTimer = setInterval(scheduleMetronome, 50);
  stopTimer = setTimeout(stopRun, RUN_DURATION_MS);
  stopButton.disabled = false;
  statusElement.textContent = "Running — play quarter notes with the metronome and power-cycle once";
}

function downloadResult() {
  const blob = new Blob([JSON.stringify(latestResult, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `rp302-midi-clock-${navigator.userAgent.includes("Edg/") ? "edge" : "chrome"}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

startButton.addEventListener("click", startRun);
stopButton.addEventListener("click", stopRun);
downloadButton.addEventListener("click", downloadResult);
