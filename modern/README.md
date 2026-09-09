# Feel-go-Rythm 2.0

Modern rewrite of the original 2014 CSE-480 graph algorithm visualizer.

The legacy application remains untouched at the repository root. This folder is the new TypeScript/Babylon.js implementation.

## Current milestone

- Vite + TypeScript project
- Babylon.js 3D scene
- Independent graph data model
- Stable UUID vertex and edge identities
- Add vertices
- Connect the two most recently added vertices
- Clear graph
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
├── graph/
│   └── Graph.ts
├── visualization/
│   └── GraphScene.ts
├── main.ts
└── styles.css
```

The graph model intentionally has no Babylon.js dependencies. Rendering is handled separately so algorithms can operate against a clean graph data structure.

## Next milestone

The next editor pass should add direct vertex picking, drag-to-move behavior, explicit edge creation by selecting two vertices, edge/vertex deletion, labels, and synchronized edge updates while vertices move. After that, algorithm playback can be layered on top of the clean graph model.
