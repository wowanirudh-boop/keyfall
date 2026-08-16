import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LoadedPlaylist } from "../catalog";
import { FIXTURE_MANIFEST } from "../catalog/__fixtures__/manifest";
import { FIXTURE_PLAYLIST } from "./__fixtures__/playlist";
import { formatPlaylistDuration, joinNames } from "./format";
import { PlaylistView } from "./PlaylistView";

function playlist(overrides: Partial<LoadedPlaylist> = {}): LoadedPlaylist {
  return {
    ...FIXTURE_PLAYLIST,
    ...overrides,
  };
}

describe("PlaylistView", () => {
  it("[T12a AC4, AC6, AC8] renders ordered, read-only rows and the derived C2 line", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <PlaylistView
        playlist={playlist()}
        onBack={vi.fn()}
        onOpen={onOpen}
      />,
    );

    const current = playlist();
    expect(screen.getByRole("heading", { name: current.name })).toBeTruthy();
    expect(
      screen.getByText(
        `${current.entries.length} OF ${current.counts.resolved + current.counts.missing} · ${formatPlaylistDuration(current.durationSeconds)}`,
      ),
    ).toBeTruthy();
    const rows = within(screen.getByRole("region", { name: `${current.name} pieces` })).getAllByRole(
      "button",
    );
    expect(rows[0].textContent).toContain(FIXTURE_MANIFEST[0].title);
    expect(rows[1].textContent).toContain(FIXTURE_MANIFEST[1].title);
    expect(
      screen.getByText(
        `${current.counts.missing} more works from this playlist are not in the catalog yet.`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(`${joinNames(current.missingComposers)} are the big gaps.`),
    ).toBeTruthy();
    for (const affordance of ["rename", "reorder", "remove", "delete", "add", "duplicate"]) {
      expect(screen.queryByRole("button", { name: new RegExp(affordance, "i") })).toBeNull();
    }

    await user.click(rows[1]);
    expect(onOpen).toHaveBeenCalledWith(FIXTURE_MANIFEST[1]);
  });

  it("[T12a AC8] handles singular missing copy and omits a zero-missing block", () => {
    const [singleComposer] = FIXTURE_PLAYLIST.missingComposers;
    const { rerender } = render(
      <PlaylistView
        playlist={playlist({ counts: { resolved: 2, missing: 1, excluded: 0 }, missingComposers: [singleComposer] })}
        onBack={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("1 more work from this playlist is not in the catalog yet.")).toBeTruthy();
    expect(screen.getByText(`${singleComposer} is the big gap.`)).toBeTruthy();

    rerender(
      <PlaylistView
        playlist={playlist({ counts: { resolved: 2, missing: 0, excluded: 0 }, missingComposers: [] })}
        onBack={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.queryByRole("region", { name: "Catalog gaps" })).toBeNull();
  });
});
