export type Terrain = "road" | "grass" | "mud" | "wall";
export type WeightedSearchAlgorithm = "dijkstra" | "astar";

export const TERRAIN_COST: Record<Exclude<Terrain, "wall">, number> = {
  road: 1,
  grass: 3,
  mud: 7
};

export interface WeightedGrid {
  rows: number;
  cols: number;
  terrain: Terrain[];
  start: number;
  goal: number;
}

export interface WeightedSearchStep {
  current: number;
  visited: number[];
  frontier: number[];
  costs: number[];
  message: string;
}

export interface WeightedSearchResult {
  algorithm: WeightedSearchAlgorithm;
  path: number[];
  totalCost: number;
  visitedCount: number;
  steps: WeightedSearchStep[];
  costs: number[];
}

export function createWeightedGrid(rows = 10, cols = 14): WeightedGrid {
  const size = rows * cols;
  return {
    rows,
    cols,
    terrain: Array<Terrain>(size).fill("road"),
    start: 0,
    goal: size - 1
  };
}

export function terrainCost(terrain: Terrain): number {
  return terrain === "wall" ? Number.POSITIVE_INFINITY : TERRAIN_COST[terrain];
}

export function neighbors(grid: WeightedGrid, index: number): number[] {
  const row = Math.floor(index / grid.cols);
  const col = index % grid.cols;
  const candidates = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1]
  ];
  return candidates
    .filter(([r, c]) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
    .map(([r, c]) => r * grid.cols + c)
    .filter(next => grid.terrain[next] !== "wall");
}

function heuristic(grid: WeightedGrid, index: number): number {
  const row = Math.floor(index / grid.cols);
  const col = index % grid.cols;
  const goalRow = Math.floor(grid.goal / grid.cols);
  const goalCol = grid.goal % grid.cols;
  return Math.abs(row - goalRow) + Math.abs(col - goalCol);
}

function reconstructPath(cameFrom: Map<number, number>, start: number, goal: number): number[] {
  if (start === goal) return [start];
  if (!cameFrom.has(goal)) return [];
  const path = [goal];
  let current = goal;
  while (current !== start) {
    current = cameFrom.get(current)!;
    path.push(current);
  }
  return path.reverse();
}

export function runWeightedSearch(grid: WeightedGrid, algorithm: WeightedSearchAlgorithm): WeightedSearchResult {
  if (grid.terrain.length !== grid.rows * grid.cols) throw new Error("Terrain size does not match grid dimensions.");
  if (grid.start < 0 || grid.start >= grid.terrain.length || grid.goal < 0 || grid.goal >= grid.terrain.length) {
    throw new Error("Start and goal must be valid grid cells.");
  }
  if (grid.terrain[grid.start] === "wall" || grid.terrain[grid.goal] === "wall") {
    return { algorithm, path: [], totalCost: Number.POSITIVE_INFINITY, visitedCount: 0, steps: [], costs: Array(grid.terrain.length).fill(Number.POSITIVE_INFINITY) };
  }

  const costs = Array(grid.terrain.length).fill(Number.POSITIVE_INFINITY) as number[];
  costs[grid.start] = 0;
  const cameFrom = new Map<number, number>();
  const frontier = new Set<number>([grid.start]);
  const closed = new Set<number>();
  const visited: number[] = [];
  const steps: WeightedSearchStep[] = [];

  while (frontier.size > 0) {
    let current = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of frontier) {
      const score = costs[candidate] + (algorithm === "astar" ? heuristic(grid, candidate) : 0);
      if (score < bestScore || (score === bestScore && candidate < current)) {
        bestScore = score;
        current = candidate;
      }
    }

    frontier.delete(current);
    if (closed.has(current)) continue;
    closed.add(current);
    visited.push(current);

    steps.push({
      current,
      visited: [...visited],
      frontier: [...frontier],
      costs: [...costs],
      message: current === grid.goal
        ? `Reached the goal with accumulated cost ${costs[current]}.`
        : `${algorithm === "astar" ? "A*" : "Dijkstra"} expands cell ${current} because it has the lowest ${algorithm === "astar" ? "cost + heuristic estimate" : "known path cost"}.`
    });

    if (current === grid.goal) break;

    for (const next of neighbors(grid, current)) {
      if (closed.has(next)) continue;
      const nextCost = costs[current] + terrainCost(grid.terrain[next]);
      if (nextCost < costs[next]) {
        costs[next] = nextCost;
        cameFrom.set(next, current);
        frontier.add(next);
      }
    }
  }

  const path = reconstructPath(cameFrom, grid.start, grid.goal);
  return {
    algorithm,
    path,
    totalCost: path.length ? costs[grid.goal] : Number.POSITIVE_INFINITY,
    visitedCount: visited.length,
    steps,
    costs
  };
}
