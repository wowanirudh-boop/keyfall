import { createDenseFixture, type DenseFixtureNote } from "/src/testing/denseFixture.ts";

const PIXELS_PER_SECOND = 140;
const LOOKAHEAD_SECONDS = 3;
const WINDOW_PADDING_SECONDS = 2;
const INITIAL_TIME_SECONDS = 15 * 60;
const MEASUREMENT_SECONDS = 5;

type Strategy = "full" | "windowed";

interface WaterfallResult {
  strategy: Strategy;
  viewport: string;
  pieceDurationSeconds: number;
  totalNotes: number;
  renderedNotesAtEnd: number;
  firstPaintMs: number;
  playbackFps: number;
  heapStartMb: number | null;
  heapEndMb: number | null;
  heapDeltaMb: number | null;
  seekTargetSeconds: number;
  seekRepaintMs: number;
  layerTransform: string;
  layerWillChange: string;
}

declare global {
  interface Window {
    __spikeResult?: WaterfallResult;
  }
}

const params = new URLSearchParams(window.location.search);
const strategy: Strategy = params.get("strategy") === "full" ? "full" : "windowed";
const status = document.querySelector<HTMLElement>("#status")!;
const result = document.querySelector<HTMLElement>("#result")!;
const layer = document.querySelector<HTMLElement>("#note-layer")!;
const piece = createDenseFixture();
const startedAt = performance.now();
let currentNotes: DenseFixtureNote[] = [];

function readHeapMb() {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize: number };
  }).memory;

  return memory ? memory.usedJSHeapSize / 1024 / 1024 : null;
}

function notesAt(time: number) {
  if (strategy === "full") {
    return piece.notes;
  }

  const start = time - WINDOW_PADDING_SECONDS;
  const end = time + LOOKAHEAD_SECONDS + WINDOW_PADDING_SECONDS;
  return piece.notes.filter((note) => note.start <= end && note.end >= start);
}

function renderNotes(time: number) {
  currentNotes = notesAt(time);
  const fragment = document.createDocumentFragment();

  for (const note of currentNotes) {
    const element = document.createElement("div");
    element.className = `note ${note.hand}`;
    element.style.left = `${((note.midi - 21) / 88) * 100}%`;
    element.style.width = `${Math.max(0.55, 100 / 88)}%`;
    element.style.top = `${note.start * PIXELS_PER_SECOND}px`;
    element.style.height = `${Math.max(3, (note.end - note.start) * PIXELS_PER_SECOND)}px`;
    fragment.append(element);
  }

  layer.replaceChildren(fragment);
}

function positionLayer(time: number) {
  const keyboardY = 700 - 90;
  layer.style.transform = `translate3d(0, ${keyboardY - time * PIXELS_PER_SECOND}px, 0)`;
}

function afterPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function measurePlayback(initialTime: number) {
  return new Promise<number>((resolve) => {
    const start = performance.now();
    let frames = 0;
    let lastWindowQuarter = -1;

    function frame(now: number) {
      const elapsedSeconds = (now - start) / 1000;
      const time = initialTime + elapsedSeconds;
      frames += 1;

      if (strategy === "windowed") {
        const windowQuarter = Math.floor(time * 4);
        if (windowQuarter !== lastWindowQuarter) {
          renderNotes(time);
          lastWindowQuarter = windowQuarter;
        }
      }

      positionLayer(time);

      if (elapsedSeconds < MEASUREMENT_SECONDS) {
        requestAnimationFrame(frame);
      } else {
        resolve(frames / elapsedSeconds);
      }
    }

    requestAnimationFrame(frame);
  });
}

async function measureSeek(target: number) {
  const seekStart = performance.now();
  renderNotes(target);
  positionLayer(target);
  await afterPaint();
  return performance.now() - seekStart;
}

async function run() {
  status.textContent = `Measuring strategy ${strategy === "full" ? "A — full layer" : "B — windowed"}…`;
  renderNotes(INITIAL_TIME_SECONDS);
  positionLayer(INITIAL_TIME_SECONDS);
  await afterPaint();
  const firstPaintMs = performance.now() - startedAt;
  const heapAtStart = readHeapMb();
  const playbackFps = await measurePlayback(INITIAL_TIME_SECONDS);
  const seekTargetSeconds = Math.round(piece.duration * 0.61803398875 * 1000) / 1000;
  const seekRepaintMs = await measureSeek(seekTargetSeconds);
  const heapAtEnd = readHeapMb();
  const computed = getComputedStyle(layer);

  window.__spikeResult = {
    strategy,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    pieceDurationSeconds: piece.duration,
    totalNotes: piece.notes.length,
    renderedNotesAtEnd: currentNotes.length,
    firstPaintMs: Math.round(firstPaintMs * 100) / 100,
    playbackFps: Math.round(playbackFps * 100) / 100,
    heapStartMb: heapAtStart === null ? null : Math.round(heapAtStart * 100) / 100,
    heapEndMb: heapAtEnd === null ? null : Math.round(heapAtEnd * 100) / 100,
    heapDeltaMb:
      heapAtStart === null || heapAtEnd === null
        ? null
        : Math.round((heapAtEnd - heapAtStart) * 100) / 100,
    seekTargetSeconds,
    seekRepaintMs: Math.round(seekRepaintMs * 100) / 100,
    layerTransform: computed.transform,
    layerWillChange: computed.willChange,
  };

  status.textContent = "Measurement complete";
  result.textContent = JSON.stringify(window.__spikeResult, null, 2);
  document.title = `DONE ${strategy} — waterfall scale spike`;
}

void run();

export {};
