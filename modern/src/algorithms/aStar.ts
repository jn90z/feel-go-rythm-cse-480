import type { Graph, VertexId } from "../graph/Graph";
import { cloneStates, type AlgorithmStep, type VertexVisualState } from "./AlgorithmStep";

export const ASTAR_PSEUDOCODE = [
  "procedure AStar(graph, start, goal)",
  "  g[start] = 0",
  "  f[start] = heuristic(start, goal)",
  "  while open set is not empty",
  "    current = vertex with smallest f",
  "    if current = goal, stop",
  "    for each neighbor",
  "      tentative = g[current] + edge.weight",
  "      if tentative improves g[neighbor]",
  "        update g and f; add neighbor to open set"
];

export function runAStar(
  graph: Graph,
  start: VertexId,
  goal: VertexId,
  heuristic: (from: VertexId, to: VertexId) => number
): AlgorithmStep[] {
  const states = new Map<VertexId, VertexVisualState>();
  const g = new Map<VertexId, number>();
  const f = new Map<VertexId, number>();
  const open = new Set<VertexId>();
  const closed = new Set<VertexId>();
  const steps: AlgorithmStep[] = [];

  for (const v of graph.getVertices()) {
    states.set(v.id, "default");
    g.set(v.id, Infinity);
    f.set(v.id, Infinity);
  }

  const orderedOpen = () => [...open].sort((a, b) => (f.get(a) ?? Infinity) - (f.get(b) ?? Infinity));
  const push = (line: number, message: string) => {
    steps.push({ line, message, frontierLabel: "Open Set", frontier: orderedOpen(), vertexStates: cloneStates(states), distances: new Map(g) });
  };

  push(0, "Start A* search.");
  g.set(start, 0);
  push(1, "Set the start cost to 0.");
  f.set(start, heuristic(start, goal));
  open.add(start);
  states.set(start, "frontier");
  push(2, "Estimate the start-to-goal cost with the heuristic.");

  while (open.size) {
    push(3, "The open set still contains candidates.");
    const current = orderedOpen()[0];
    open.delete(current);
    states.set(current, "active");
    push(4, "Choose the vertex with the smallest estimated total cost.");

    if (current === goal) {
      states.set(current, "visited");
      push(5, "Goal reached. A* is complete.");
      return steps;
    }

    closed.add(current);
    for (const { vertex: neighbor, edge } of graph.neighborEdges(current)) {
      if (closed.has(neighbor)) continue;
      push(6, `Inspect a neighbor across edge weight ${edge.weight}.`);
      const tentative = (g.get(current) ?? Infinity) + edge.weight;
      push(7, `Tentative path cost is ${tentative}.`);
      if (tentative < (g.get(neighbor) ?? Infinity)) {
        push(8, "This path improves the neighbor's known cost.");
        g.set(neighbor, tentative);
        f.set(neighbor, tentative + heuristic(neighbor, goal));
        open.add(neighbor);
        states.set(neighbor, "frontier");
        push(9, "Update cost and priority; add the neighbor to the open set.");
      }
    }
    states.set(current, "visited");
  }

  push(3, "Open set exhausted without reaching the goal.");
  return steps;
}
