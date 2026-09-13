# Big Brain Interactive Computer Science Lab

Big Brain is an interactive computer-science learning environment built around visual, step-by-step demonstrations. The goal is not only to show the final answer, but to let students watch state change over time, compare strategies on identical inputs, and understand *why* an algorithm or system behaves the way it does.

The modern application lives in [`modern/`](modern/).

## What you can explore

The current learning lab includes interactive modules across several domains:

- **Algorithms** — sorting, searching, weighted pathfinding, graph-oriented demonstrations
- **Data structures** — stacks, queues, hashing, trees, BST vs AVL behavior
- **Operating systems** — CPU scheduling, virtual-memory page replacement, concurrency, race conditions and deadlocks
- **Networking** — reliable transport, packet loss, retransmission and sliding-window behavior
- **Programming & compilers** — recursion/call-stack exploration and a Compiler Explorer-style assembly lab

Many newer modules support stepping forward and backward, live metrics, comparisons, curated demonstrations, and explanations tied directly to the visualization.

## Run the web app

Requirements:

- Node.js 20+
- npm

```bash
cd modern
npm install
npm run dev
```

Vite will print the local development URL.

On Windows PowerShell, if script execution policy blocks `npm.ps1`, use:

```powershell
npm.cmd run dev
```

## Quality checks

From `modern/`:

```bash
npm test
npm run security:check
npm run build
npm audit --audit-level=high
```

The GitHub Actions web CI runs the same core security, test and production-build gates on pushes.

## Desktop build

The project also contains Tauri tooling:

```bash
cd modern
npm install
npm run desktop:dev
```

For a packaged desktop build, use `npm run desktop:build` after installing the platform prerequisites required by Tauri.

## Project structure

```text
modern/
  src/lab/        Interactive labs, models, tests and module registry
  scripts/        Repository security checks
  src-tauri/      Desktop wrapper
  index.html      Web entry point and browser security policy
```

The preferred architecture for new labs is:

1. Put deterministic simulation/algorithm behavior in a testable model file.
2. Add focused Vitest coverage for the model.
3. Build the visualization as a registered lab module.
4. Render untrusted or editable values through DOM APIs such as `textContent` rather than HTML interpolation.
5. Return cleanup callbacks for timers or global listeners.
6. Keep inputs bounded so a teaching demo cannot accidentally create runaway work.

## Learning-design direction

Big Brain is moving toward a consistent laboratory experience:

- useful default examples before random data
- **Previous / Play / Next** style trace navigation
- explicit visual cues for active, changed and finalized state
- side-by-side comparisons using the same input
- measured results kept separate from general Big-O theory
- concise explanations near the visualization
- challenge/prediction activities after worked examples
- progressive controls so first-time users are not overwhelmed

The long-term goal is a practical interactive CS laboratory that works directly in the browser with no student setup beyond opening the site.

## Security

The browser application intentionally avoids executing arbitrary user code locally. The Compiler Explorer lab sends source to the public Compiler Explorer service for compilation only and does not request execution. Client-visible Vite configuration must never contain secrets.

The project includes a repository security check and a restrictive Content Security Policy. Production hosting should additionally send equivalent or stronger security headers at the HTTP layer.
