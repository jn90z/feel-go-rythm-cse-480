import { describe, expect, it } from "vitest";
import { buildWholeComputerTrace } from "./wholeComputerTraceModel";

describe("whole computer trace", () => {
  it.each([0, 3, 4, 7, 15])("keeps one operation coherent at index %i", index => {
    const trace = buildWholeComputerTrace(index);

    expect(trace.index).toBe(index);
    expect(trace.effectiveAddress).toBe(trace.baseAddress + index * 4);
    expect(trace.memoryStep.sourceIndex).toBe(index);
    expect(trace.memoryStep.translation.virtualAddress).toBe(trace.effectiveAddress);
    expect(trace.memoryStep.translation.physicalAddress).toBe(trace.physicalAddress);
    expect(trace.stages).toHaveLength(14);
    expect(trace.stages[0].id).toBe("source");
    expect(trace.stages.at(-1)?.id).toBe("value");
  });

  it("shows the accumulated fast path after the first sequential load", () => {
    const first = buildWholeComputerTrace(0);
    const second = buildWholeComputerTrace(1);

    expect(first.tlbHit).toBe(false);
    expect(first.cacheHit).toBe(false);
    expect(second.tlbHit).toBe(true);
    expect(second.cacheHit).toBe(true);
  });

  it("shows a new-page translation miss when the loop crosses the page boundary", () => {
    const trace = buildWholeComputerTrace(4);

    expect(trace.memoryStep.translation.virtualPage).toBe(1);
    expect(trace.tlbHit).toBe(false);
    expect(trace.pageTableAccessed).toBe(true);
    expect(trace.pageFault).toBe(false);
  });

  it("clamps invalid and extreme indices through the shared source model", () => {
    expect(buildWholeComputerTrace(Number.NaN).index).toBe(0);
    expect(buildWholeComputerTrace(-999).index).toBe(0);
    expect(buildWholeComputerTrace(999).index).toBe(15);
  });
});
