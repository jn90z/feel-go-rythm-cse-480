import type { Graph, VertexId } from "../graph/Graph";
import { cloneStates, type AlgorithmStep, type VertexVisualState } from "./AlgorithmStep";

export const DFS_PSEUDOCODE = [
  "procedure DFS(graph, start)",
  "  create empty stack",
  "  push start",
  "  while stack is not empty",
  "    current = pop",
  "    if current is undiscovered",
  "      mark current discovered; visit it",
  "      for each neighbor of current",
  "        if neighbor is undiscovered",
  "          push neighbor"
];

export function runDfs(graph: Graph, start: VertexId): AlgorithmStep[] {
  const states = new Map<VertexId, VertexVisualState>();
  for (const vertex of graph.getVertices()) states.set(vertex.id, "default");

  const steps: AlgorithmStep[] = [];
  const stack: VertexId[] = [];
  const discovered = new Set<VertexId>();

  const pushStep = (line: number, message: string) => {
    steps.push({
      line,
      message,
      frontierLabel: "Stack",
      frontier: [...stack],
      vertexStates: cloneStates(states)
    });
  };

  pushStep(0, "Start depth-first search.");
  pushStep(1, "Create an empty stack.");
  stack.push(start);
  states.set(start, "frontier");
  pushStep(2, "Push the start vertex.");

  while (stack.length > 0) {
    pushStep(3, "The stack is not empty.");

    const current = stack.pop()!;
    states.set(current, "active");
    pushStep(4, "Pop the top vertex.");

    if (!discovered.has(current)) {
      pushStep(5, "This vertex has not been discovered.");
      discovered.add(current);
      states.set(current, "active");
      pushStep(6, "Discover and visit the current vertex.");

      const neighbors = graph.neighbors(current);
      for (let i = neighbors.length - 1; i >= 0; i--) {
        const neighbor = neighbors[i];
        pushStep(7, "Inspect a neighbor.");
        if (!discovered.has(neighbor)) {
          pushStep(8, "This neighbor is undiscovered.");
          stack.push(neighbor);
          if (states.get(neighbor) === "default") states.set(neighbor, "frontier");
          pushStep(9, "Push the neighbor.");
        }
      }

      states.set(current, "visited");
    }
  }

  pushStep(3, "The stack is empty. DFS is complete.");
  return steps;
}
