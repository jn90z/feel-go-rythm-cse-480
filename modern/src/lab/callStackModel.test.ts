import { describe, expect, it } from "vitest";
import { buildCallStackTrace } from "./callStackModel";

describe("buildCallStackTrace", () => {
  it("builds a factorial trace with stack depth and return values", () => {
    const trace = buildCallStackTrace("factorial", 5);

    expect(trace.result).toBe(120);
    expect(trace.calls).toBe(5);
    expect(trace.maxDepth).toBe(5);
    expect(trace.events[0]).toMatchObject({ kind: "enter", argument: 5, depth: 1 });
    expect(trace.events.some(event => event.kind === "base" && event.value === 1)).toBe(true);
    expect(trace.events.at(-1)).toMatchObject({ kind: "return", argument: 5, value: 120 });
  });

  it("builds the full naive fibonacci call tree", () => {
    const trace = buildCallStackTrace("fibonacci", 5);

    expect(trace.result).toBe(5);
    expect(trace.calls).toBe(15);
    expect(trace.maxDepth).toBe(5);
    expect(trace.events.filter(event => event.kind === "base")).toHaveLength(8);
  });

  it("clamps negative input to zero", () => {
    const trace = buildCallStackTrace("factorial", -7);

    expect(trace.input).toBe(0);
    expect(trace.result).toBe(1);
    expect(trace.calls).toBe(1);
  });
});
