import type { VertexId } from "../graph/Graph";

export type AlgorithmName = "bfs" | "dfs" | "dijkstra" | "astar" | "bellman-ford" | "prim" | "kruskal";
export type VertexVisualState = "default" | "frontier" | "active" | "visited";

export interface AlgorithmStep {
  line: number;
  message: string;
  frontierLabel: string;
  frontier: VertexId[];
  vertexStates: Map<VertexId, VertexVisualState>;
  distances?: Map<VertexId, number>;
}

export function cloneStates(
  source: Map<VertexId, VertexVisualState>
): Map<VertexId, VertexVisualState> {
  return new Map(source);
}
