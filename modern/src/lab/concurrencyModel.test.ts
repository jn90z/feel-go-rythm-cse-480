import { describe, expect, it } from "vitest";
import {
  classicLostUpdateSchedule,
  normalizeSchedule,
  runConcurrencySchedule,
  serialSchedule
} from "./concurrencyModel";

describe("concurrency model", () => {
  it("reproduces the classic lost update without synchronization", () => {
    const trace = runConcurrencySchedule(classicLostUpdateSchedule(), "unsafe");
    expect(trace.completedThreads).toBe(2);
    expect(trace.finalCounter).toBe(1);
    expect(trace.lostUpdate).toBe(true);
  });

  it("preserves both increments with a mutex even under the same interleaving attempts", () => {
    const schedule = [...classicLostUpdateSchedule(), "A", "A", "B", "B", "B"] as const;
    const trace = runConcurrencySchedule([...schedule], "mutex");
    expect(trace.finalCounter).toBe(2);
    expect(trace.completedThreads).toBe(2);
    expect(trace.lostUpdate).toBe(false);
    expect(trace.steps.some(step => step.blocked && step.action === "blocked on mutex")).toBe(true);
  });

  it("serial execution reaches two without a mutex", () => {
    const trace = runConcurrencySchedule(serialSchedule(), "unsafe");
    expect(trace.finalCounter).toBe(2);
    expect(trace.lostUpdate).toBe(false);
  });

  it("normalizes free-form schedules and bounds their length", () => {
    expect(normalizeSchedule("a-b-A x B")).toEqual(["A", "B", "A", "B"]);
    expect(normalizeSchedule("AB".repeat(40))).toHaveLength(60);
  });

  it("records why unsafe reads are dangerous", () => {
    const trace = runConcurrencySchedule(["A", "B"], "unsafe");
    expect(trace.steps[0].message).toContain("same old value");
    expect(trace.steps[1].threads.A.local).toBe(0);
    expect(trace.steps[1].threads.B.local).toBe(0);
  });
});
