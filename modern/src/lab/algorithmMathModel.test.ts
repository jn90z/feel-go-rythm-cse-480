import { describe, expect, it } from "vitest";
import { factorial, growthValue, hardwareEquivalentInput, harmonicIntegralApprox, harmonicSum, normalizeN, optimizeSplitParameter } from "./algorithmMathModel";

describe("algorithm math model", () => {
  it("normalizes unsafe input bounds", () => {
    expect(normalizeN(Number.NaN)).toBe(1);
    expect(normalizeN(-50)).toBe(1);
    expect(normalizeN(5000)).toBe(1000);
  });

  it("evaluates common growth classes", () => {
    expect(growthValue("constant", 16)).toBe(1);
    expect(growthValue("log", 16)).toBe(4);
    expect(growthValue("linear", 16)).toBe(16);
    expect(growthValue("nlogn", 16)).toBe(64);
    expect(growthValue("quadratic", 16)).toBe(256);
    expect(growthValue("exponential", 10)).toBe(1024);
    expect(growthValue("factorial", 5)).toBe(120);
    expect(factorial(0)).toBe(1);
  });

  it("shows that faster hardware helps slow growth classes much less", () => {
    const linear = hardwareEquivalentInput("linear", 100, 100);
    const quadratic = hardwareEquivalentInput("quadratic", 100, 100);
    const exponential = hardwareEquivalentInput("exponential", 20, 100);
    expect(linear).toBe(10_000);
    expect(quadratic).toBe(1_000);
    expect(exponential).toBe(26);
  });

  it("finds the calculus optimum for n/k + k", () => {
    const result = optimizeSplitParameter(100);
    expect(result.optimum).toBeCloseTo(10);
    expect(result.derivativeAtOptimum).toBeCloseTo(0);
    expect(result.cost).toBeCloseTo(20);
  });

  it("uses an integral to approximate harmonic growth", () => {
    const exact = harmonicSum(1000);
    const approximate = harmonicIntegralApprox(1000);
    expect(Math.abs(exact - approximate)).toBeLessThan(0.5);
    expect(exact).toBeGreaterThan(harmonicSum(100));
  });
});
