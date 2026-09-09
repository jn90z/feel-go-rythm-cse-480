import { describe, expect, it } from "vitest";
import { runBfs } from "../src/algorithms/bfs";
import { runDijkstra } from "../src/algorithms/dijkstra";
import { Graph } from "../src/graph/Graph";

describe("algorithms", () => {
  it("BFS eventually visits every reachable vertex", () => {
    const graph = new Graph();
    const a = graph.addVertex("A");
    const b = graph.addVertex("B");
    const c = graph.addVertex("C");
    graph.addEdge(a.id, b.id);
    graph.addEdge(b.id, c.id);

    const steps = runBfs(graph, a.id);
    const final = steps.at(-1)!;

    expect(final.vertexStates.get(a.id)).toBe("visited");
    expect(final.vertexStates.get(b.id)).toBe("visited");
    expect(final.vertexStates.get(c.id)).toBe("visited");
  });

  it("Dijkstra finds the lower-cost weighted route", () => {
    const graph = new Graph();
    const a = graph.addVertex("A");
    const b = graph.addVertex("B");
    const c = graph.addVertex("C");
    graph.addEdge(a.id, c.id, 10);
    graph.addEdge(a.id, b.id, 2);
    graph.addEdge(b.id, c.id, 3);

    const steps = runDijkstra(graph, a.id);
    const final = steps.at(-1)!;

    expect(final.distances?.get(c.id)).toBe(5);
  });
});
