import { useEffect, useRef, useState } from "react";

import { HAND_COLOR_PRESETS } from "../design/handPalette";
import { GHOST_BUTTON_CLASS_NAME, Modal } from "../design/primitives";
import { useHandColors, type HandDisplayMode } from "./handColors";

const MODE_OPTIONS: ReadonlyArray<{ mode: HandDisplayMode; label: string; hint: string }> = [
  { mode: "score", label: "Follow the score", hint: "Each note takes the colour of the staff it is written on." },
  { mode: "swapped", label: "Swap hands", hint: "For files whose two staves are the wrong way round." },
  { mode: "single", label: "One colour", hint: "Ignore hands entirely — every note in the right-hand colour." },
];

function Swatch({ value }: { value: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-[14px] w-[14px] shrink-0 rounded-chip"
      style={{ background: value }}
    />
  );
}

export function HandColorPanel({ onClose }: { onClose: () => void }) {
  const { right, left, mode, setColors, setMode, reset } = useHandColors();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <Modal title="Note colours" onClose={onClose}>
      <div className="flex flex-col gap-[10px]">
        <span className="font-mono text-mono-label uppercase tracking-[0.1em] text-mono-dim-2">
          Palette
        </span>
        <div className="flex flex-wrap gap-[8px]">
          {HAND_COLOR_PRESETS.map((preset) => {
            const selected = preset.right === right && preset.left === left;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                className={`flex cursor-pointer items-center gap-[8px] rounded-button border px-[11px] py-[7px] text-small ${
                  selected
                    ? "border-hand-right text-text"
                    : "border-border-3 bg-transparent text-secondary hover:border-border-5 hover:text-text"
                }`}
                onClick={() => setColors(preset)}
              >
                <Swatch value={preset.right} />
                <Swatch value={preset.left} />
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-[18px]">
        <label className="flex cursor-pointer items-center gap-[10px] text-body-sm text-secondary">
          <input
            type="color"
            aria-label="Right hand colour"
            className="h-[30px] w-[42px] cursor-pointer rounded-button border border-border-3 bg-transparent p-[2px]"
            value={right}
            onChange={(event) => setColors({ right: event.currentTarget.value, left })}
          />
          Right hand
        </label>
        <label className="flex cursor-pointer items-center gap-[10px] text-body-sm text-secondary">
          <input
            type="color"
            aria-label="Left hand colour"
            className="h-[30px] w-[42px] cursor-pointer rounded-button border border-border-3 bg-transparent p-[2px]"
            value={left}
            onChange={(event) => setColors({ right, left: event.currentTarget.value })}
          />
          Left hand
        </label>
      </div>

      <div className="flex flex-col gap-[10px]">
        <span className="font-mono text-mono-label uppercase tracking-[0.1em] text-mono-dim-2">
          Hands
        </span>
        <div className="flex flex-col gap-[6px]">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              aria-pressed={mode === option.mode}
              className={`flex cursor-pointer flex-col gap-[3px] rounded-button border px-[12px] py-[9px] text-left ${
                mode === option.mode
                  ? "border-hand-right text-text"
                  : "border-border-3 bg-transparent text-secondary hover:border-border-5"
              }`}
              onClick={() => setMode(option.mode)}
            >
              <span className="text-body-sm">{option.label}</span>
              <span className="text-small leading-[1.45] text-mono-dim-1">{option.hint}</span>
            </button>
          ))}
        </div>
        <p className="text-small leading-[1.5] text-mono-dim-1">
          Colours come from the score, not from a guess: a note is left-hand because it is
          written on the lower staff. Some pieces really do trade a figure between hands — Für
          Elise’s closing tremolo is one — so the colours alternate there because the music
          does.
        </p>
      </div>

      <div className="flex justify-between gap-[10px]">
        <button type="button" className={GHOST_BUTTON_CLASS_NAME} onClick={reset}>
          Reset to default
        </button>
        <button ref={closeButtonRef} type="button" className={GHOST_BUTTON_CLASS_NAME} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

export function HandColorButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { right, left } = useHandColors();
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Note colours"
        className={`flex shrink-0 cursor-pointer items-center gap-[7px] rounded-button border border-border-3 bg-transparent px-[10px] py-[7px] text-small text-secondary hover:border-border-5 hover:text-text ${className}`.trim()}
        onClick={() => setOpen(true)}
      >
        <Swatch value={right} />
        <Swatch value={left} />
      </button>
      {open ? (
        <HandColorPanel
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
