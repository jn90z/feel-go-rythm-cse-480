import { describe, expect, it } from "vitest";
import { createWeightedGrid, runWeightedSearch, terrainCost, type WeightedGrid } from "./weightedPathfindingModel";

describe("weighted pathfinding model", () => {
  it("uses the configured terrain costs", () => {
    expect(terrainCost("road")).toBe(1);
    expect(terrainCost("grass")).toBe(3);
    expect(terrainCost("mud")).toBe(7);
    expect(terrainCost("wall")).toBe(Number.POSITIVE_INFINITY);
  });

  it("prefers a longer cheap route over a short muddy route", () => {
    const grid = createWeightedGrid(3, 5);
    grid.start = 5;
    grid.goal = 9;
    grid.terrain[6] = "mud";
    grid.terrain[7] = "mud";
    grid.terrain[8] = "mud";

    const result = runWeightedSearch(grid, "dijkstra");

    expect(result.path).toEqual([5, 0, 1, 2, 3, 4, 9]);
    expect(result.totalCost).toBe(6);
  });

  it("A* finds the same optimal path cost while visiting no more cells than Dijkstra on open terrain", () => {
    const grid = createWeightedGrid(8, 8);
    const dijkstra = runWeightedSearch(grid, "dijkstra");
    const astar = runWeightedSearch(grid, "astar");

    expect(astar.totalCost).toBe(dijkstra.totalCost);
    expect(astar.path.length).toBe(dijkstra.path.length);
    expect(astar.visitedCount).toBeLessThanOrEqual(dijkstra.visitedCount);
  });

  it("reports an unreachable goal when walls divide the grid", () => {
    const grid: WeightedGrid = createWeightedGrid(3, 3);
    grid.terrain[3] = "wall";
    grid.terrain[4] = "wall";
    grid.terrain[5] = "wall";

    const result = runWeightedSearch(grid, "astar");

    expect(result.path).toEqual([]);
    expect(result.totalCost).toBe(Number.POSITIVE_INFINITY);
  });

  it("emits educational search steps with snapshots", () => {
    const grid = createWeightedGrid(2, 3);
    const result = runWeightedSearch(grid, "astar");

    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[0].message).toContain("A*");
    expect(result.steps.at(-1)?.current).toBe(grid.goal);
    expect(result.steps.at(-1)?.message).toContain("Reached the goal");
  });
});
