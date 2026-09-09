import type { VertexId } from "../graph/Graph";

export type AlgorithmName = "bfs" | "dfs";
export type VertexVisualState = "default" | "frontier" | "active" | "visited";

export interface AlgorithmStep {
  line: number;
  message: string;
  frontierLabel: "Queue" | "Stack";
  frontier: VertexId[];
  vertexStates: Map<VertexId, VertexVisualState>;
}

export function cloneStates(
  source: Map<VertexId, VertexVisualState>
): Map<VertexId, VertexVisualState> {
  return new Map(source);
}
