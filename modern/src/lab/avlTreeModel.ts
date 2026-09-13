export type RotationKind = "LL" | "RR" | "LR" | "RL";

export interface TreeNode {
  value: number;
  height: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

export interface RotationEvent {
  kind: RotationKind;
  inserted: number;
  pivot: number;
  message: string;
}

export interface TreeComparison {
  bst: TreeNode | null;
  avl: TreeNode | null;
  bstHeight: number;
  avlHeight: number;
  rotations: RotationEvent[];
  values: number[];
}

function node(value: number): TreeNode {
  return { value, height: 1, left: null, right: null };
}

export function treeHeight(root: TreeNode | null): number {
  return root?.height ?? 0;
}

function updateHeight(root: TreeNode): void {
  root.height = Math.max(treeHeight(root.left), treeHeight(root.right)) + 1;
}

function balanceFactor(root: TreeNode | null): number {
  return root ? treeHeight(root.left) - treeHeight(root.right) : 0;
}

function rotateRight(root: TreeNode): TreeNode {
  const nextRoot = root.left!;
  const transfer = nextRoot.right;
  nextRoot.right = root;
  root.left = transfer;
  updateHeight(root);
  updateHeight(nextRoot);
  return nextRoot;
}

function rotateLeft(root: TreeNode): TreeNode {
  const nextRoot = root.right!;
  const transfer = nextRoot.left;
  nextRoot.left = root;
  root.right = transfer;
  updateHeight(root);
  updateHeight(nextRoot);
  return nextRoot;
}

function insertBst(root: TreeNode | null, value: number): TreeNode {
  if (!root) return node(value);
  if (value < root.value) root.left = insertBst(root.left, value);
  else if (value > root.value) root.right = insertBst(root.right, value);
  updateHeight(root);
  return root;
}

function rotationMessage(kind: RotationKind, pivot: number, inserted: number): string {
  const direction = kind === "LL"
    ? "a right rotation"
    : kind === "RR"
      ? "a left rotation"
      : kind === "LR"
        ? "a left rotation on the child followed by a right rotation"
        : "a right rotation on the child followed by a left rotation";
  return `${kind} imbalance at ${pivot} after inserting ${inserted}; AVL restores balance with ${direction}.`;
}

function insertAvl(root: TreeNode | null, value: number, rotations: RotationEvent[]): TreeNode {
  if (!root) return node(value);

  if (value < root.value) root.left = insertAvl(root.left, value, rotations);
  else if (value > root.value) root.right = insertAvl(root.right, value, rotations);
  else return root;

  updateHeight(root);
  const balance = balanceFactor(root);

  if (balance > 1 && value < root.left!.value) {
    rotations.push({ kind: "LL", inserted: value, pivot: root.value, message: rotationMessage("LL", root.value, value) });
    return rotateRight(root);
  }
  if (balance < -1 && value > root.right!.value) {
    rotations.push({ kind: "RR", inserted: value, pivot: root.value, message: rotationMessage("RR", root.value, value) });
    return rotateLeft(root);
  }
  if (balance > 1 && value > root.left!.value) {
    rotations.push({ kind: "LR", inserted: value, pivot: root.value, message: rotationMessage("LR", root.value, value) });
    root.left = rotateLeft(root.left!);
    return rotateRight(root);
  }
  if (balance < -1 && value < root.right!.value) {
    rotations.push({ kind: "RL", inserted: value, pivot: root.value, message: rotationMessage("RL", root.value, value) });
    root.right = rotateRight(root.right!);
    return rotateLeft(root);
  }

  return root;
}

export function normalizeTreeSequence(values: number[]): number[] {
  const result: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const integer = Math.trunc(value);
    if (seen.has(integer)) continue;
    seen.add(integer);
    result.push(integer);
  }
  return result;
}

export function buildTreeComparison(input: number[]): TreeComparison {
  const values = normalizeTreeSequence(input);
  let bst: TreeNode | null = null;
  let avl: TreeNode | null = null;
  const rotations: RotationEvent[] = [];

  for (const value of values) {
    bst = insertBst(bst, value);
    avl = insertAvl(avl, value, rotations);
  }

  return {
    bst,
    avl,
    bstHeight: treeHeight(bst),
    avlHeight: treeHeight(avl),
    rotations,
    values
  };
}

export function inOrder(root: TreeNode | null): number[] {
  if (!root) return [];
  return [...inOrder(root.left), root.value, ...inOrder(root.right)];
}

export function searchDepth(root: TreeNode | null, target: number): number | null {
  let current = root;
  let comparisons = 0;
  while (current) {
    comparisons++;
    if (target === current.value) return comparisons;
    current = target < current.value ? current.left : current.right;
  }
  return null;
}
