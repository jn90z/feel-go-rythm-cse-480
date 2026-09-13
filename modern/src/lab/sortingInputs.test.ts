import { describe, expect, it } from "vitest";
import { describeSortInput, generateSortInput } from "./sortingInputs";

const deterministic = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe("sorting input shapes", () => {
  it("builds sorted and reverse inputs exactly", () => {
    expect(generateSortInput(6, "sorted")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(generateSortInput(6, "reverse")).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("keeps random inputs as permutations of 1..n", () => {
    const values = generateSortInput(8, "random", deterministic([0.1, 0.7, 0.2, 0.9]));
    expect([...values].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("creates nearly sorted inputs with a small number of local disruptions", () => {
    const values = generateSortInput(16, "nearly-sorted", deterministic([0.25, 0.1, 0.75, 0.4]));
    const sorted = Array.from({ length: 16 }, (_, index) => index + 1);
    const changed = values.filter((value, index) => value !== sorted[index]).length;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThanOrEqual(4);
    expect([...values].sort((a, b) => a - b)).toEqual(sorted);
  });

  it("creates duplicate-heavy inputs with fewer distinct keys than items", () => {
    const values = generateSortInput(24, "duplicates", deterministic([0.0, 0.2, 0.4, 0.6, 0.8]));
    expect(new Set(values).size).toBeLessThan(values.length);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1);
  });

  it("provides a learning explanation for every input shape", () => {
    for (const shape of ["random", "sorted", "reverse", "nearly-sorted", "duplicates"] as const) {
      expect(describeSortInput(shape).length).toBeGreaterThan(25);
    }
  });
});
