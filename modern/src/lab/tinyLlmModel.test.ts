import { describe, expect, it } from "vitest";
import { attentionFor, deterministicSample, nextTokenDistribution, softmax, tokenizeTiny } from "./tinyLlmModel";

describe("tiny LLM model", () => {
  it("tokenizes bounded text", () => {
    expect(tokenizeTiny("The cat sat on the mat.")).toEqual(["the", "cat", "sat", "on", "the", "mat", "."]);
    expect(tokenizeTiny("a ".repeat(100)).length).toBeLessThanOrEqual(32);
  });

  it("softmax probabilities sum to one", () => {
    const probabilities = softmax([1, 2, 3]);
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it("temperature changes distribution sharpness", () => {
    const cold = nextTokenDistribution("the cat sat on", 0.3);
    const hot = nextTokenDistribution("the cat sat on", 2.5);
    expect(Math.max(...cold.map(item => item.probability))).toBeGreaterThan(Math.max(...hot.map(item => item.probability)));
  });

  it("produces attention weights across all tokens", () => {
    const result = attentionFor("the robot needed power", 1);
    expect(result.tokens).toHaveLength(4);
    expect(result.weights).toHaveLength(4);
    expect(result.weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it("samples deterministically for teaching", () => {
    const distribution = nextTokenDistribution("the cat sat on", 1);
    expect(deterministicSample(distribution, 0)).toBe(distribution[0].token);
  });
});
