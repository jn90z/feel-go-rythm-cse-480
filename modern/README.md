# Feel-go-Rythm 2.0

Modern rewrite of the original 2014 CSE-480 graph algorithm visualizer.

The legacy application remains untouched at the repository root. This folder is the new TypeScript/Babylon.js implementation.

## Current milestone

- Vite + TypeScript project
- Babylon.js 3D scene
- Independent graph data model with stable UUID identities
- Interactive vertex and edge selection
- Drag-to-move vertices with live edge geometry
- Safe vertex/edge deletion
- BFS and DFS implementations
- Step-by-step algorithm playback
- Play / pause / previous / next controls
- Adjustable playback speed
- Live queue or stack display
- Algorithm vertex states: default, frontier, active, visited
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
│   └── dfs.ts
├── graph/
│   └── Graph.ts
├── visualization/
│   └── GraphScene.ts
├── main.ts
└── styles.css
```

The graph model has no Babylon.js dependencies. Algorithms operate only against the graph data structure and emit immutable-style playback frames. The renderer consumes those frames to update the 3D scene, which keeps algorithm correctness separate from visualization.

## Next milestone

Recommended next work:

1. Render vertex labels directly in the 3D scene.
2. Preserve multi-vertex visual selection when creating edges.
3. Add weighted edges and editable edge weights.
4. Implement Dijkstra using the same playback-frame architecture.
5. Add graph save/load and JSON import/export.
6. Add automated unit tests for graph mutations, BFS, and DFS.
