import { describe, expect, it } from "vitest";
import { compareTraversal, matrixAddress, normalizeCacheConfig, simulateCache, traversalCoordinates } from "./cacheLocalityModel";

describe("cache locality model", () => {
  it("maps a row-major matrix to linear addresses", () => {
    expect(matrixAddress(0, 0, 4)).toBe(0);
    expect(matrixAddress(1, 0, 4)).toBe(4);
    expect(matrixAddress(2, 3, 4)).toBe(11);
  });

  it("produces deterministic row and column traversal orders", () => {
    expect(traversalCoordinates(2, 3, "row-major")).toEqual([
      { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 },
      { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 1, column: 2 }
    ]);
    expect(traversalCoordinates(2, 3, "column-major")).toEqual([
      { row: 0, column: 0 }, { row: 1, column: 0 },
      { row: 0, column: 1 }, { row: 1, column: 1 },
      { row: 0, column: 2 }, { row: 1, column: 2 }
    ]);
  });

  it("shows strong spatial locality for row-major traversal", () => {
    const run = simulateCache(4, 4, "row-major", 4, 4);
    expect(run.accesses).toHaveLength(16);
    expect(run.misses).toBe(4);
    expect(run.hits).toBe(12);
    expect(run.hitRate).toBeCloseTo(0.75);
    expect(run.accesses[0].hit).toBe(false);
    expect(run.accesses[1].hit).toBe(true);
  });

  it("exposes conflict misses during column-major traversal", () => {
    const comparison = compareTraversal(4, 4, 4, 2);
    expect(comparison.rowMajor.hitRate).toBeGreaterThan(comparison.columnMajor.hitRate);
    expect(comparison.columnMajor.accesses.some(access => access.evictedBlock !== null)).toBe(true);
  });

  it("keeps immutable cache snapshots for every step", () => {
    const run = simulateCache(4, 4, "row-major", 2, 2);
    expect(run.accesses[0].cache).not.toBe(run.accesses[1].cache);
    expect(run.accesses[0].cache[0].block).toBe(0);
    expect(run.accesses.at(-1)!.cache).toHaveLength(2);
  });

  it("bounds unsafe or extreme configuration inputs", () => {
    expect(normalizeCacheConfig(Number.NaN, 999, 0, 999)).toEqual({ rows: 2, columns: 8, elementsPerLine: 1, cacheLineCount: 8 });
    const run = simulateCache(999, 999, "row-major", 999, 999);
    expect(run.accesses.length).toBeLessThanOrEqual(64);
    expect(run.elementsPerLine).toBe(8);
    expect(run.cacheLineCount).toBe(8);
  });
});
