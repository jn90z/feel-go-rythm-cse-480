export type VertexId = string;
export type EdgeId = string;

export interface Vertex {
  id: VertexId;
  label: string;
}

export interface Edge {
  id: EdgeId;
  from: VertexId;
  to: VertexId;
  weight: number;
}

export class Graph {
  private readonly vertices = new Map<VertexId, Vertex>();
  private readonly edges = new Map<EdgeId, Edge>();
  private nextVertexNumber = 0;

  addVertex(label?: string): Vertex {
    const id = crypto.randomUUID();
    const vertex: Vertex = {
      id,
      label: label ?? String(this.nextVertexNumber++)
    };
    this.vertices.set(id, vertex);
    return vertex;
  }

  removeVertex(id: VertexId): EdgeId[] {
    if (!this.vertices.delete(id)) return [];

    const removedEdges: EdgeId[] = [];
    for (const edge of [...this.edges.values()]) {
      if (edge.from === id || edge.to === id) {
        this.edges.delete(edge.id);
        removedEdges.push(edge.id);
      }
    }
    return removedEdges;
  }

  addEdge(from: VertexId, to: VertexId, weight = 1): Edge {
    if (!this.vertices.has(from) || !this.vertices.has(to)) {
      throw new Error("Both vertices must exist before adding an edge.");
    }
    if (from === to) throw new Error("Self-edges are not supported yet.");

    const existing = [...this.edges.values()].find(
      e => (e.from === from && e.to === to) || (e.from === to && e.to === from)
    );
    if (existing) return existing;

    const edge: Edge = { id: crypto.randomUUID(), from, to, weight };
    this.edges.set(edge.id, edge);
    return edge;
  }

  removeEdge(id: EdgeId): boolean {
    return this.edges.delete(id);
  }

  clear(): void {
    this.vertices.clear();
    this.edges.clear();
    this.nextVertexNumber = 0;
  }

  getVertex(id: VertexId): Vertex | undefined {
    return this.vertices.get(id);
  }

  getVertices(): Vertex[] {
    return [...this.vertices.values()];
  }

  getEdges(): Edge[] {
    return [...this.edges.values()];
  }
}
