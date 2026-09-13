import { describe, expect, it } from "vitest";
import { buildSortSteps } from "./sortingModel";

describe("sorting finalization states", () => {
  it("grows Bubble Sort's finalized suffix after each pass", () => {
    const steps = buildSortSteps([4, 3, 2, 1], "bubble");
    const finalizedSteps = steps.filter(step => step.message.includes("is final"));
    expect(finalizedSteps[0].finalized).toEqual([3]);
    expect(finalizedSteps[1].finalized).toEqual([2, 3]);
  });

  it("grows Selection Sort's finalized prefix", () => {
    const steps = buildSortSteps([4, 1, 3, 2], "selection");
    const finalizedSteps = steps.filter(step => step.message.includes("is final"));
    expect(finalizedSteps[0].values[0]).toBe(1);
    expect(finalizedSteps[0].finalized).toEqual([0]);
    expect(finalizedSteps[1].finalized).toEqual([0, 1]);
  });

  it("does not falsely mark Insertion Sort's locally sorted prefix as final", () => {
    const steps = buildSortSteps([3, 4, 1, 2], "insertion");
    expect(steps.slice(0, -1).every(step => step.finalized.length === 0)).toBe(true);
    expect(steps.at(-1)?.finalized).toEqual([0, 1, 2, 3]);
  });

  it("locks Quick Sort pivots and singleton partitions as they become final", () => {
    const steps = buildSortSteps([3, 1, 4, 2], "quick");
    const earlyFinalized = steps.slice(0, -1).filter(step => step.finalized.length > 0);
    expect(earlyFinalized.length).toBeGreaterThan(0);
    expect(earlyFinalized.some(step => step.message.includes("Pivot"))).toBe(true);
  });

  it("marks Heap Sort's extracted maximum positions from right to left", () => {
    const steps = buildSortSteps([2, 5, 1, 4, 3], "heap");
    const extracts = steps.filter(step => step.message.includes("heap maximum"));
    expect(extracts[0].finalized).toEqual([4]);
    expect(extracts[1].finalized).toEqual([3, 4]);
  });

  it("marks final Merge Sort writes progressively during the last merge", () => {
    const steps = buildSortSteps([4, 1, 3, 2], "merge");
    const finalMerge = steps.filter(step => step.message.startsWith("Final merge wrote"));
    expect(finalMerge.map(step => step.finalized.length)).toEqual([1, 2, 3, 4]);
  });

  it("finishes every algorithm with sorted values and every position finalized", () => {
    for (const algorithm of ["bubble", "selection", "insertion", "merge", "quick", "heap"] as const) {
      const finalStep = buildSortSteps([5, 2, 4, 1, 3], algorithm).at(-1)!;
      expect(finalStep.values).toEqual([1, 2, 3, 4, 5]);
      expect(finalStep.finalized).toEqual([0, 1, 2, 3, 4]);
    }
  });
});
