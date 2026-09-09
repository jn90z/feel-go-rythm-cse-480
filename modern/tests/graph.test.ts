import { describe, expect, it } from "vitest";
import { Graph } from "../src/graph/Graph";

describe("Graph", () => {
  it("removes connected edges when a vertex is removed", () => {
    const graph = new Graph();
    const a = graph.addVertex("A");
    const b = graph.addVertex("B");
    graph.addEdge(a.id, b.id, 3);

    const removed = graph.removeVertex(a.id);

    expect(removed).toHaveLength(1);
    expect(graph.getEdges()).toHaveLength(0);
    expect(graph.getVertex(a.id)).toBeUndefined();
  });

  it("does not create duplicate undirected edges", () => {
    const graph = new Graph();
    const a = graph.addVertex("A");
    const b = graph.addVertex("B");

    graph.addEdge(a.id, b.id);
    graph.addEdge(b.id, a.id);

    expect(graph.getEdges()).toHaveLength(1);
  });

  it("updates edge weights", () => {
    const graph = new Graph();
    const a = graph.addVertex("A");
    const b = graph.addVertex("B");
    const edge = graph.addEdge(a.id, b.id, 1);

    graph.updateEdgeWeight(edge.id, 7);

    expect(graph.getEdge(edge.id)?.weight).toBe(7);
  });
});
