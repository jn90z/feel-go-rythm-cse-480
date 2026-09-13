const runtimeError = (message: string): void => {
  const panel = document.querySelector<HTMLElement>("#runtimeError");
  const text = document.querySelector<HTMLElement>("#runtimeErrorText");
  if (panel && text) {
    text.textContent = message;
    panel.hidden = false;
  }
  console.error(message);
};

window.addEventListener("error", event => {
  runtimeError(`Startup/runtime error: ${event.message}`);
});

window.addEventListener("unhandledrejection", event => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  runtimeError(`Unhandled error: ${reason}`);
});

document.documentElement.classList.toggle("android", /Android/i.test(navigator.userAgent));

import "./styles.css";
import type { AlgorithmStep } from "./algorithms/AlgorithmStep";
import { BFS_PSEUDOCODE, runBfs } from "./algorithms/bfs";
import { DFS_PSEUDOCODE, runDfs } from "./algorithms/dfs";
import { DIJKSTRA_PSEUDOCODE, runDijkstra } from "./algorithms/dijkstra";
import { Graph, type EdgeId, type VertexId } from "./graph/Graph";
import { GraphScene } from "./visualization/GraphScene";

const get = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};

const canvas = get<HTMLCanvasElement>("#renderCanvas");
const addVertexButton = get<HTMLButtonElement>("#addVertex");
const addEdgeButton = get<HTMLButtonElement>("#addEdge");
const deleteSelectedButton = get<HTMLButtonElement>("#deleteSelected");
const clearButton = get<HTMLButtonElement>("#clearGraph");
const edgeWeight = get<HTMLInputElement>("#edgeWeight");
const applyEdgeWeight = get<HTMLButtonElement>("#applyEdgeWeight");
const status = get<HTMLParagraphElement>("#status");
const algorithmSelect = get<HTMLSelectElement>("#algorithmSelect");
const useSelectedStart = get<HTMLButtonElement>("#useSelectedStart");
const startVertexText = get<HTMLParagraphElement>("#startVertex");
const previousStep = get<HTMLButtonElement>("#previousStep");
const playPause = get<HTMLButtonElement>("#playPause");
const nextStep = get<HTMLButtonElement>("#nextStep");
const speed = get<HTMLInputElement>("#speed");
const frontierTitle = get<HTMLElement>("#frontierTitle");
const frontier = get<HTMLDivElement>("#frontier");
const distances = get<HTMLDivElement>("#distances");
const stepCounter = get<HTMLElement>("#stepCounter");
const algorithmMessage = get<HTMLParagraphElement>("#algorithmMessage");
const pseudocode = get<HTMLPreElement>("#pseudocode");

const graph = new Graph();
const selectedVertices: VertexId[] = [];
let selectedEdge: EdgeId | null = null;
let startVertex: VertexId | null = null;
let steps: AlgorithmStep[] = [];
let stepIndex = -1;
let timer: number | null = null;

const graphScene = new GraphScene(canvas, {
  onSelect(selection, modifiers) {
    stopPlayback();

    if (!selection) {
      selectedEdge = null;
      status.textContent = "Selection cleared.";
      return;
    }

    if (selection.kind === "edge") {
      selectedVertices.length = 0;
      selectedEdge = selection.id;
      const edge = graph.getEdge(selection.id);
      if (edge) edgeWeight.value = String(edge.weight);
      status.textContent = "Edge selected.";
      return;
    }

    selectedEdge = null;

    if (modifiers?.shiftKey && selectedVertices.length > 0) {
      const from = selectedVertices[selectedVertices.length - 1];
      const to = selection.id;
      if (from !== to) {
        connectVertices(from, to, true);
        selectedVertices.length = 0;
        selectedVertices.push(to);
        return;
      }
    }

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
      ? `Selected vertices: ${labels.join(", ")}. Shift-click another vertex to connect.`
      : "Vertex selection cleared.";
  },

  onVertexMoved(id) {
    stopPlayback();
    const label = graph.getVertex(id)?.label ?? "?";
    status.textContent = `Moved vertex ${label}`;
  }
});

function stopPlayback(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  playPause.textContent = "Play";
}

function invalidateAlgorithm(): void {
  stopPlayback();
  steps = [];
  stepIndex = -1;
  graphScene.resetAlgorithmState();
  renderStep();
}

function connectVertices(from: VertexId, to: VertexId, chain = false): void {
  const before = graph.getEdges().length;
  const edge = graph.addEdge(from, to, Number(edgeWeight.value) || 1);
  graphScene.addEdge(edge);
  invalidateAlgorithm();

  const fromLabel = graph.getVertex(from)?.label ?? "?";
  const toLabel = graph.getVertex(to)?.label ?? "?";
  status.textContent =
    graph.getEdges().length === before
      ? `${fromLabel} and ${toLabel} are already connected.`
      : chain
        ? `Connected ${fromLabel} → ${toLabel}. Shift-click another vertex to continue.`
        : `Connected ${fromLabel} → ${toLabel} with weight ${edge.weight}.`;
}

function renderPseudocode(lines: string[], activeLine = -1): void {
  pseudocode.textContent = "";
  lines.forEach((line, index) => {
    const span = document.createElement("span");
    span.className = index === activeLine ? "code-line active" : "code-line";
    span.textContent = line;
    pseudocode.append(span);
    pseudocode.append("\n");
  });
}

function currentPseudocode(): string[] {
  if (algorithmSelect.value === "dfs") return DFS_PSEUDOCODE;
  if (algorithmSelect.value === "dijkstra") return DIJKSTRA_PSEUDOCODE;
  return BFS_PSEUDOCODE;
}

function buildSteps(): void {
  if (!startVertex || !graph.getVertex(startVertex)) {
    steps = [];
    stepIndex = -1;
    algorithmMessage.textContent = "Choose a valid start vertex.";
    renderStep();
    return;
  }

  if (algorithmSelect.value === "dfs") steps = runDfs(graph, startVertex);
  else if (algorithmSelect.value === "dijkstra") steps = runDijkstra(graph, startVertex);
  else steps = runBfs(graph, startVertex);

  stepIndex = steps.length ? 0 : -1;
  renderStep();
}

function renderStep(): void {
  renderPseudocode(currentPseudocode(), stepIndex >= 0 ? steps[stepIndex]?.line ?? -1 : -1);
  distances.replaceChildren();

  if (stepIndex < 0 || !steps[stepIndex]) {
    frontierTitle.textContent =
      algorithmSelect.value === "dfs"
        ? "Stack"
        : algorithmSelect.value === "dijkstra"
          ? "Open Set"
          : "Queue";
    frontier.replaceChildren();
    stepCounter.textContent = "0 / 0";
    algorithmMessage.textContent = startVertex
      ? "Ready to run."
      : "Choose a start vertex and run an algorithm.";
    graphScene.resetAlgorithmState();
    return;
  }

  const step = steps[stepIndex];
  graphScene.applyAlgorithmState(step.vertexStates);
  frontierTitle.textContent = step.frontierLabel;
  frontier.replaceChildren();

  for (const id of step.frontier) {
    const chip = document.createElement("span");
    chip.className = "frontier-chip";
    chip.textContent = graph.getVertex(id)?.label ?? "?";
    frontier.append(chip);
  }

  if (step.distances) {
    for (const vertex of graph.getVertices()) {
      const value = step.distances.get(vertex.id) ?? Infinity;
      const item = document.createElement("span");
      item.className = "distance-chip";
      item.textContent = `${vertex.label}: ${Number.isFinite(value) ? value : "∞"}`;
      distances.append(item);
    }
  }

  stepCounter.textContent = `${stepIndex + 1} / ${steps.length}`;
  algorithmMessage.textContent = step.message;
}

function scheduleNext(): void {
  stopPlayback();
  playPause.textContent = "Pause";

  const tick = () => {
    if (stepIndex < steps.length - 1) {
      stepIndex++;
      renderStep();
      timer = window.setTimeout(tick, Number(speed.value));
    } else {
      stopPlayback();
    }
  };

  timer = window.setTimeout(tick, Number(speed.value));
}

addVertexButton.addEventListener("click", () => {
  const vertex = graph.addVertex();
  graphScene.addVertex(vertex);
  invalidateAlgorithm();
  status.textContent = `Added vertex ${vertex.label}`;
});

addEdgeButton.addEventListener("click", () => {
  if (selectedVertices.length !== 2) {
    status.textContent = "Select exactly two vertices first.";
    return;
  }

  const [from, to] = selectedVertices;
  connectVertices(from, to);
});

applyEdgeWeight.addEventListener("click", () => {
  if (!selectedEdge) {
    status.textContent = "Select an edge first.";
    return;
  }

  const value = Number(edgeWeight.value);
  try {
    const edge = graph.updateEdgeWeight(selectedEdge, value);
    if (!edge) return;
    graphScene.updateEdgeWeight(edge);
    invalidateAlgorithm();
    status.textContent = `Edge weight updated to ${edge.weight}.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Invalid edge weight.";
  }
});

deleteSelectedButton.addEventListener("click", () => {
  if (selectedEdge) {
    graph.removeEdge(selectedEdge);
    graphScene.removeEdge(selectedEdge);
    selectedEdge = null;
    invalidateAlgorithm();
    status.textContent = "Edge deleted.";
    return;
  }

  if (selectedVertices.length === 0) {
    status.textContent = "Select a vertex or edge first.";
    return;
  }

  for (const id of [...selectedVertices]) {
    if (startVertex === id) {
      startVertex = null;
      startVertexText.textContent = "Start vertex: none";
    }

    const removedEdges = graph.removeVertex(id);
    for (const edgeId of removedEdges) graphScene.removeEdge(edgeId);
    graphScene.removeVertex(id);
  }

  selectedVertices.length = 0;
  invalidateAlgorithm();
  status.textContent = "Selected vertex deleted.";
});

clearButton.addEventListener("click", () => {
  graph.clear();
  graphScene.clear();
  selectedVertices.length = 0;
  selectedEdge = null;
  startVertex = null;
  startVertexText.textContent = "Start vertex: none";
  invalidateAlgorithm();
  status.textContent = "Graph cleared.";
});

useSelectedStart.addEventListener("click", () => {
  if (selectedVertices.length !== 1) {
    algorithmMessage.textContent = "Select exactly one vertex first.";
    return;
  }

  startVertex = selectedVertices[0];
  const label = graph.getVertex(startVertex)?.label ?? "?";
  startVertexText.textContent = `Start vertex: ${label}`;
  buildSteps();
});

algorithmSelect.addEventListener("change", () => {
  stopPlayback();
  buildSteps();
});

previousStep.addEventListener("click", () => {
  stopPlayback();
  if (!steps.length) buildSteps();
  if (stepIndex > 0) stepIndex--;
  renderStep();
});

nextStep.addEventListener("click", () => {
  stopPlayback();
  if (!steps.length) buildSteps();
  if (stepIndex < steps.length - 1) stepIndex++;
  renderStep();
});

playPause.addEventListener("click", () => {
  if (!steps.length) buildSteps();
  if (!steps.length) return;

  if (timer !== null) {
    stopPlayback();
    return;
  }

  if (stepIndex >= steps.length - 1) {
    stepIndex = 0;
    renderStep();
  }

  scheduleNext();
});

window.addEventListener("keydown", event => {
  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelectedButton.click();
  }
});

renderPseudocode(currentPseudocode());
