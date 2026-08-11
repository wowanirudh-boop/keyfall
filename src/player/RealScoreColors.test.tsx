import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { color } from "../design/tokens";
import {
  evaluateRealScore,
  REAL_SCORE_FILES,
} from "../music/__fixtures__/realScoreGate";
import { WaterfallStage } from "./WaterfallStage";

function normalizedBackground(background: string) {
  const element = document.createElement("div");
  element.style.background = background;
  return element.style.background;
}

describe("real-score waterfall hand colours", () => {
  it("[AC15] renders every converted attack in the colour implied by its source staff", async () => {
    let sourceAttacks = 0;
    let assignmentMismatches = 0;
    let renderedAttacks = 0;

    for (const filename of REAL_SCORE_FILES) {
      const score = await evaluateRealScore(filename);
      sourceAttacks += score.sourceAttackCount;
      assignmentMismatches += score.assignmentMismatches;
      const visited = new Set<string>();
      const view = render(
        <WaterfallStage
          notes={score.piece.notes}
          position={0}
          speed={1}
          hasHandData
        />,
      );

      for (let position = 0; position <= score.piece.duration + 3; position += 3) {
        view.rerender(
          <WaterfallStage
            notes={score.piece.notes}
            position={position}
            speed={1}
            hasHandData
          />,
        );
        for (const element of document.querySelectorAll<HTMLElement>("[data-note-id]")) {
          const noteId = element.dataset.noteId;
          if (!noteId) continue;
          const expectedHand = score.expectedHands.get(noteId);
          const expectedColor = expectedHand === "left" ? color.handLeft : color.handRight;
          expect(element.dataset.hand).toBe(expectedHand);
          expect(element.style.background).toBe(normalizedBackground(expectedColor));
          visited.add(noteId);
        }
      }

      expect(visited.size).toBe(score.piece.notes.length);
      renderedAttacks += visited.size;
      view.unmount();
    }

    expect(sourceAttacks).toBe(1_578);
    expect(assignmentMismatches).toBe(2);
    expect((sourceAttacks - assignmentMismatches) / sourceAttacks).toBeGreaterThanOrEqual(0.99);
    expect(renderedAttacks).toBe(1_576);
  }, 30_000);
});
