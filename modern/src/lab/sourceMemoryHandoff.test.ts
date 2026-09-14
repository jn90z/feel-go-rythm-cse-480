import { describe, expect, it } from "vitest";
import { simulateMemoryJourney } from "./memoryJourneyModel";
import { buildSourceSiliconTrace } from "./sourceSiliconModel";

describe("source-to-silicon → memory journey handoff", () => {
  it.each([0, 3, 7, 15])("preserves the exact selected load at index %i", index => {
    const sourceTrace = buildSourceSiliconTrace(index);
    const memoryTrace = simulateMemoryJourney("sequential", sourceTrace.baseAddress);
    const continuedLoad = memoryTrace.steps[index];

    expect(continuedLoad.sourceIndex).toBe(sourceTrace.index);
    expect(continuedLoad.translation.virtualAddress).toBe(sourceTrace.effectiveAddress);
    expect(sourceTrace.effectiveAddress).toBe(sourceTrace.baseAddress + index * sourceTrace.elementSize);
  });
});
