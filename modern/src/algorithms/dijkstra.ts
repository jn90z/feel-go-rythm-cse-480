import type { Graph, VertexId } from "../graph/Graph";
import { cloneStates, type AlgorithmStep, type VertexVisualState } from "./AlgorithmStep";

export const DIJKSTRA_PSEUDOCODE = [
  "procedure Dijkstra(graph, start)",
  "  set every distance to infinity",
  "  distance[start] = 0",
  "  while an unvisited vertex remains",
  "    current = unvisited vertex with smallest distance",
  "    mark current visited",
  "    for each weighted edge current -> neighbor",
  "      candidate = distance[current] + edge.weight",
  "      if candidate < distance[neighbor]",
  "        distance[neighbor] = candidate"
];

export function runDijkstra(graph: Graph, start: VertexId): AlgorithmStep[] {
  const states = new Map<VertexId, VertexVisualState>();
  const distances = new Map<VertexId, number>();
  const visited = new Set<VertexId>();
  const steps: AlgorithmStep[] = [];

  for (const vertex of graph.getVertices()) {
    states.set(vertex.id, "default");
    distances.set(vertex.id, Number.POSITIVE_INFINITY);
  }

  const openSet = (): VertexId[] =>
    graph.getVertices()
      .map(v => v.id)
      .filter(id => !visited.has(id) && Number.isFinite(distances.get(id) ?? Infinity))
      .sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity));

  const push = (line: number, message: string) => {
    steps.push({
      line,
      message,
      frontierLabel: "Open Set",
      frontier: openSet(),
      vertexStates: cloneStates(states),
      distances: new Map(distances)
    });
  };

  push(0, "Start Dijkstra's algorithm.");
  push(1, "Initialize all distances to infinity.");
  distances.set(start, 0);
  states.set(start, "frontier");
  push(2, "Set the start vertex distance to 0.");

  while (true) {
    const candidates = openSet();
    if (candidates.length === 0) break;
    push(3, "At least one reachable unvisited vertex remains.");

    const current = candidates[0];
    states.set(current, "active");
    push(4, "Choose the unvisited vertex with the smallest tentative distance.");

    visited.add(current);
    push(5, "Mark the current vertex visited.");

    for (const { vertex: neighbor, edge } of graph.neighborEdges(current)) {
      if (visited.has(neighbor)) continue;

      push(6, `Inspect edge with weight ${edge.weight}.`);
      const candidate = (distances.get(current) ?? Infinity) + edge.weight;
      push(7, `Candidate distance is ${candidate}.`);

      if (candidate < (distances.get(neighbor) ?? Infinity)) {
        push(8, "The candidate improves the known distance.");
        distances.set(neighbor, candidate);
        if (states.get(neighbor) === "default") states.set(neighbor, "frontier");
        push(9, `Update the neighbor distance to ${candidate}.`);
      }
    }

    states.set(current, "visited");
  }

  push(3, "No reachable unvisited vertices remain. Dijkstra is complete.");
  return steps;
}
