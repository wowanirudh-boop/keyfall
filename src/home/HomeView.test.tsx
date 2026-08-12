import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FIXTURE_MANIFEST } from "../catalog/__fixtures__/manifest";
import type { SavedPieceSummary } from "../library";
import { IMPORT_ERROR_MESSAGES } from "../music";
import { SALAMANDER_ATTRIBUTION, SALAMANDER_LICENSE_URL } from "../playback";
import { CATALOG_PAGE_SIZE, HomeView, type HomeViewProps } from "./HomeView";

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
    catalogEntries: [],
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

  it("[AC9] renders the exact empty state", () => {
    render(<HomeView {...props()} />);

    expect(
      screen.getByText(
        "Nothing saved yet. Every piece you open — searched or uploaded — is kept here for tomorrow.",
      ),
    ).toBeTruthy();
  });

  it("[T05c AC1, AC2, AC4] moves both credits and the local-data reassurance into About", async () => {
    const user = userEvent.setup();
    render(<HomeView {...props()} />);

    expect(screen.getByText("Piano Practice Player")).toBeTruthy();
    expect(screen.queryByText("LOCAL LIBRARY · NO ACCOUNT")).toBeNull();
    expect(screen.queryByRole("link", { name: SALAMANDER_ATTRIBUTION })).toBeNull();

    await user.click(screen.getByRole("button", { name: "About" }));

    expect(screen.getByRole("dialog", { name: "About" })).toBeTruthy();
    expect(screen.getByText(/turns piano scores into falling notes/)).toBeTruthy();
    expect(
      screen.getByText(
        "Everything stays on this device. There is no account, and nothing is uploaded.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: SALAMANDER_ATTRIBUTION }).getAttribute("href")).toBe(
      SALAMANDER_LICENSE_URL,
    );
    expect(screen.getByRole("link", { name: "Mutopia Project" }).getAttribute("href")).toBe(
      "https://www.mutopiaproject.org/legal.html",
    );
  });

  it("[T05c AC3] closes About by Escape and backdrop, returning focus each time", async () => {
    const user = userEvent.setup();
    render(<HomeView {...props()} />);
    const about = screen.getByRole("button", { name: "About" });

    await user.click(about);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close About" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "About" })).toBeNull();
    expect(document.activeElement).toBe(about);

    await user.click(about);
    await user.click(screen.getByTestId("modal-backdrop"));
    expect(screen.queryByRole("dialog", { name: "About" })).toBeNull();
    expect(document.activeElement).toBe(about);
  });

  it("[T05c AC7] keeps the catalogue and sampler licence text in the repository", () => {
    const catalogLicences = readFileSync(resolve("catalog/LICENCES.md"), "utf8");
    const samplerAttribution = readFileSync(
      resolve("public/audio/salamander/ATTRIBUTION.md"),
      "utf8",
    );

    expect(catalogLicences).toContain("# Catalog licence audit");
    expect(catalogLicences).toContain("Mutopia");
    expect(samplerAttribution).toContain("Salamander Grand Piano V3 by Alexander Holm");
    expect(samplerAttribution).toContain("CC BY 3.0");
  });

  it("[AC10] [T03b AC9] renders title, composer, arranger, source, licence, creator, and duration", () => {
    render(
      <HomeView
        {...props({ query: "study", searched: true, results: [FIXTURE_MANIFEST[2]] })}
      />,
    );

    expect(screen.getByText("Catalog Study")).toBeTruthy();
    expect(screen.getByText("Composer, Example · Example Arranger")).toBeTruthy();
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

  it("[T03d AC7, AC8] browses a composer-sorted page without rendering the whole catalog", async () => {
    const user = userEvent.setup();
    const entries = Array.from({ length: CATALOG_PAGE_SIZE + 2 }, (_, index) => ({
      ...structuredClone(FIXTURE_MANIFEST[index % FIXTURE_MANIFEST.length]),
      id: `browse-${index}`,
      title: `Piece ${String(index).padStart(2, "0")}`,
      composer: index === CATALOG_PAGE_SIZE + 1 ? "Aardvark, Ada" : "Zulu, Zoe",
    }));
    render(<HomeView {...props({ catalogEntries: entries })} />);

    const browse = screen.getByRole("region", { name: "Browse catalog" });
    expect(within(browse).getByText(`${entries.length} PIECES · BROWSE A–Z BY COMPOSER`)).toBeTruthy();
    expect(within(browse).getByText(/Aardvark, Ada/)).toBeTruthy();
    expect(within(browse).getAllByRole("button")).toHaveLength(CATALOG_PAGE_SIZE + 2);
    expect(within(browse).queryByText("Piece 25")).toBeNull();

    await user.click(within(browse).getByRole("button", { name: "Next" }));
    expect(within(browse).getByText("PAGE 2 OF 2")).toBeTruthy();
    expect(within(browse).getAllByRole("button")).toHaveLength(4);
  });
});
