import { describe, expect, it } from "vitest";
import { buildTreeComparison, inOrder, normalizeTreeSequence, searchDepth } from "./avlTreeModel";

describe("AVL tree comparison model", () => {
  it.each([
    [[30, 20, 10], "LL", 20],
    [[10, 20, 30], "RR", 20],
    [[30, 10, 20], "LR", 20],
    [[10, 30, 20], "RL", 20]
  ] as const)("detects %s rotation", (sequence, kind, expectedRoot) => {
    const result = buildTreeComparison([...sequence]);
    expect(result.rotations.at(-1)?.kind).toBe(kind);
    expect(result.avl?.value).toBe(expectedRoot);
    expect(inOrder(result.avl)).toEqual([...sequence].sort((a, b) => a - b));
  });

  it("keeps a sorted insertion sequence shallow compared with a plain BST", () => {
    const sequence = Array.from({ length: 15 }, (_, index) => index + 1);
    const result = buildTreeComparison(sequence);

    expect(result.bstHeight).toBe(15);
    expect(result.avlHeight).toBeLessThanOrEqual(4);
    expect(inOrder(result.bst)).toEqual(sequence);
    expect(inOrder(result.avl)).toEqual(sequence);
  });

  it("shows fewer search comparisons in the balanced tree for a worst-case target", () => {
    const result = buildTreeComparison(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(searchDepth(result.bst, 15)).toBe(15);
    expect(searchDepth(result.avl, 15)).toBeLessThan(15);
  });

  it("normalizes duplicates and non-finite values", () => {
    expect(normalizeTreeSequence([4, 4, Number.NaN, 2, Number.POSITIVE_INFINITY, 2, 7.8])).toEqual([4, 2, 7]);
  });
});
