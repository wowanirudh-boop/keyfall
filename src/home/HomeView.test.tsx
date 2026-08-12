import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FIXTURE_MANIFEST } from "../catalog/__fixtures__/manifest";
import type { SavedPieceSummary } from "../library";
import { IMPORT_ERROR_MESSAGES } from "../music";
import { SALAMANDER_ATTRIBUTION, SALAMANDER_LICENSE_URL } from "../playback";
import { HomeView, type HomeViewProps } from "./HomeView";

const savedPiece: SavedPieceSummary = {
  id: "saved",
  title: "Saved piece",
  composer: "Composer",
  duration: 65,
  lastOpened: 100,
  lastSpeed: 0.5,
};

function props(overrides: Partial<HomeViewProps> = {}): HomeViewProps {
  return {
    query: "",
    results: [],
    searched: false,
    catalogUnavailable: false,
    library: [],
    now: 100,
    onQueryChange: vi.fn(),
    onClear: vi.fn(),
    onUpload: vi.fn(),
    onOpenResult: vi.fn(),
    onOpenSaved: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe("HomeView", () => {
  it.each([
    ["empty", []],
    ["populated", [savedPiece]],
  ] as const)(
    "[T05b AC1, AC2] exposes a functional My pieces upload with the library %s",
    async (_state, library) => {
      const user = userEvent.setup();
      const onUpload = vi.fn();
      render(<HomeView {...props({ library, onUpload })} />);

      const input = within(screen.getByRole("region", { name: "My pieces" })).getByLabelText(
        "Upload",
        { exact: true },
      );
      const file = new File(["score"], "score.mid");
      await user.upload(input, file);

      expect(onUpload).toHaveBeenCalledWith(file, "library");
    },
  );

  it("[T05b AC3, AC5] reuses one file-input component without changing the primary upload", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(
      <HomeView
        {...props({ query: "missing", searched: true, onUpload })}
      />,
    );

    const primary = screen.getByLabelText("Upload a MIDI or MusicXML file", { exact: true });
    const library = within(screen.getByRole("region", { name: "My pieces" })).getByLabelText(
      "Upload",
      { exact: true },
    );
    expect(primary.getAttribute("accept")).toBe(library.getAttribute("accept"));
    expect(primary.closest("label")?.className).toContain("bg-hand-right");
    expect(library.closest("label")?.className).toContain("border-border-3");

    const primaryFile = new File(["primary"], "primary.mid");
    const libraryFile = new File(["library"], "library.mid");
    await user.upload(primary, primaryFile);
    await user.upload(library, libraryFile);
    expect(onUpload).toHaveBeenNthCalledWith(1, primaryFile, "search");
    expect(onUpload).toHaveBeenNthCalledWith(2, libraryFile, "library");
  });

  it("[AC1] shows Clear only for a query and Escape clears it", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const { rerender } = render(<HomeView {...props({ onClear })} />);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();

    rerender(<HomeView {...props({ query: "fur elise", searched: true, onClear })} />);
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Search catalog" }), "{Escape}");
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("[AC9, AC11] renders the exact empty state and sampler attribution", () => {
    render(<HomeView {...props()} />);

    expect(
      screen.getByText(
        "Nothing saved yet. Every piece you open — searched or uploaded — is kept here for tomorrow.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: SALAMANDER_ATTRIBUTION }).getAttribute("href")).toBe(
      SALAMANDER_LICENSE_URL,
    );
  });

  it("[AC10] [T03b AC9] renders title, composer, arranger, source, licence, creator, and duration", () => {
    render(
      <HomeView
        {...props({ query: "study", searched: true, results: [FIXTURE_MANIFEST[2]] })}
      />,
    );

    expect(screen.getByText("Catalog Study")).toBeTruthy();
    expect(screen.getByText("Example Composer · Example Arranger")).toBeTruthy();
    expect(screen.getByText("EXAMPLE · CC0-1.0 · EXAMPLE TYPESETTER")).toBeTruthy();
    expect(screen.getByText("1:05")).toBeTruthy();
  });

  it.each(Object.entries(IMPORT_ERROR_MESSAGES))(
    "[AC6] renders the %s failure without a spinner or navigation",
    (_kind, message) => {
      render(
        <HomeView
          {...props({
            query: "missing",
            searched: true,
            uploadError: `“score.mid” — ${message}`,
          })}
        />,
      );

      expect(screen.getByRole("alert").textContent).toContain(message);
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByRole("textbox", { name: "Search catalog" })).toBeTruthy();
    },
  );

  it.each(Object.entries(IMPORT_ERROR_MESSAGES))(
    "[T05b AC4] renders the %s failure inside My pieces when initiated there",
    (_kind, message) => {
      render(
        <HomeView
          {...props({
            uploadError: `“score.mid” — ${message}`,
            uploadErrorOrigin: "library",
          })}
        />,
      );

      const library = screen.getByRole("region", { name: "My pieces" });
      expect(within(library).getByRole("alert").textContent).toContain(message);
      expect(screen.getByRole("textbox", { name: "Search catalog" })).toBeTruthy();
    },
  );

  it("[AC7] [T05b AC6] keeps the single D-017 upload and My Pieces interactive when the catalog is unavailable", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const onOpenSaved = vi.fn();
    render(
      <HomeView
        {...props({
          catalogUnavailable: true,
          library: [savedPiece],
          onUpload,
          onOpenSaved,
        })}
      />,
    );

    expect(
      screen.getByText(
        "Catalog search is unavailable right now. Uploading a file and opening pieces from My pieces both still work offline.",
      ),
    ).toBeTruthy();
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(inputs).toHaveLength(1);
    const input = inputs[0];
    expect(input).not.toBeNull();
    await user.upload(input!, new File(["score"], "score.mid"));
    await user.click(screen.getByText("Saved piece").closest("button")!);
    expect(onUpload).toHaveBeenCalledOnce();
    expect(onUpload).toHaveBeenCalledWith(expect.any(File), "search");
    expect(onOpenSaved).toHaveBeenCalledWith(savedPiece);
  });

  it("[AC8] renders the D-006 asset-failure card with the piece name and upload path", () => {
    render(
      <HomeView
        {...props({
          query: "fur elise",
          searched: true,
          results: [],
          assetError:
            "The score file for “Für Elise” could not be opened. Upload a MIDI or MusicXML copy below instead.",
        })}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("Für Elise");
    expect(screen.getByText("Upload a MIDI or MusicXML file")).toBeTruthy();
  });

  it("[AC5] deletes a saved row through its dedicated control", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<HomeView {...props({ library: [savedPiece], onDelete })} />);

    await user.click(screen.getByRole("button", { name: "Delete Saved piece" }));
    expect(onDelete).toHaveBeenCalledWith(savedPiece);
  });
});
