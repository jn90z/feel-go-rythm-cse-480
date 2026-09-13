import "./avlTreeLab.css";
import { registerLabModule } from "./moduleRegistry";
import { buildTreeComparison, searchDepth, type TreeNode } from "./avlTreeModel";

const DEFAULT_SEQUENCE = [10, 20, 30, 40, 50, 25];

function parseSequence(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map(value => Number(value))
    .filter(Number.isFinite)
    .map(Math.trunc)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 31);
}

interface PositionedNode {
  node: TreeNode;
  x: number;
  y: number;
}

function treeSvg(root: TreeNode | null, recent: number | null): string {
  if (!root) return `<div class="avl-tree-svg" role="img" aria-label="Empty tree"></div>`;

  const ordered: Array<{ node: TreeNode; depth: number }> = [];
  const visit = (node: TreeNode | null, depth: number): void => {
    if (!node) return;
    visit(node.left, depth + 1);
    ordered.push({ node, depth });
    visit(node.right, depth + 1);
  };
  visit(root, 0);

  const width = Math.max(620, ordered.length * 68);
  const height = Math.max(280, root.height * 76 + 34);
  const xStep = width / (ordered.length + 1);
  const positioned: PositionedNode[] = ordered.map((entry, index) => ({
    node: entry.node,
    x: xStep * (index + 1),
    y: entry.depth * 72 + 42
  }));
  const byNode = new Map(positioned.map(item => [item.node, item]));
  const edges: string[] = [];

  for (const item of positioned) {
    for (const child of [item.node.left, item.node.right]) {
      if (!child) continue;
      const target = byNode.get(child)!;
      edges.push(`<line class="edge" x1="${item.x}" y1="${item.y}" x2="${target.x}" y2="${target.y}" />`);
    }
  }

  const nodes = positioned.map(item => `
    <g>
      <circle class="node ${item.node.value === recent ? "recent" : ""}" cx="${item.x}" cy="${item.y}" r="23" />
      <text x="${item.x}" y="${item.y}">${item.node.value}</text>
    </g>`).join("");

  return `<svg class="avl-tree-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Tree with ${ordered.length} nodes">${edges.join("")}${nodes}</svg>`;
}

registerLabModule({
  id: "avl-trees",
  icon: "⚖︎",
  title: "BST vs AVL Trees",
  description: "Insert the same values into a plain BST and a self-balancing AVL tree. Watch LL, RR, LR and RL rotations keep search depth under control.",
  featured: true,
  render(host) {
    host.innerHTML = `
      <div class="avl-lab">
        <div class="avl-controls">
          <label>Insertion sequence
            <input data-avl-sequence value="${DEFAULT_SEQUENCE.join(", ")}" aria-label="Tree insertion sequence" />
          </label>
          <label>Search target
            <input data-avl-target type="number" value="50" aria-label="Search target" />
          </label>
          <button type="button" data-avl-load>Load</button>
          <button type="button" data-avl-prev>Previous</button>
          <button type="button" data-avl-next>Next</button>
          <button type="button" data-avl-play>Play</button>
          <button type="button" data-avl-worst>Worst-case BST Demo</button>
        </div>
        <div class="avl-legend">
          <span>Orange = newest insertion</span>
          <span>BST never rotates</span>
          <span>AVL keeps every node's balance factor within -1…1</span>
        </div>
        <div class="avl-metrics" data-avl-metrics aria-live="polite"></div>
        <div class="avl-compare-grid">
          <section class="avl-tree-card">
            <h3>Plain Binary Search Tree</h3>
            <p>Insertion order determines shape.</p>
            <div data-avl-bst></div>
          </section>
          <section class="avl-tree-card">
            <h3>AVL Tree</h3>
            <p>Rotations preserve BST ordering while controlling height.</p>
            <div data-avl-balanced></div>
          </section>
        </div>
        <div class="avl-explanation" data-avl-explain aria-live="polite"></div>
        <section class="avl-tree-card">
          <h3>Rotation log</h3>
          <div class="avl-rotation-log" data-avl-log></div>
        </section>
      </div>`;

    const sequenceInput = host.querySelector<HTMLInputElement>("[data-avl-sequence]")!;
    const targetInput = host.querySelector<HTMLInputElement>("[data-avl-target]")!;
    const bstHost = host.querySelector<HTMLElement>("[data-avl-bst]")!;
    const avlHost = host.querySelector<HTMLElement>("[data-avl-balanced]")!;
    const metrics = host.querySelector<HTMLElement>("[data-avl-metrics]")!;
    const explanation = host.querySelector<HTMLElement>("[data-avl-explain]")!;
    const log = host.querySelector<HTMLElement>("[data-avl-log]")!;
    const playButton = host.querySelector<HTMLButtonElement>("[data-avl-play]")!;

    let sequence = [...DEFAULT_SEQUENCE];
    let index = sequence.length;
    let timer: number | null = null;

    const stop = (): void => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      playButton.textContent = "Play";
    };

    const render = (): void => {
      const prefix = sequence.slice(0, index);
      const comparison = buildTreeComparison(prefix);
      const previous = buildTreeComparison(sequence.slice(0, Math.max(0, index - 1)));
      const recent = index > 0 ? sequence[index - 1] : null;
      const target = Number(targetInput.value);
      const bstDepth = Number.isFinite(target) ? searchDepth(comparison.bst, target) : null;
      const avlDepth = Number.isFinite(target) ? searchDepth(comparison.avl, target) : null;

      bstHost.innerHTML = treeSvg(comparison.bst, recent);
      avlHost.innerHTML = treeSvg(comparison.avl, recent);
      metrics.innerHTML = `
        <span>Inserted: ${index} / ${sequence.length}</span>
        <span>BST height: ${comparison.bstHeight}</span>
        <span>AVL height: ${comparison.avlHeight}</span>
        <span>BST search comparisons: ${bstDepth ?? "not found"}</span>
        <span>AVL search comparisons: ${avlDepth ?? "not found"}</span>`;

      const newRotations = comparison.rotations.slice(previous.rotations.length);
      if (index === 0) {
        explanation.textContent = "Start with two empty trees. Step forward to insert the same value into both structures.";
      } else if (newRotations.length) {
        explanation.textContent = `Why did that happen? ${newRotations.map(rotation => rotation.message).join(" ")} The in-order value sequence remains unchanged; only the tree shape changes.`;
      } else {
        explanation.textContent = `Inserted ${recent}. The AVL balance factors are still within -1 to 1, so no rotation is needed. The plain BST also inserts the value but never repairs a skewed shape.`;
      }

      log.innerHTML = comparison.rotations.length
        ? comparison.rotations.map((rotation, rotationIndex) => `<div><strong>${rotationIndex + 1}. ${rotation.kind}</strong> · ${rotation.message}</div>`).join("")
        : `<div>No AVL rotations yet.</div>`;
    };

    const load = (values: number[], startAtEnd = false): void => {
      stop();
      sequence = values.length ? values : [...DEFAULT_SEQUENCE];
      sequenceInput.value = sequence.join(", ");
      index = startAtEnd ? sequence.length : 0;
      render();
    };

    host.querySelector("[data-avl-load]")!.addEventListener("click", () => load(parseSequence(sequenceInput.value)));
    host.querySelector("[data-avl-prev]")!.addEventListener("click", () => {
      stop();
      index = Math.max(0, index - 1);
      render();
    });
    host.querySelector("[data-avl-next]")!.addEventListener("click", () => {
      stop();
      index = Math.min(sequence.length, index + 1);
      render();
    });
    playButton.addEventListener("click", () => {
      if (timer !== null) return stop();
      if (index >= sequence.length) index = 0;
      render();
      playButton.textContent = "Pause";
      timer = window.setInterval(() => {
        if (index >= sequence.length) return stop();
        index++;
        render();
        if (index >= sequence.length) stop();
      }, 700);
    });
    host.querySelector("[data-avl-worst]")!.addEventListener("click", () => {
      targetInput.value = "15";
      load(Array.from({ length: 15 }, (_, offset) => offset + 1), true);
      explanation.textContent = "Worst-case BST demo loaded: sorted insertion collapses the plain BST into a chain, while AVL rotations keep the same values in a shallow balanced tree.";
    });
    targetInput.addEventListener("input", render);

    render();
    return stop;
  }
});
