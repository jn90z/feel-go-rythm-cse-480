import { describe, expect, it } from "vitest";
import {
  deadlockDemoSchedule,
  normalizeDeadlockSchedule,
  safeOrderingSchedule,
  simulateDeadlock
} from "./deadlockModel";

describe("deadlockModel", () => {
  it("detects the classic circular-wait deadlock", () => {
    const trace = simulateDeadlock("opposite-order", deadlockDemoSchedule());
    expect(trace.deadlocked).toBe(true);
    expect(trace.steps.at(-1)?.waitForEdges).toEqual(expect.arrayContaining([["A", "B"], ["B", "A"]]));
    expect(trace.completedThreads).toBe(0);
  });

  it("avoids circular wait when every thread uses the same lock order", () => {
    const trace = simulateDeadlock("global-order", safeOrderingSchedule());
    expect(trace.deadlocked).toBe(false);
    expect(trace.completedThreads).toBe(2);
    expect(trace.steps.some(step => step.threads.B.waitingFor === "R1")).toBe(true);
  });

  it("keeps ownership and held-lock state consistent through release", () => {
    const trace = simulateDeadlock("global-order", ["A", "A", "A", "A"]);
    const final = trace.steps.at(-1)!;
    expect(final.resources.R1.owner).toBeNull();
    expect(final.resources.R2.owner).toBeNull();
    expect(final.threads.A.held).toEqual([]);
    expect(final.threads.A.done).toBe(true);
  });

  it("normalizes schedule input and caps pathological input", () => {
    expect(normalizeDeadlockSchedule("a-x-B-12")).toEqual(["A", "B"]);
    expect(normalizeDeadlockSchedule("AB".repeat(100))).toHaveLength(80);
  });
});
