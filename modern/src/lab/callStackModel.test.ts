import { describe, expect, it } from "vitest";
import { buildCallStackTrace, normalizeCallStackInput } from "./callStackModel";

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

  it("normalizes non-finite recursion inputs instead of recursing forever", () => {
    expect(normalizeCallStackInput("fibonacci", Number.NaN)).toBe(0);
    expect(normalizeCallStackInput("factorial", Number.POSITIVE_INFINITY)).toBe(0);

    const fib = buildCallStackTrace("fibonacci", Number.NaN);
    const factorial = buildCallStackTrace("factorial", Number.POSITIVE_INFINITY);

    expect(fib).toMatchObject({ input: 0, result: 0, calls: 1, maxDepth: 1 });
    expect(factorial).toMatchObject({ input: 0, result: 1, calls: 1, maxDepth: 1 });
  });

  it("bounds oversized traces to the same safe limits exposed by the UI", () => {
    const fib = buildCallStackTrace("fibonacci", 100_000);
    const factorial = buildCallStackTrace("factorial", 100_000);

    expect(fib.input).toBe(8);
    expect(fib.result).toBe(21);
    expect(fib.calls).toBe(67);
    expect(factorial.input).toBe(10);
    expect(factorial.result).toBe(3_628_800);
    expect(factorial.maxDepth).toBe(10);
  });
});
