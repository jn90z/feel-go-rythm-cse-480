import "./styles.css";
import { Graph, type VertexId } from "./graph/Graph";
import { GraphScene } from "./visualization/GraphScene";

const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const addVertexButton = document.querySelector<HTMLButtonElement>("#addVertex");
const addEdgeButton = document.querySelector<HTMLButtonElement>("#addEdge");
const clearButton = document.querySelector<HTMLButtonElement>("#clearGraph");
const status = document.querySelector<HTMLParagraphElement>("#status");

if (!canvas || !addVertexButton || !addEdgeButton || !clearButton || !status) {
  throw new Error("Required UI elements are missing.");
}

const graph = new Graph();
const graphScene = new GraphScene(canvas);
const recentVertices: VertexId[] = [];

addVertexButton.addEventListener("click", () => {
  const vertex = graph.addVertex();
  graphScene.addVertex(vertex);
  recentVertices.push(vertex.id);
  status.textContent = `Added vertex ${vertex.label}`;
});

addEdgeButton.addEventListener("click", () => {
  if (recentVertices.length < 2) {
    status.textContent = "Add at least two vertices first.";
    return;
  }

  const to = recentVertices[recentVertices.length - 1];
  const from = recentVertices[recentVertices.length - 2];
  const edge = graph.addEdge(from, to);
  graphScene.addEdge(edge);
  status.textContent = "Connected the two most recently added vertices.";
});

clearButton.addEventListener("click", () => {
  graph.clear();
  graphScene.clear();
  recentVertices.length = 0;
  status.textContent = "Graph cleared.";
});
