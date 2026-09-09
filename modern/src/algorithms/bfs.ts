import type { Graph, VertexId } from "../graph/Graph";
import { cloneStates, type AlgorithmStep, type VertexVisualState } from "./AlgorithmStep";

export const BFS_PSEUDOCODE = [
  "procedure BFS(graph, start)",
  "  create empty queue",
  "  mark start discovered; enqueue start",
  "  while queue is not empty",
  "    current = dequeue",
  "    visit current",
  "    for each neighbor of current",
  "      if neighbor is undiscovered",
  "        mark neighbor discovered",
  "        enqueue neighbor"
];

export function runBfs(graph: Graph, start: VertexId): AlgorithmStep[] {
  const states = new Map<VertexId, VertexVisualState>();
  for (const vertex of graph.getVertices()) states.set(vertex.id, "default");

  const steps: AlgorithmStep[] = [];
  const queue: VertexId[] = [];
  const discovered = new Set<VertexId>();

  const push = (line: number, message: string) => {
    steps.push({
      line,
      message,
      frontierLabel: "Queue",
      frontier: [...queue],
      vertexStates: cloneStates(states)
    });
  };

  push(0, "Start breadth-first search.");
  push(1, "Create an empty queue.");

  discovered.add(start);
  states.set(start, "frontier");
  queue.push(start);
  push(2, "Discover the start vertex and enqueue it.");

  while (queue.length > 0) {
    push(3, "The queue is not empty.");

    const current = queue.shift()!;
    states.set(current, "active");
    push(4, "Dequeue the next vertex.");
    push(5, "Visit the current vertex.");

    for (const neighbor of graph.neighbors(current)) {
      push(6, "Inspect a neighbor.");
      if (!discovered.has(neighbor)) {
        push(7, "This neighbor has not been discovered.");
        discovered.add(neighbor);
        states.set(neighbor, "frontier");
        push(8, "Mark the neighbor discovered.");
        queue.push(neighbor);
        push(9, "Enqueue the neighbor.");
      }
    }

    states.set(current, "visited");
  }

  push(3, "The queue is empty. BFS is complete.");
  return steps;
}
