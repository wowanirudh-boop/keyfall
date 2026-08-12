import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DEFAULT_HAND_COLORS, HAND_COLOR_PRESETS } from "../design/handPalette";
import { HandColorPanel } from "./HandColorControl";
import {
  DEFAULT_HAND_SETTINGS,
  displayHand,
  HandColorProvider,
  readHandSettings,
  useHandColors,
  writeHandSettings,
} from "./handColors";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  } as Storage;
}

function Probe() {
  const { right, left, mode } = useHandColors();
  return <span data-testid="probe">{`${right}|${left}|${mode}`}</span>;
}

describe("displayHand", () => {
  it("[D-026] paints by the staff the note is written on", () => {
    expect(displayHand("left", true, "score")).toBe("left");
    expect(displayHand("right", true, "score")).toBe("right");
    expect(displayHand("unknown", true, "score")).toBe("right");
  });

  it("[D-026] swaps both hands, never just one", () => {
    expect(displayHand("left", true, "swapped")).toBe("right");
    expect(displayHand("right", true, "swapped")).toBe("left");
  });

  it("[D-026] collapses to one colour on request or without hand data", () => {
    expect(displayHand("left", true, "single")).toBe("right");
    expect(displayHand("left", false, "score")).toBe("right");
    expect(displayHand("left", false, "swapped")).toBe("right");
  });
});

describe("hand colour preferences", () => {
  it("[D-026] round-trips through storage", () => {
    const storage = memoryStorage();
    const preset = HAND_COLOR_PRESETS[2];
    writeHandSettings({ right: preset.right, left: preset.left, mode: "single" }, storage);
    expect(readHandSettings(storage)).toEqual({
      right: preset.right,
      left: preset.left,
      mode: "single",
    });
  });

  it("[D-026] rejects stored junk rather than rendering it", () => {
    const storage = memoryStorage();
    storage.setItem("piano-practice-player.handRight", "javascript:alert(1)");
    storage.setItem("piano-practice-player.handLeft", "red");
    storage.setItem("piano-practice-player.handMode", "sideways");
    expect(readHandSettings(storage)).toEqual(DEFAULT_HAND_SETTINGS);
  });

  it("[D-026] defaults to the handoff's pair", () => {
    expect(DEFAULT_HAND_SETTINGS.right).toBe(DEFAULT_HAND_COLORS.right);
    expect(DEFAULT_HAND_SETTINGS.left).toBe(DEFAULT_HAND_COLORS.left);
    expect(DEFAULT_HAND_SETTINGS.mode).toBe("score");
  });
});

describe("HandColorPanel", () => {
  it("[D-026] applies a preset, a mode and a reset, and publishes the CSS variables", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const preset = HAND_COLOR_PRESETS[1];

    render(
      <HandColorProvider storage={storage}>
        <Probe />
        <HandColorPanel onClose={() => undefined} />
      </HandColorProvider>,
    );

    await user.click(screen.getByRole("button", { name: new RegExp(preset.name) }));
    expect(screen.getByTestId("probe").textContent).toBe(
      `${preset.right}|${preset.left}|score`,
    );
    expect(document.documentElement.style.getPropertyValue("--color-hand-right")).toBe(
      preset.right,
    );
    expect(document.documentElement.style.getPropertyValue("--color-hand-left")).toBe(preset.left);

    await user.click(screen.getByRole("button", { name: /One colour/ }));
    expect(screen.getByTestId("probe").textContent).toBe(
      `${preset.right}|${preset.left}|single`,
    );
    expect(readHandSettings(storage).mode).toBe("single");

    await user.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(screen.getByTestId("probe").textContent).toBe(
      `${DEFAULT_HAND_COLORS.right}|${DEFAULT_HAND_COLORS.left}|score`,
    );
  });

  it("[D-026] accepts a custom colour for either hand", async () => {
    const storage = memoryStorage();
    render(
      <HandColorProvider storage={storage}>
        <Probe />
        <HandColorPanel onClose={() => undefined} />
      </HandColorProvider>,
    );

    fireEvent.change(screen.getByLabelText("Left hand colour"), {
      target: { value: '#00ff88' },
    });
    expect(readHandSettings(storage).left).toBe('#00ff88');
    expect(screen.getByTestId("probe").textContent).toContain('#00ff88');

    fireEvent.change(screen.getByLabelText("Right hand colour"), {
      target: { value: '#112233' },
    });
    expect(readHandSettings(storage)).toMatchObject({ right: '#112233', left: '#00ff88' });
  });
});
