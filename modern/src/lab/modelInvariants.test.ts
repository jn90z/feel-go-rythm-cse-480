import { describe, expect, it } from "vitest";
import { buildSortSteps, type SortAlgorithm } from "./sortingModel";
import { simulatePageReplacement, type PagePolicy } from "./pageReplacementModel";
import { simulateScheduling, type SchedulingPolicy } from "./cpuSchedulingModel";
import { simulateReliableTransport, type ReliabilityMode } from "./reliableTransportModel";
import { createWeightedGrid, runWeightedSearch, type Terrain } from "./weightedPathfindingModel";

const SORTS: SortAlgorithm[] = ["bubble", "selection", "insertion", "merge", "quick", "heap"];
const PAGE_POLICIES: PagePolicy[] = ["fifo", "lru", "optimal"];
const SCHEDULERS: SchedulingPolicy[] = ["fcfs", "sjf", "srtf", "rr"];
const TRANSPORT_MODES: ReliabilityMode[] = ["stop-and-wait", "go-back-n"];

function arraysOver(alphabet: number[], length: number): number[][] {
  if (length === 0) return [[]];
  const shorter = arraysOver(alphabet, length - 1);
  return shorter.flatMap(prefix => alphabet.map(value => [...prefix, value]));
}

function numericSort(values: number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

describe("core model invariants", () => {
  it("all sorting algorithms exactly sort exhaustive small duplicate-heavy inputs", () => {
    for (let length = 0; length <= 5; length += 1) {
      for (const input of arraysOver([0, 1, 2], length)) {
        const expected = numericSort(input);
        for (const algorithm of SORTS) {
          const steps = buildSortSteps(input, algorithm);
          const final = steps.at(-1)!;
          expect(final.values, `${algorithm} failed for ${JSON.stringify(input)}`).toEqual(expected);
          expect(final.finalized).toEqual(input.map((_, index) => index));
          expect(final.comparisons).toBeGreaterThanOrEqual(0);
          expect(final.writes).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("page replacement keeps frame bounds and accounts for every reference", () => {
    const traces = [
      [],
      [1],
      [1, 1, 1],
      [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
      [0, 9, 0, 9, 8, 7, 8, 7, 6]
    ];

    for (const references of traces) {
      for (const policy of PAGE_POLICIES) {
        for (const requestedFrames of [-10, 1, 2, 3, 8, 99, Number.NaN]) {
          const result = simulatePageReplacement(references, policy, requestedFrames);
          expect(result.frameCount).toBeGreaterThanOrEqual(1);
          expect(result.frameCount).toBeLessThanOrEqual(8);
          expect(result.steps).toHaveLength(references.length);
          expect(result.hits + result.faults).toBe(references.length);
          expect(result.hitRate).toBeGreaterThanOrEqual(0);
          expect(result.hitRate).toBeLessThanOrEqual(1);
          result.steps.forEach(step => expect(step.frames).toHaveLength(result.frameCount));
        }
      }
    }
  });

  it("CPU schedulers finish every normalized burst without negative metrics", () => {
    const workloads = [
      [{ id: "A", arrival: 0, burst: 1 }],
      [{ id: "A", arrival: 5, burst: 2 }, { id: "B", arrival: 5, burst: 3 }],
      [{ id: "A", arrival: 0, burst: 8 }, { id: "B", arrival: 1, burst: 1 }, { id: "C", arrival: 2, burst: 2 }],
      [{ id: "<script>", arrival: -20, burst: 0 }, { id: "<script>", arrival: 900, burst: 999 }]
    ];

    for (const workload of workloads) {
      for (const policy of SCHEDULERS) {
        const result = simulateScheduling(workload, policy, policy === "rr" ? 2 : 4);
        const busySlots = result.timeline.filter(slot => slot.jobId !== null).length;
        expect(busySlots).toBe(result.jobs.reduce((sum, job) => sum + job.burst, 0));
        expect(result.utilization).toBeGreaterThanOrEqual(0);
        expect(result.utilization).toBeLessThanOrEqual(1);
        for (const job of result.jobs) {
          expect(job.firstStart).toBeGreaterThanOrEqual(job.arrival);
          expect(job.completion).toBeGreaterThanOrEqual(job.firstStart + 1);
          expect(job.response).toBeGreaterThanOrEqual(0);
          expect(job.turnaround).toBeGreaterThanOrEqual(job.burst);
          expect(job.waiting).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("reliable transport delivers every normalized packet exactly once across loss positions", () => {
    for (let packetCount = 1; packetCount <= 12; packetCount += 1) {
      const losses: Array<number | null> = [null, ...Array.from({ length: packetCount }, (_, index) => index)];
      for (const loss of losses) {
        for (const mode of TRANSPORT_MODES) {
          const result = simulateReliableTransport(mode, packetCount, 4, loss);
          expect(result.delivered).toEqual(Array.from({ length: packetCount }, (_, index) => index));
          expect(new Set(result.delivered).size).toBe(packetCount);
          expect(result.transmissions).toBeGreaterThanOrEqual(packetCount);
          expect(result.retransmissions).toBe(result.transmissions - packetCount);
          expect(result.snapshots.at(-1)?.event).toBe("complete");
        }
      }
    }
  });

  it("A* and Dijkstra agree on optimal weighted path cost across representative terrain", () => {
    const patterns: Terrain[][] = [
      ["road", "road", "road", "road", "road", "road", "road", "road", "road"],
      ["road", "grass", "road", "mud", "grass", "road", "road", "road", "road"],
      ["road", "wall", "road", "road", "wall", "road", "mud", "grass", "road"],
      ["road", "wall", "road", "wall", "wall", "road", "road", "grass", "road"]
    ];

    for (const terrain of patterns) {
      const grid = createWeightedGrid(3, 3);
      grid.terrain = [...terrain];
      const dijkstra = runWeightedSearch(grid, "dijkstra");
      const astar = runWeightedSearch(grid, "astar");
      expect(astar.totalCost).toBe(dijkstra.totalCost);
      expect(Number.isFinite(astar.totalCost)).toBe(Number.isFinite(dijkstra.totalCost));
      if (Number.isFinite(dijkstra.totalCost)) {
        expect(astar.path[0]).toBe(grid.start);
        expect(astar.path.at(-1)).toBe(grid.goal);
        expect(dijkstra.path[0]).toBe(grid.start);
        expect(dijkstra.path.at(-1)).toBe(grid.goal);
      }
    }
  });
});
