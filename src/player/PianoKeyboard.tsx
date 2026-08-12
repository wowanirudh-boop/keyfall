import { useMemo, type CSSProperties } from "react";

import {
  alpha,
  color,
  keyboard,
  keyLabelSize,
  motion,
  shadow,
} from "../design/tokens";
import type { NoteEvent } from "../music/types";
import { displayHand, useHandColors } from "./handColors";
import { KEYBOARD_GEOMETRY, keyLabel, type KeyGeometry } from "./keyboardGeometry";
import {
  FULL_KEYBOARD_WINDOW,
  keyboardWindowStyle,
  type KeyboardWindow,
} from "./keyboardWindow";
import {
  KeyStateScanner,
  type LiveVerdict,
  type VisibleKeyState,
} from "./keyState";

export interface PianoKeyboardProps {
  notes: readonly NoteEvent[];
  position: number;
  hasHandData: boolean;
  listening?: boolean;
  liveVerdicts?: ReadonlyMap<string, LiveVerdict>;
  seekRevision?: number;
  keyboardWindow?: KeyboardWindow;
}

function keyStyle(
  geometry: KeyGeometry,
  state: VisibleKeyState,
  activeColor: string,
) {
  const idleBackground = geometry.black ? color.keyBlackFace : color.keyWhiteFace;
  const idleBorder = geometry.black ? color.keyBlackBorder : color.keyWhiteBorder;
  const style: CSSProperties = {
    left: `${geometry.left}%`,
    width: `${geometry.width}%`,
    height: geometry.black ? `${keyboard.blackHeightRatio * 100}%` : "100%",
    zIndex: geometry.black ? 2 : 1,
    background: idleBackground,
    border: `1px solid ${idleBorder}`,
    boxShadow: "none",
  };

  if (state.kind === "prepare") {
    style.background = geometry.black ? color.keyBlackPrepare : color.keyWhitePrepare;
    style.border = `1px solid ${activeColor}${alpha.prepareBorder}`;
    style.boxShadow = shadow.prepareKey(activeColor);
  } else if (state.kind === "pressed") {
    style.background = activeColor;
    style.border = `1px solid ${activeColor}`;
    style.boxShadow = shadow.pressedKey(activeColor);
  } else if (state.kind === "error") {
    style.background = color.error;
    style.border = `1px solid ${color.errorKeyBorder}`;
    style.boxShadow = shadow.errorKey;
  }

  return style;
}

function labelStyle(
  geometry: KeyGeometry,
  state: VisibleKeyState,
  activeColor: string,
) {
  const enlarged = state.kind === "pressed" || state.kind === "error";
  const colorValue =
    state.kind === "error"
      ? color.errorKeyLabel
      : state.kind === "pressed"
        ? color.onAccent
        : state.kind === "prepare"
          ? activeColor
          : geometry.black
            ? color.keyBlackLabel
            : color.keyWhiteLabel;

  return {
    color: colorValue,
    fontSize: `${
      geometry.black
        ? enlarged
          ? keyLabelSize.blackPressed
          : keyLabelSize.blackIdle
        : enlarged
          ? keyLabelSize.whitePressed
          : keyLabelSize.whiteIdle
    }px`,
    fontWeight: enlarged ? 500 : 400,
    writingMode: geometry.black ? ("vertical-rl" as const) : ("horizontal-tb" as const),
    transition: `font-size ${motion.keyLabelMs}ms linear`,
  };
}

export function PianoKeyboard({
  notes,
  position,
  hasHandData,
  listening = false,
  liveVerdicts,
  seekRevision = 0,
  keyboardWindow = FULL_KEYBOARD_WINDOW,
}: PianoKeyboardProps) {
  const handColors = useHandColors();
  const scanner = useMemo(() => new KeyStateScanner(notes), [notes]);
  const states = scanner.derive(position, {
    listening,
    liveVerdicts,
    seekRevision,
  });
  const renderKey = (geometry: KeyGeometry) => {
    const state = states.get(geometry.midi) ?? { kind: "idle" as const, hand: "unknown" as const };
    const resolvedHand = displayHand(state.hand, hasHandData, handColors.mode);
    const activeColor = handColors.colorFor(state.hand, hasHandData);

    return (
      <div
        key={geometry.midi}
        data-testid={`piano-key-${geometry.midi}`}
        data-midi={geometry.midi}
        data-state={state.kind}
        data-hand={resolvedHand}
        className={`absolute top-0 flex items-end justify-center overflow-hidden ${
          geometry.black
            ? "rounded-b-[3px] pb-[5px]"
            : "rounded-b-key-white pb-[7px]"
        }`}
        style={{
          ...keyStyle(geometry, state, activeColor),
          transition: `background ${motion.keyBackgroundMs}ms linear`,
        }}
      >
        {state.kind === "prepare" ? (
          <span
            aria-hidden="true"
            data-countdown-fill=""
            data-imminence={state.imminence}
            className="absolute inset-x-0 bottom-0"
            style={{
              height: `${state.imminence * 100}%`,
              background: `${activeColor}${alpha.prepareFill}`,
            }}
          />
        ) : null}
        <span
          className="relative z-[3] font-mono tracking-[0.02em]"
          style={labelStyle(geometry, state, activeColor)}
        >
          {keyLabel(geometry.midi)}
        </span>
      </div>
    );
  };

  return (
    <div
      data-testid="piano-keyboard"
      className="relative shrink-0 overflow-hidden border-t border-border-1 bg-stage px-[4px]"
      style={{ height: keyboard.heightCss }}
    >
      <div
        data-testid="keyboard-window"
        data-visible-white-keys={keyboardWindow.visibleWhiteKeys}
        className="absolute inset-y-0"
        style={keyboardWindowStyle(keyboardWindow)}
      >
        {KEYBOARD_GEOMETRY.whites.map(renderKey)}
        {KEYBOARD_GEOMETRY.blacks.map(renderKey)}
      </div>
    </div>
  );
}
