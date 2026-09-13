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
    if (!Number.isFinite(weight)) throw new Error("Edge weight must be finite.");

    const existing = [...this.edges.values()].find(
      e => (e.from === from && e.to === to) || (e.from === to && e.to === from)
    );
    if (existing) return existing;

    const edge: Edge = { id: crypto.randomUUID(), from, to, weight };
    this.edges.set(edge.id, edge);
    return edge;
  }

  updateEdgeWeight(id: EdgeId, weight: number): Edge | undefined {
    if (!Number.isFinite(weight)) {
      throw new Error("Edge weight must be a finite number.");
    }
    const edge = this.edges.get(id);
    if (!edge) return undefined;
    edge.weight = weight;
    return edge;
  }

  removeEdge(id: EdgeId): boolean {
    return this.edges.delete(id);
  }

  neighbors(id: VertexId): VertexId[] {
    return this.neighborEdges(id).map(({ vertex }) => vertex);
  }

  neighborEdges(id: VertexId): Array<{ vertex: VertexId; edge: Edge }> {
    const result: Array<{ vertex: VertexId; edge: Edge }> = [];
    for (const edge of this.edges.values()) {
      if (edge.from === id) result.push({ vertex: edge.to, edge });
      else if (edge.to === id) result.push({ vertex: edge.from, edge });
    }
    return result;
  }

  clear(): void {
    this.vertices.clear();
    this.edges.clear();
    this.nextVertexNumber = 0;
  }

  getVertex(id: VertexId): Vertex | undefined {
    return this.vertices.get(id);
  }

  getEdge(id: EdgeId): Edge | undefined {
    return this.edges.get(id);
  }

  getVertices(): Vertex[] {
    return [...this.vertices.values()];
  }

  getEdges(): Edge[] {
    return [...this.edges.values()];
  }
}
