import type { Graph, VertexId } from "../graph/Graph";
import { cloneStates, type AlgorithmStep, type VertexVisualState } from "./AlgorithmStep";

export const PRIM_PSEUDOCODE = [
  "procedure Prim(graph, start)",
  "  add start to tree",
  "  while tree does not span all reachable vertices",
  "    choose lightest edge crossing tree boundary",
  "    add its outside vertex to tree"
];

export function runPrim(graph: Graph, start: VertexId): AlgorithmStep[] {
  const states = new Map<VertexId, VertexVisualState>();
  const visited = new Set<VertexId>();
  const steps: AlgorithmStep[] = [];
  for (const v of graph.getVertices()) states.set(v.id, "default");

  const push = (line: number, message: string, frontier: VertexId[] = []) => {
    steps.push({ line, message, frontierLabel: "Tree Boundary", frontier, vertexStates: cloneStates(states) });
  };

  push(0, "Start Prim's minimum spanning tree algorithm.");
  visited.add(start);
  states.set(start, "visited");
  push(1, "Add the start vertex to the spanning tree.");

  while (visited.size < graph.getVertices().length) {
    push(2, "Find the lightest edge that leaves the current tree.");
    const candidates = graph.getEdges()
      .filter(e => visited.has(e.from) !== visited.has(e.to))
      .sort((a, b) => a.weight - b.weight);
    if (!candidates.length) {
      push(2, "No crossing edge remains; the graph is disconnected.");
      break;
    }
    const edge = candidates[0];
    const next = visited.has(edge.from) ? edge.to : edge.from;
    states.set(next, "active");
    push(3, `Choose edge of weight ${edge.weight}.`, [next]);
    visited.add(next);
    states.set(next, "visited");
    push(4, "Add the new vertex to the spanning tree.");
  }

  return steps;
}
