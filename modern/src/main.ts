import "./styles.css";
import { Graph, type EdgeId, type VertexId } from "./graph/Graph";
import { GraphScene } from "./visualization/GraphScene";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const addVertexButton = document.querySelector<HTMLButtonElement>("#addVertex");
const addEdgeButton = document.querySelector<HTMLButtonElement>("#addEdge");
const deleteSelectedButton = document.querySelector<HTMLButtonElement>("#deleteSelected");
const clearButton = document.querySelector<HTMLButtonElement>("#clearGraph");
const status = document.querySelector<HTMLParagraphElement>("#status");

if (!canvas || !addVertexButton || !addEdgeButton || !deleteSelectedButton || !clearButton || !status) {
  throw new Error("Required UI elements are missing.");
}

const graph = new Graph();
const selectedVertices: VertexId[] = [];
let selectedEdge: EdgeId | null = null;

const graphScene = new GraphScene(canvas, {
  onSelect(selection) {
    if (!selection) {
      selectedEdge = null;
      status.textContent = "Selection cleared.";
      return;
    }

    if (selection.kind === "edge") {
      selectedVertices.length = 0;
      selectedEdge = selection.id;
      status.textContent = "Edge selected.";
      return;
    }

    selectedEdge = null;
    const existingIndex = selectedVertices.indexOf(selection.id);
    if (existingIndex >= 0) selectedVertices.splice(existingIndex, 1);
    else {
      if (selectedVertices.length === 2) selectedVertices.shift();
      selectedVertices.push(selection.id);
    }

    const labels = selectedVertices
      .map(id => graph.getVertex(id)?.label)
      .filter((label): label is string => Boolean(label));

    status.textContent = labels.length
      ? `Selected vertices: ${labels.join(", ")}`
      : "Vertex selection cleared.";
  },

  onVertexMoved(id) {
    const label = graph.getVertex(id)?.label ?? "?";
    status.textContent = `Moved vertex ${label}`;
  }
});

addVertexButton.addEventListener("click", () => {
  const vertex = graph.addVertex();
  graphScene.addVertex(vertex);
  status.textContent = `Added vertex ${vertex.label}`;
});

addEdgeButton.addEventListener("click", () => {
  if (selectedVertices.length !== 2) {
    status.textContent = "Select exactly two vertices first.";
    return;
  }

  const [from, to] = selectedVertices;
  const before = graph.getEdges().length;
  const edge = graph.addEdge(from, to);
  graphScene.addEdge(edge);
  const duplicate = graph.getEdges().length === before;

  status.textContent = duplicate ? "Those vertices are already connected." : "Edge created.";
});

deleteSelectedButton.addEventListener("click", () => {
  if (selectedEdge) {
    graph.removeEdge(selectedEdge);
    graphScene.removeEdge(selectedEdge);
    selectedEdge = null;
    status.textContent = "Edge deleted.";
    return;
  }

  if (selectedVertices.length === 0) {
    status.textContent = "Select a vertex or edge first.";
    return;
  }

  for (const id of [...selectedVertices]) {
    const removedEdges = graph.removeVertex(id);
    for (const edgeId of removedEdges) graphScene.removeEdge(edgeId);
    graphScene.removeVertex(id);
  }
  selectedVertices.length = 0;
  status.textContent = "Selected vertex deleted.";
});

clearButton.addEventListener("click", () => {
  graph.clear();
  graphScene.clear();
  selectedVertices.length = 0;
  selectedEdge = null;
  status.textContent = "Graph cleared.";
});

window.addEventListener("keydown", event => {
  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelectedButton.click();
  }
});
