"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Piece = {
  id: number;
  title: string;
  composer: string;
  duration: string;
  seconds: number;
  source: string;
  color: string;
  lastOpened?: string;
  aliases: string[];
};

type Screen = "home" | "player";

const pieces: Piece[] = [
  {
    id: 1,
    title: "Für Elise",
    composer: "Ludwig van Beethoven",
    duration: "3:18",
    seconds: 198,
    source: "Mutopia Project",
    color: "coral",
    lastOpened: "Today",
    aliases: ["fur elise", "bagatelle no 25", "woo 59"],
  },
  {
    id: 2,
    title: "Gymnopédie No. 1",
    composer: "Erik Satie",
    duration: "3:42",
    seconds: 222,
    source: "Mutopia Project",
    color: "blue",
    lastOpened: "Yesterday",
    aliases: ["gymnopedie", "gymnopedie 1"],
  },
  {
    id: 3,
    title: "Clair de Lune",
    composer: "Claude Debussy",
    duration: "5:08",
    seconds: 308,
    source: "Mutopia Project",
    color: "gold",
    lastOpened: "3 days ago",
    aliases: ["suite bergamasque", "moonlight debussy"],
  },
  {
    id: 4,
    title: "Prelude in C Major",
    composer: "Johann Sebastian Bach",
    duration: "2:12",
    seconds: 132,
    source: "Mutopia Project",
    color: "green",
    aliases: ["bwv 846", "well tempered clavier"],
  },
  {
    id: 5,
    title: "Moonlight Sonata",
    composer: "Ludwig van Beethoven",
    duration: "6:06",
    seconds: 366,
    source: "Mutopia Project",
    color: "violet",
    aliases: ["piano sonata 14", "op 27 no 2"],
  },
];

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const blackClasses = new Set([1, 3, 6, 8, 10]);
const pianoKeys = Array.from({ length: 88 }, (_, index) => {
  const midi = index + 21;
  const pitchClass = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { midi, name: `${noteNames[pitchClass]}${octave}`, black: blackClasses.has(pitchClass) };
});
const whiteKeys = pianoKeys.filter((key) => !key.black);
const blackKeys = pianoKeys.filter((key) => key.black);

const pattern = [
  [64, 0.0, 0.42, "right"], [63, 0.48, 0.3, "right"], [64, 0.9, 0.38, "right"],
  [63, 1.32, 0.32, "right"], [64, 1.72, 0.34, "right"], [71, 2.15, 0.72, "right"],
  [69, 2.88, 0.68, "right"], [67, 3.58, 0.68, "right"], [57, 0.02, 1.3, "left"],
  [64, 1.35, 1.15, "left"], [69, 2.7, 1.2, "left"], [52, 4.35, 0.55, "left"],
  [56, 4.35, 0.55, "left"], [64, 4.42, 0.36, "right"], [68, 4.86, 0.36, "right"],
  [71, 5.3, 0.36, "right"], [72, 5.74, 0.8, "right"], [64, 5.2, 1.25, "left"],
] as const;

const demoNotes = Array.from({ length: 40 }, (_, repetition) =>
  pattern.map(([midi, time, duration, hand], noteIndex) => ({
    id: `${repetition}-${noteIndex}`,
    midi,
    time: repetition * 6.7 + time,
    duration,
    hand,
  })),
).flat();

function formatTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function Mark({ variant = "small" }: { variant?: "small" | "large" }) {
  return (
    <span className={`brand-mark brand-mark--${variant}`} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

function PieceArtwork({ piece, index = 0 }: { piece: Piece; index?: number }) {
  return (
    <div className={`piece-art piece-art--${piece.color}`} aria-hidden="true">
      <div className="piece-art__halo" />
      <div className="piece-art__note piece-art__note--one" />
      <div className="piece-art__note piece-art__note--two" />
      <span>{String(index + 1).padStart(2, "0")}</span>
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedPiece, setSelectedPiece] = useState(pieces[0]);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return pieces.slice(0, 3);
    return pieces.filter((piece) =>
      normalize([piece.title, piece.composer, ...piece.aliases].join(" ")).includes(needle),
    );
  }, [query]);

  function openPiece(piece: Piece) {
    setSelectedPiece(piece);
    setScreen("player");
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["mid", "midi", "musicxml", "xml", "mxl"].includes(extension)) {
      setUploadMessage("Please choose a MIDI or MusicXML file.");
      return;
    }
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    openPiece({
      id: Date.now(), title, composer: "Uploaded piece", duration: "2:48", seconds: 168,
      source: "Your upload", color: "blue", aliases: [],
    });
  }

  if (screen === "player") {
    return <Player piece={selectedPiece} onBack={() => setScreen("home")} />;
  }

  return (
    <main className="home-shell">
      <header className="site-header">
        <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <Mark />
          <span>Keyfall</span>
        </button>
        <nav aria-label="Main navigation">
          <a href="#discover">Discover</a>
          <a href="#my-pieces">My pieces</a>
        </nav>
        <button className="header-action" onClick={() => fileInput.current?.click()}>
          <span aria-hidden="true">＋</span> Add a piece
        </button>
      </header>

      <section className="hero" id="discover">
        <div className="hero-copy">
          <div className="eyebrow"><span /> YOUR PRACTICE, IN FLOW</div>
          <h1>See the music.<br /><em>Feel the timing.</em></h1>
          <p className="hero-lede">A calmer way to learn piano—one note at a time, at exactly your pace.</p>

          <div className={`search-box ${showResults ? "search-box--open" : ""}`}>
            <span className="search-icon" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              placeholder="Search a piece or composer"
              aria-label="Search pieces"
            />
            {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
            {showResults && (
              <div className="search-results">
                <div className="search-results__label">{query ? `${results.length} MATCH${results.length === 1 ? "" : "ES"}` : "POPULAR NOW"}</div>
                {results.length ? results.map((piece, index) => (
                  <button className="search-result" key={piece.id} onClick={() => openPiece(piece)}>
                    <PieceArtwork piece={piece} index={index} />
                    <span className="search-result__copy"><strong>{piece.title}</strong><small>{piece.composer}</small></span>
                    <span className="search-result__duration">{piece.duration}</span>
                    <span className="round-arrow" aria-hidden="true">↗</span>
                  </button>
                )) : (
                  <div className="empty-result"><strong>No catalog match yet.</strong><span>Try another title or upload your own file.</span><button onClick={() => fileInput.current?.click()}>Upload a piece</button></div>
                )}
              </div>
            )}
          </div>

          <div className="hero-meta">
            <span><b>12</b> curated classics</span>
            <i />
            <span><b>100%</b> local & private</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Preview of the falling-note piano player">
          <div className="preview-card">
            <div className="preview-card__top">
              <div><span>NOW PRACTICING</span><strong>Für Elise</strong><small>Beethoven · WoO 59</small></div>
              <button onClick={() => openPiece(pieces[0])} aria-label="Open player">↗</button>
            </div>
            <div className="mini-waterfall">
              <div className="mini-glow" />
              {[8, 22, 34, 48, 62, 77].map((left, index) => (
                <i key={left} className={index % 3 === 0 ? "left-hand" : "right-hand"} style={{ left: `${left}%`, top: `${8 + (index * 17) % 65}%`, height: `${38 + (index % 3) * 16}px`, animationDelay: `${index * -0.42}s` }} />
              ))}
              <div className="mini-keyboard">
                {Array.from({ length: 22 }, (_, index) => <span key={index} />)}
              </div>
            </div>
            <div className="preview-transport">
              <button className="preview-play" onClick={() => openPiece(pieces[0])}>▶</button>
              <div><span style={{ width: "36%" }} /><i /></div>
              <time>0:42</time><small>0.5×</small>
            </div>
          </div>
          <div className="floating-note floating-note--top"><span>♩</span><div><b>Slow it down</b><small>Pitch stays perfect</small></div></div>
          <div className="floating-note floating-note--bottom"><span>↔</span><div><b>Loop any passage</b><small>Practice without stopping</small></div></div>
        </div>
      </section>

      <section className="library" id="my-pieces">
        <div className="section-heading">
          <div><span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>My pieces</h2></div>
          <button onClick={() => fileInput.current?.click()}>Upload a file <span>＋</span></button>
        </div>
        <div className="piece-grid">
          {pieces.slice(0, 3).map((piece, index) => (
            <button className="piece-card" key={piece.id} onClick={() => openPiece(piece)}>
              <PieceArtwork piece={piece} index={index} />
              <span className="piece-card__body">
                <small>{piece.lastOpened || "Ready to practice"}</small>
                <strong>{piece.title}</strong>
                <span>{piece.composer}</span>
                <i><b>{piece.duration}</b><em>{piece.source}</em></i>
              </span>
              <span className="piece-card__play">▶</span>
            </button>
          ))}
        </div>
      </section>

      <section className="upload-strip">
        <div><Mark variant="large" /></div>
        <div><span>CAN’T FIND YOUR PIECE?</span><h2>Bring your own music.</h2><p>Drop in a MIDI or MusicXML file. It stays on this device.</p></div>
        <button onClick={() => fileInput.current?.click()}>Choose a file <span>↗</span></button>
      </section>

      {uploadMessage && <div className="toast" role="status">{uploadMessage}<button onClick={() => setUploadMessage("")}>×</button></div>}
      <input ref={fileInput} className="visually-hidden" type="file" accept=".mid,.midi,.musicxml,.xml,.mxl" onChange={handleUpload} />
    </main>
  );
}

function Player({ piece, onBack }: { piece: Piece; onBack: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [guide, setGuide] = useState(true);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) { lastTick.current = null; return; }
    let frame = 0;
    const tick = (now: number) => {
      if (lastTick.current === null) lastTick.current = now;
      const elapsed = ((now - lastTick.current) / 1000) * speed;
      lastTick.current = now;
      setPosition((current) => {
        let next = current + elapsed;
        if (loopA !== null && loopB !== null && next >= loopB) next = loopA;
        if (next >= piece.seconds) { setPlaying(false); return piece.seconds; }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, loopA, loopB, piece.seconds]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
      if (event.code === "Space") { event.preventDefault(); setPlaying((value) => !value); }
      if (event.code === "ArrowLeft") setPosition((value) => Math.max(0, value - 5));
      if (event.code === "ArrowRight") setPosition((value) => Math.min(piece.seconds, value + 5));
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [piece.seconds]);

  const cycleDuration = 6.7 * 40;
  const visualPosition = position % cycleDuration;
  const visibleNotes = demoNotes.filter((note) => note.time >= visualPosition - note.duration && note.time <= visualPosition + 4);
  const pressedKeys = new Set<number>(visibleNotes.filter((note) => note.time <= visualPosition && note.time + note.duration >= visualPosition).map((note) => note.midi));
  const preparedKeys = new Set<number>(guide ? visibleNotes.filter((note) => note.time > visualPosition && note.time <= visualPosition + 1).map((note) => note.midi) : []);

  function whitePosition(midi: number) {
    const index = whiteKeys.findIndex((key) => key.midi === midi);
    return { left: `${(index / 52) * 100}%`, width: `${100 / 52}%` };
  }

  function notePosition(midi: number) {
    const key = pianoKeys.find((item) => item.midi === midi)!;
    if (!key.black) return whitePosition(midi);
    const before = whiteKeys.filter((item) => item.midi < midi).length;
    return { left: `${(before / 52) * 100 - 0.66}%`, width: `${(100 / 52) * 0.68}%` };
  }

  function togglePlay() {
    if (position >= piece.seconds) setPosition(loopA ?? 0);
    setPlaying((value) => !value);
  }

  function setMarker(marker: "a" | "b") {
    if (marker === "a") {
      setLoopA(Math.min(position, loopB ?? position));
      if (loopB !== null && position > loopB) setLoopB(position);
    } else {
      if (loopA === null) setLoopA(Math.max(0, position - 5));
      setLoopB(Math.max(position, loopA ?? 0));
    }
  }

  return (
    <main className="player-shell">
      <header className="player-header">
        <div className="player-header__left">
          <button className="back-button" onClick={onBack} aria-label="Back to library">←</button>
          <span className="header-divider" />
          <Mark />
          <div><strong>{piece.title}</strong><small>{piece.composer}</small></div>
        </div>
        <div className="player-header__center"><span className="live-dot" /> PRACTICE MODE</div>
        <div className="player-header__right">
          <button className={guide ? "active" : ""} onClick={() => setGuide((value) => !value)}><span className="guide-icon">✦</span> Guide</button>
          <button onClick={() => setNotice("Listen mode arrives in V1. The prototype already shows the complete practice flow.")}><span className="listen-icon" /> Listen</button>
        </div>
      </header>

      <section className="visualizer">
        <div className="visualizer-grid" />
        <div className="visualizer-labels"><span>RIGHT HAND</span><span>LEFT HAND</span></div>
        <div className="falling-field">
          {visibleNotes.map((note) => {
            const horizontal = notePosition(note.midi);
            const distance = note.time - visualPosition;
            const bottom = 12 + (1 - distance / 4) * 76;
            const height = Math.max(18, note.duration * 56);
            return (
              <i
                className={`falling-note falling-note--${note.hand}`}
                key={note.id}
                style={{ ...horizontal, bottom: `${bottom}%`, height: `${height}px` }}
              ><span>{pianoKeys.find((key) => key.midi === note.midi)?.name}</span></i>
            );
          })}
        </div>
        <div className="hit-line"><span>NOW</span></div>
        <div className="keyboard-wrap">
          <div className="keyboard">
            {whiteKeys.map((key) => (
              <div className={`piano-key piano-key--white ${pressedKeys.has(key.midi) ? "is-pressed" : ""} ${preparedKeys.has(key.midi) ? "is-prepared" : ""}`} key={key.midi}>
                <span>{key.name}</span>
              </div>
            ))}
            {blackKeys.map((key) => {
              const before = whiteKeys.filter((item) => item.midi < key.midi).length;
              return (
                <div className={`piano-key piano-key--black ${pressedKeys.has(key.midi) ? "is-pressed" : ""} ${preparedKeys.has(key.midi) ? "is-prepared" : ""}`} key={key.midi} style={{ left: `${(before / 52) * 100 - 0.58}%` }}>
                  <span>{key.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="transport-panel">
        <div className="timeline-row">
          <time>{formatTime(position)}</time>
          <div className="timeline-wrap">
            <input className="timeline" type="range" min="0" max={piece.seconds} step="0.01" value={position} aria-label="Piece position" onChange={(event) => setPosition(Number(event.target.value))} style={{ "--progress": `${(position / piece.seconds) * 100}%` } as React.CSSProperties} />
            {loopA !== null && <span className="loop-marker loop-marker--a" style={{ left: `${(loopA / piece.seconds) * 100}%` }}>A</span>}
            {loopB !== null && <span className="loop-marker loop-marker--b" style={{ left: `${(loopB / piece.seconds) * 100}%` }}>B</span>}
          </div>
          <time>{piece.duration}</time>
        </div>
        <div className="controls-row">
          <div className="control-group control-group--loop">
            <span className="control-label">SECTION LOOP</span>
            <div><button className={loopA !== null ? "set" : ""} onClick={() => setMarker("a")}>A</button><span>—</span><button className={loopB !== null ? "set" : ""} onClick={() => setMarker("b")}>B</button>{loopA !== null && loopB !== null && <button className="clear-loop" onClick={() => { setLoopA(null); setLoopB(null); }}>Clear</button>}</div>
          </div>
          <div className="main-controls">
            <button onClick={() => setPosition((value) => Math.max(0, value - 5))} aria-label="Back 5 seconds"><b>−5</b><span>↶</span></button>
            <button className="main-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
            <button onClick={() => setPosition((value) => Math.min(piece.seconds, value + 5))} aria-label="Forward 5 seconds"><b>+5</b><span>↷</span></button>
          </div>
          <div className="control-group control-group--speed">
            <span className="control-label">TEMPO</span>
            <div>{[0.25, 0.5, 1].map((value) => <button className={speed === value ? "active" : ""} key={value} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
            <button className={`mute-button ${muted ? "muted" : ""}`} onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? "×" : "◖"}</button>
          </div>
        </div>
        <div className="player-hint"><span>SPACE</span> play / pause <i /> <span>←</span><span>→</span> skip 5 seconds</div>
      </section>

      {notice && <div className="player-notice" role="status"><span>✦</span><div><strong>Coming next</strong><p>{notice}</p></div><button onClick={() => setNotice("")}>×</button></div>}
    </main>
  );
}
