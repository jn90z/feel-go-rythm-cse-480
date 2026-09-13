import { describe, expect, it } from "vitest";
import { comparePagePolicies, detectBeladyAnomaly, parseReferences, simulatePageReplacement } from "./pageReplacementModel";

describe("page replacement model", () => {
  const classic = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2];

  it("computes FIFO faults and immutable frame snapshots", () => {
    const result = simulatePageReplacement(classic, "fifo", 3);
    expect(result.faults).toBe(10);
    expect(result.hits).toBe(3);
    expect(result.steps[0].frames).toEqual([7, null, null]);
    expect(result.steps.at(-1)?.frames).toEqual([0, 2, 3]);
  });

  it("keeps Optimal at least as good as FIFO and LRU", () => {
    const [fifo, lru, optimal] = comparePagePolicies(classic, 3);
    expect(optimal.faults).toBeLessThanOrEqual(fifo.faults);
    expect(optimal.faults).toBeLessThanOrEqual(lru.faults);
  });

  it("detects Belady's anomaly for the canonical FIFO sequence", () => {
    const refs = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    const result = detectBeladyAnomaly(refs, 3, 4);
    expect(result.lower.faults).toBe(9);
    expect(result.upper.faults).toBe(10);
    expect(result.anomaly).toBe(true);
  });

  it("does not label equal or reversed frame counts as an anomaly", () => {
    const refs = [1, 2, 3, 1, 2, 3];
    expect(detectBeladyAnomaly(refs, 3, 3).anomaly).toBe(false);
    expect(detectBeladyAnomaly(refs, 4, 3).anomaly).toBe(false);
  });

  it("parses safe bounded references and clamps frame counts", () => {
    expect(parseReferences("7, 0 1 nope -2 3")).toEqual([7, 0, 1, 3]);
    expect(simulatePageReplacement([1, 2], "fifo", 99).frameCount).toBe(8);
    expect(simulatePageReplacement([1, 2], "fifo", 0).frameCount).toBe(1);
  });

  it("records educational eviction explanations", () => {
    const result = simulatePageReplacement([1, 2, 3, 4], "lru", 3);
    const eviction = result.steps[3];
    expect(eviction.evicted).toBe(1);
    expect(eviction.explanation).toContain("least recently");
  });
});
