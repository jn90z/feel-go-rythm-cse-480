# Feel-go-Rythm 2.0

Modern rewrite of the original 2014 CSE-480 graph algorithm visualizer.

The legacy application remains untouched at the repository root. This folder is the new TypeScript/Babylon.js implementation.

## Current milestone

- Vite + TypeScript project
- Babylon.js 3D scene
- Stable UUID-based graph model
- Interactive vertex/edge selection
- Drag-to-move vertices with live edge geometry
- Visible vertex labels in the 3D scene
- Weighted edges with visible weight labels
- Editable edge weights
- Safe vertex/edge deletion
- BFS playback
- DFS playback
- Dijkstra playback
- Play / pause / previous / next controls
- Adjustable playback speed
- Live queue, stack, or open-set display
- Dijkstra tentative-distance display
- Vertex states: default, frontier, active, visited
- Synchronized pseudocode highlighting
- Responsive editor shell

## Run locally

```bash
cd modern
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

## Architecture

```text
src/
├── algorithms/
│   ├── AlgorithmStep.ts
│   ├── bfs.ts
│   ├── dfs.ts
│   └── dijkstra.ts
├── graph/
│   └── Graph.ts
├── visualization/
│   └── GraphScene.ts
├── main.ts
└── styles.css
```

The graph model has no Babylon.js dependencies. Algorithms operate only against graph data and emit playback frames. The renderer consumes those frames to update the 3D scene.

## Recommended next milestone

- Graph save/load and JSON import/export
- Automated tests for graph operations and algorithms
- Better edge-creation UX with persistent two-vertex highlighting
- Directed graph mode and arrowheads
- Destination selection and shortest-path highlighting for Dijkstra
- Optional A* pathfinding
