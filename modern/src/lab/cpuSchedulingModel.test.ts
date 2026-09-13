import { describe, expect, it } from "vitest";
import { compareSchedulingPolicies, parseJobRows, simulateScheduling } from "./cpuSchedulingModel";

const jobs = [
  { id: "A", arrival: 0, burst: 5 },
  { id: "B", arrival: 1, burst: 2 },
  { id: "C", arrival: 2, burst: 1 }
];

describe("CPU scheduling model", () => {
  it("computes FCFS timing metrics", () => {
    const result = simulateScheduling(jobs, "fcfs");
    expect(result.timeline.map(slot => slot.jobId).join("")).toBe("AAAAABBC");
    expect(result.jobs.map(job => job.waiting)).toEqual([0, 4, 5]);
    expect(result.jobs.map(job => job.response)).toEqual([0, 4, 5]);
    expect(result.contextSwitches).toBe(2);
  });

  it("lets SRTF preempt when a shorter process arrives", () => {
    const result = simulateScheduling(jobs, "srtf");
    expect(result.timeline.map(slot => slot.jobId).join("")).toBe("ABBC" + "AAAA");
    expect(result.jobs.find(job => job.id === "B")?.completion).toBe(3);
    expect(result.averageWaiting).toBeCloseTo(4 / 3, 5);
  });

  it("shows SJF reducing average waiting time for simultaneous jobs", () => {
    const workload = [
      { id: "A", arrival: 0, burst: 8 },
      { id: "B", arrival: 0, burst: 4 },
      { id: "C", arrival: 0, burst: 2 }
    ];
    const fcfs = simulateScheduling(workload, "fcfs");
    const sjf = simulateScheduling(workload, "sjf");
    expect(sjf.averageWaiting).toBeLessThan(fcfs.averageWaiting);
    expect(sjf.timeline.slice(0, 2).every(slot => slot.jobId === "C")).toBe(true);
  });

  it("honors Round Robin quantum and improves early response opportunities", () => {
    const workload = [
      { id: "A", arrival: 0, burst: 5 },
      { id: "B", arrival: 0, burst: 5 }
    ];
    const rr = simulateScheduling(workload, "rr", 2);
    expect(rr.timeline.slice(0, 6).map(slot => slot.jobId).join("")).toBe("AABBAA");
    expect(rr.jobs.find(job => job.id === "B")?.response).toBe(2);
    expect(rr.contextSwitches).toBeGreaterThan(1);
  });

  it("represents idle CPU time when nothing is ready", () => {
    const result = simulateScheduling([{ id: "A", arrival: 3, burst: 2 }], "fcfs");
    expect(result.timeline.slice(0, 3).every(slot => slot.jobId === null)).toBe(true);
    expect(result.utilization).toBeCloseTo(0.4, 5);
  });

  it("parses and normalizes editable workloads", () => {
    const parsed = parseJobRows("A, 0, 5\nA, 1, 0\nC, 2, 3");
    expect(parsed).toEqual([
      { id: "A", arrival: 0, burst: 5 },
      { id: "A2", arrival: 1, burst: 1 },
      { id: "C", arrival: 2, burst: 3 }
    ]);
  });

  it("sanitizes process labels and clamps hostile or excessive scheduling inputs", () => {
    const parsed = parseJobRows("<img_onerror=boom>, -3, 999\nnormal!, 9999, 2");
    expect(parsed).toEqual([
      { id: "img_onerrorboom", arrival: 0, burst: 100 },
      { id: "normal", arrival: 500, burst: 2 }
    ]);

    const rr = simulateScheduling([{ id: "A", arrival: 0, burst: 1 }], "rr", 999);
    expect(rr.quantum).toBe(20);
  });

  it("compares all supported policies over the same workload", () => {
    const comparison = compareSchedulingPolicies(jobs, 2);
    expect(comparison.map(result => result.policy)).toEqual(["fcfs", "sjf", "srtf", "rr"]);
    expect(comparison.every(result => result.jobs.length === jobs.length)).toBe(true);
  });
});
