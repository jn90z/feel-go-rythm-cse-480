import { describe, expect, it } from "vitest";
import { buildSourceSiliconTrace, clampTraceIndex, SOURCE_SILICON_MAX_INDEX } from "./sourceSiliconModel";

describe("source to silicon x-ray model", () => {
  it("clamps the educational array index to a small bounded range", () => {
    expect(clampTraceIndex(-5)).toBe(0);
    expect(clampTraceIndex(3.9)).toBe(3);
    expect(clampTraceIndex(999)).toBe(SOURCE_SILICON_MAX_INDEX);
    expect(clampTraceIndex(Number.NaN)).toBe(0);
  });

  it("computes a 4-byte int effective address deterministically", () => {
    const trace = buildSourceSiliconTrace(3, 0x1000);
    expect(trace.index).toBe(3);
    expect(trace.elementSize).toBe(4);
    expect(trace.effectiveAddress).toBe(0x100c);
    expect(trace.registers).toMatchObject({ rdi: "0x1000", rsi: "3" });
  });

  it("connects source intent to the memory handoff in ordered stages", () => {
    const trace = buildSourceSiliconTrace(2);
    expect(trace.stages.map(stage => stage.id)).toEqual([
      "source", "tokens", "ast", "ir", "assembly", "registers", "address", "memory"
    ]);
    expect(trace.stages[0].code).toContain("values[2]");
    expect(trace.stages.at(-1)?.code).toContain("0x1008");
  });
});
