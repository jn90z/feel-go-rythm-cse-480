const runtimeError = (message: string): void => {
  const panel = document.querySelector<HTMLElement>("#runtimeError");
  const text = document.querySelector<HTMLElement>("#runtimeErrorText");
  if (panel && text) {
    text.textContent = message;
    panel.hidden = false;
  }
  console.error(message);
};

window.addEventListener("error", event => runtimeError(`Startup/runtime error: ${event.message}`));
window.addEventListener("unhandledrejection", event => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  runtimeError(`Unhandled error: ${reason}`);
});
document.documentElement.classList.toggle("android", /Android/i.test(navigator.userAgent));

import "./styles.css";
import type { AlgorithmStep } from "./algorithms/AlgorithmStep";
import { ASTAR_PSEUDOCODE, runAStar } from "./algorithms/aStar";
import { BELLMAN_FORD_PSEUDOCODE, runBellmanFord } from "./algorithms/bellmanFord";
import { BFS_PSEUDOCODE, runBfs } from "./algorithms/bfs";
import { DFS_PSEUDOCODE, runDfs } from "./algorithms/dfs";
import { DIJKSTRA_PSEUDOCODE, runDijkstra } from "./algorithms/dijkstra";
import { KRUSKAL_PSEUDOCODE, runKruskal } from "./algorithms/kruskal";
import { PRIM_PSEUDOCODE, runPrim } from "./algorithms/prim";
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
const graphPreset = get<HTMLSelectElement>("#graphPreset");
const generateGraph = get<HTMLButtonElement>("#generateGraph");
const edgeWeight = get<HTMLInputElement>("#edgeWeight");
const applyEdgeWeight = get<HTMLButtonElement>("#applyEdgeWeight");
const status = get<HTMLParagraphElement>("#status");
const algorithmSelect = get<HTMLSelectElement>("#algorithmSelect");
const useSelectedStart = get<HTMLButtonElement>("#useSelectedStart");
const useSelectedGoal = get<HTMLButtonElement>("#useSelectedGoal");
const startVertexText = get<HTMLParagraphElement>("#startVertex");
const goalVertexText = get<HTMLParagraphElement>("#goalVertex");
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
let goalVertex: VertexId | null = null;
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
    status.textContent = `Moved vertex ${graph.getVertex(id)?.label ?? "?"}`;
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

function connectVertices(from: VertexId, to: VertexId, chain = false, weight?: number): void {
  const before = graph.getEdges().length;
  const edge = graph.addEdge(from, to, weight ?? (Number(edgeWeight.value) || 1));
  graphScene.addEdge(edge);
  invalidateAlgorithm();
  const fromLabel = graph.getVertex(from)?.label ?? "?";
  const toLabel = graph.getVertex(to)?.label ?? "?";
  status.textContent = graph.getEdges().length === before
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
    pseudocode.append(span, "\n");
  });
}

function currentPseudocode(): string[] {
  switch (algorithmSelect.value) {
    case "dfs": return DFS_PSEUDOCODE;
    case "dijkstra": return DIJKSTRA_PSEUDOCODE;
    case "astar": return ASTAR_PSEUDOCODE;
    case "bellman-ford": return BELLMAN_FORD_PSEUDOCODE;
    case "prim": return PRIM_PSEUDOCODE;
    case "kruskal": return KRUSKAL_PSEUDOCODE;
    default: return BFS_PSEUDOCODE;
  }
}

function hasNegativeWeights(): boolean {
  return graph.getEdges().some(edge => edge.weight < 0);
}

function buildSteps(): void {
  const algorithm = algorithmSelect.value;
  const needsStart = algorithm !== "kruskal";

  if (needsStart && (!startVertex || !graph.getVertex(startVertex))) {
    steps = [];
    stepIndex = -1;
    algorithmMessage.textContent = "Choose a valid start vertex.";
    renderStep();
    return;
  }

  if (["dijkstra", "astar", "prim", "kruskal"].includes(algorithm) && hasNegativeWeights()) {
    steps = [];
    stepIndex = -1;
    algorithmMessage.textContent = "This algorithm requires non-negative edge weights. Try Bellman-Ford instead.";
    renderStep();
    return;
  }

  if (algorithm === "astar") {
    if (!goalVertex || !graph.getVertex(goalVertex)) {
      steps = [];
      stepIndex = -1;
      algorithmMessage.textContent = "A* also needs a goal vertex.";
      renderStep();
      return;
    }
    steps = runAStar(graph, startVertex!, goalVertex, (a, b) => graphScene.distanceBetween(a, b));
  } else if (algorithm === "dfs") steps = runDfs(graph, startVertex!);
  else if (algorithm === "dijkstra") steps = runDijkstra(graph, startVertex!);
  else if (algorithm === "bellman-ford") steps = runBellmanFord(graph, startVertex!);
  else if (algorithm === "prim") steps = runPrim(graph, startVertex!);
  else if (algorithm === "kruskal") steps = runKruskal(graph);
  else steps = runBfs(graph, startVertex!);

  stepIndex = steps.length ? 0 : -1;
  renderStep();
}

function renderStep(): void {
  renderPseudocode(currentPseudocode(), stepIndex >= 0 ? steps[stepIndex]?.line ?? -1 : -1);
  distances.replaceChildren();
  if (stepIndex < 0 || !steps[stepIndex]) {
    const defaultTitles: Record<string, string> = {
      dfs: "Stack", dijkstra: "Open Set", astar: "Open Set", "bellman-ford": "Relaxing",
      prim: "Tree Boundary", kruskal: "Components", bfs: "Queue"
    };
    frontierTitle.textContent = defaultTitles[algorithmSelect.value] ?? "Queue";
    frontier.replaceChildren();
    stepCounter.textContent = "0 / 0";
    if (!algorithmMessage.textContent || algorithmMessage.textContent === "Ready to run.") {
      algorithmMessage.textContent = startVertex || algorithmSelect.value === "kruskal"
        ? "Ready to run."
        : "Choose a start vertex and run an algorithm.";
    }
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
      item.textContent = `${vertex.label}: ${Number.isFinite(value) ? Number(value.toFixed(1)) : "∞"}`;
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
    } else stopPlayback();
  };
  timer = window.setTimeout(tick, Number(speed.value));
}

function clearGraphState(): void {
  graph.clear();
  graphScene.clear();
  selectedVertices.length = 0;
  selectedEdge = null;
  startVertex = null;
  goalVertex = null;
  startVertexText.textContent = "Start vertex: none";
  goalVertexText.textContent = "Goal vertex: none";
  invalidateAlgorithm();
}

function addPresetVertex(x: number, z: number): VertexId {
  const vertex = graph.addVertex();
  graphScene.addVertex(vertex);
  graphScene.setVertexPosition(vertex.id, x, z);
  return vertex.id;
}

function addPresetEdge(a: VertexId, b: VertexId, weight = 1): void {
  const edge = graph.addEdge(a, b, weight);
  graphScene.addEdge(edge);
}

function generatePreset(kind: string): void {
  clearGraphState();
  if (kind === "blank") {
    status.textContent = "Blank graph ready.";
    return;
  }

  const vertices: VertexId[] = [];
  const count = kind === "grid" ? 9 : kind === "tree" ? 10 : 10;
  for (let i = 0; i < count; i++) {
    let x: number;
    let z: number;
    if (kind === "grid") {
      x = (i % 3 - 1) * 5;
      z = (Math.floor(i / 3) - 1) * 5;
    } else if (kind === "tree") {
      const level = Math.floor(Math.log2(i + 1));
      const first = 2 ** level - 1;
      const slot = i - first;
      const slots = 2 ** level;
      x = (slot - (slots - 1) / 2) * (12 / slots);
      z = -level * 4 + 5;
    } else {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.45;
      const radius = 4 + Math.random() * 5;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    }
    vertices.push(addPresetVertex(x, z));
  }

  const randomWeight = () => kind === "weighted" ? 1 + Math.floor(Math.random() * 9) : 1 + Math.floor(Math.random() * 4);

  if (kind === "tree") {
    for (let i = 1; i < vertices.length; i++) addPresetEdge(vertices[Math.floor((i - 1) / 2)], vertices[i], randomWeight());
  } else if (kind === "grid") {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      if (c < 2) addPresetEdge(vertices[i], vertices[i + 1], randomWeight());
      if (r < 2) addPresetEdge(vertices[i], vertices[i + 3], randomWeight());
    }
  } else {
    for (let i = 1; i < vertices.length; i++) addPresetEdge(vertices[i - 1], vertices[i], randomWeight());
    addPresetEdge(vertices[vertices.length - 1], vertices[0], randomWeight());
    const extraEdges = kind === "random-dense" ? 15 : kind === "weighted" ? 8 : 5;
    let attempts = 0;
    while (graph.getEdges().length < vertices.length + extraEdges && attempts++ < 100) {
      const a = vertices[Math.floor(Math.random() * vertices.length)];
      const b = vertices[Math.floor(Math.random() * vertices.length)];
      if (a !== b) addPresetEdge(a, b, randomWeight());
    }
  }

  startVertex = vertices[0];
  goalVertex = vertices[vertices.length - 1];
  startVertexText.textContent = `Start vertex: ${graph.getVertex(startVertex)?.label}`;
  goalVertexText.textContent = `Goal vertex: ${graph.getVertex(goalVertex)?.label}`;
  status.textContent = `Generated ${kind.replaceAll("-", " ")} graph with ${vertices.length} vertices and ${graph.getEdges().length} edges.`;
  invalidateAlgorithm();
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
  connectVertices(selectedVertices[0], selectedVertices[1]);
});

generateGraph.addEventListener("click", () => generatePreset(graphPreset.value));

applyEdgeWeight.addEventListener("click", () => {
  if (!selectedEdge) {
    status.textContent = "Select an edge first.";
    return;
  }
  try {
    const edge = graph.updateEdgeWeight(selectedEdge, Number(edgeWeight.value));
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
    if (startVertex === id) startVertex = null;
    if (goalVertex === id) goalVertex = null;
    const removedEdges = graph.removeVertex(id);
    for (const edgeId of removedEdges) graphScene.removeEdge(edgeId);
    graphScene.removeVertex(id);
  }
  selectedVertices.length = 0;
  startVertexText.textContent = `Start vertex: ${startVertex ? graph.getVertex(startVertex)?.label : "none"}`;
  goalVertexText.textContent = `Goal vertex: ${goalVertex ? graph.getVertex(goalVertex)?.label : "none"}`;
  invalidateAlgorithm();
  status.textContent = "Selected vertex deleted.";
});

clearButton.addEventListener("click", () => {
  clearGraphState();
  status.textContent = "Graph cleared.";
});

useSelectedStart.addEventListener("click", () => {
  if (selectedVertices.length !== 1) {
    algorithmMessage.textContent = "Select exactly one vertex first.";
    return;
  }
  startVertex = selectedVertices[0];
  startVertexText.textContent = `Start vertex: ${graph.getVertex(startVertex)?.label ?? "?"}`;
  buildSteps();
});

useSelectedGoal.addEventListener("click", () => {
  if (selectedVertices.length !== 1) {
    algorithmMessage.textContent = "Select exactly one vertex first.";
    return;
  }
  goalVertex = selectedVertices[0];
  goalVertexText.textContent = `Goal vertex: ${graph.getVertex(goalVertex)?.label ?? "?"}`;
  buildSteps();
});

algorithmSelect.addEventListener("change", () => {
  stopPlayback();
  algorithmMessage.textContent = "Ready to run.";
  buildSteps();
});
previousStep.addEventListener("click", () => {
  stopPlayback(); if (!steps.length) buildSteps(); if (stepIndex > 0) stepIndex--; renderStep();
});
nextStep.addEventListener("click", () => {
  stopPlayback(); if (!steps.length) buildSteps(); if (stepIndex < steps.length - 1) stepIndex++; renderStep();
});
playPause.addEventListener("click", () => {
  if (!steps.length) buildSteps();
  if (!steps.length) return;
  if (timer !== null) { stopPlayback(); return; }
  if (stepIndex >= steps.length - 1) { stepIndex = 0; renderStep(); }
  scheduleNext();
});
window.addEventListener("keydown", event => {
  if (event.key === "Delete" || event.key === "Backspace") deleteSelectedButton.click();
});

renderPseudocode(currentPseudocode());
