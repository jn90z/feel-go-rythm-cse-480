import { describe, expect, it } from "vitest";
import { DATASETS, accuracy, binaryCrossEntropy, decisionBoundaryY, predict, sigmoid, trainNetwork, trainOneEpoch } from "./neuralNetworkModel";

describe("neural network training model", () => {
  it("computes stable sigmoid values", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5);
    expect(sigmoid(20)).toBeGreaterThan(0.999);
    expect(sigmoid(-20)).toBeLessThan(0.001);
  });

  it("predicts from a linear neuron", () => {
    const result = predict({ x: 1, y: 1 }, { w1: 2, w2: 1, bias: -1 });
    expect(result.logit).toBe(2);
    expect(result.probability).toBeGreaterThan(0.8);
    expect(result.predicted).toBe(1);
  });

  it("reduces loss on the diagonal dataset", () => {
    const snapshots = trainNetwork(DATASETS.diagonal, 120, 0.2);
    expect(snapshots.at(-1)!.loss).toBeLessThan(snapshots[0].loss);
    expect(snapshots.at(-1)!.accuracy).toBeGreaterThanOrEqual(0.875);
  });

  it("bounds epochs and learning rate", () => {
    expect(trainNetwork(DATASETS.diagonal, 9999, 0.2)).toHaveLength(501);
    const next = trainOneEpoch(DATASETS.diagonal, { w1: 0, w2: 0, bias: 0 }, 999);
    expect(Number.isFinite(next.w1)).toBe(true);
    expect(Number.isFinite(next.w2)).toBe(true);
    expect(Number.isFinite(next.bias)).toBe(true);
  });

  it("reports loss and accuracy safely for empty datasets", () => {
    expect(binaryCrossEntropy([], { w1: 1, w2: 1, bias: 0 })).toBe(0);
    expect(accuracy([], { w1: 1, w2: 1, bias: 0 })).toBe(0);
  });

  it("computes a decision boundary when possible", () => {
    expect(decisionBoundaryY(0, { w1: 1, w2: 1, bias: -2 })).toBeCloseTo(2);
    expect(decisionBoundaryY(0, { w1: 1, w2: 0, bias: -2 })).toBeNull();
  });
});
