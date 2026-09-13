import type { Graph, VertexId } from "../graph/Graph";
import { cloneStates, type AlgorithmStep, type VertexVisualState } from "./AlgorithmStep";

export const BELLMAN_FORD_PSEUDOCODE = [
  "procedure BellmanFord(graph, start)",
  "  set every distance to infinity",
  "  distance[start] = 0",
  "  repeat |V|-1 times",
  "    for each edge (u, v, w)",
  "      relax u -> v",
  "      relax v -> u",
  "  if any edge can still relax, a negative cycle exists"
];

export function runBellmanFord(graph: Graph, start: VertexId): AlgorithmStep[] {
  const states = new Map<VertexId, VertexVisualState>();
  const distances = new Map<VertexId, number>();
  const steps: AlgorithmStep[] = [];

  for (const v of graph.getVertices()) {
    states.set(v.id, "default");
    distances.set(v.id, Infinity);
  }

  const push = (line: number, message: string, frontier: VertexId[] = []) => {
    steps.push({ line, message, frontierLabel: "Relaxing", frontier, vertexStates: cloneStates(states), distances: new Map(distances) });
  };

  push(0, "Start Bellman-Ford.");
  push(1, "Initialize all distances to infinity.");
  distances.set(start, 0);
  states.set(start, "frontier");
  push(2, "Set the start distance to 0.", [start]);

  const relax = (from: VertexId, to: VertexId, weight: number): boolean => {
    const fromDistance = distances.get(from) ?? Infinity;
    const candidate = fromDistance + weight;
    if (Number.isFinite(fromDistance) && candidate < (distances.get(to) ?? Infinity)) {
      distances.set(to, candidate);
      states.set(to, "frontier");
      return true;
    }
    return false;
  };

  const vertexCount = graph.getVertices().length;
  for (let i = 0; i < Math.max(0, vertexCount - 1); i++) {
    push(3, `Relaxation pass ${i + 1} of ${Math.max(0, vertexCount - 1)}.`);
    let changed = false;
    for (const edge of graph.getEdges()) {
      states.set(edge.from, "active");
      states.set(edge.to, "active");
      push(4, `Inspect edge of weight ${edge.weight}.`, [edge.from, edge.to]);
      if (relax(edge.from, edge.to, edge.weight)) {
        changed = true;
        push(5, "Relaxed the edge in the forward direction.", [edge.to]);
      }
      if (relax(edge.to, edge.from, edge.weight)) {
        changed = true;
        push(6, "Relaxed the edge in the reverse direction.", [edge.from]);
      }
      states.set(edge.from, "visited");
      states.set(edge.to, "visited");
    }
    if (!changed) break;
  }

  for (const edge of graph.getEdges()) {
    const a = distances.get(edge.from) ?? Infinity;
    const b = distances.get(edge.to) ?? Infinity;
    if ((Number.isFinite(a) && a + edge.weight < b) || (Number.isFinite(b) && b + edge.weight < a)) {
      push(7, "A negative cycle is reachable from the start vertex.", [edge.from, edge.to]);
      return steps;
    }
  }

  push(7, "No further relaxation is possible. Bellman-Ford is complete.");
  return steps;
}
