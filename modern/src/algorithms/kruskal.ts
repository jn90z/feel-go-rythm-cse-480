import type { Graph, VertexId } from "../graph/Graph";
import { cloneStates, type AlgorithmStep, type VertexVisualState } from "./AlgorithmStep";

export const KRUSKAL_PSEUDOCODE = [
  "procedure Kruskal(graph)",
  "  sort edges by increasing weight",
  "  for each edge in sorted order",
  "    if endpoints are in different components",
  "      add edge to spanning forest",
  "      union the components"
];

export function runKruskal(graph: Graph): AlgorithmStep[] {
  const states = new Map<VertexId, VertexVisualState>();
  const parent = new Map<VertexId, VertexId>();
  const steps: AlgorithmStep[] = [];
  for (const v of graph.getVertices()) {
    states.set(v.id, "default");
    parent.set(v.id, v.id);
  }

  const find = (id: VertexId): VertexId => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = id;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  const push = (line: number, message: string, frontier: VertexId[] = []) => {
    steps.push({ line, message, frontierLabel: "Components", frontier, vertexStates: cloneStates(states) });
  };

  push(0, "Start Kruskal's minimum spanning forest algorithm.");
  const edges = [...graph.getEdges()].sort((a, b) => a.weight - b.weight);
  push(1, "Sort all edges by increasing weight.");

  for (const edge of edges) {
    states.set(edge.from, "active");
    states.set(edge.to, "active");
    push(2, `Inspect edge of weight ${edge.weight}.`, [edge.from, edge.to]);
    const a = find(edge.from);
    const b = find(edge.to);
    if (a !== b) {
      push(3, "The endpoints are in different components.", [edge.from, edge.to]);
      parent.set(a, b);
      states.set(edge.from, "visited");
      states.set(edge.to, "visited");
      push(4, "Accept the edge into the spanning forest.");
      push(5, "Merge the two components.");
    } else {
      states.set(edge.from, "visited");
      states.set(edge.to, "visited");
      push(3, "Skip the edge because it would create a cycle.");
    }
  }

  return steps;
}
