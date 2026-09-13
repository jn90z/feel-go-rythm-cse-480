import { describe, expect, it } from "vitest";
import { buildSortComparison } from "./sortingModel";
import { explainWorkWinner, getSortLearningProfile, rankSortWork } from "./sortingLearning";

describe("sorting learning metadata", () => {
  it("describes the implementation-specific Bubble Sort best case honestly", () => {
    const bubble = getSortLearningProfile("bubble");
    expect(bubble.bestTime).toBe("O(n²)");
    expect(bubble.caution).toContain("early-exit");
  });

  it("captures important stability and space tradeoffs", () => {
    expect(getSortLearningProfile("merge")).toMatchObject({ stable: true, inPlace: false, space: "O(n)" });
    expect(getSortLearningProfile("heap")).toMatchObject({ stable: false, inPlace: true, space: "O(1)" });
    expect(getSortLearningProfile("quick").worstTime).toBe("O(n²)");
  });

  it("ranks the exact input using comparisons plus writes", () => {
    const entries = buildSortComparison([6, 1, 5, 2, 4, 3], ["bubble", "selection", "merge", "quick"]);
    const ranking = rankSortWork(entries);
    const bestScore = Math.min(...ranking.map(item => item.workScore));
    expect(ranking.filter(item => item.winner).every(item => item.workScore === bestScore)).toBe(true);
    expect(ranking.every(item => item.workScore === item.entry.comparisons + item.entry.writes)).toBe(true);
  });

  it("explains that the overall winner is a heuristic rather than runtime", () => {
    const ranking = rankSortWork(buildSortComparison([4, 3, 2, 1], ["bubble", "merge"]));
    const explanation = explainWorkWinner(ranking);
    expect(explanation).toContain("Work score = comparisons + writes");
    expect(explanation).toContain("not wall-clock runtime");
  });
});
