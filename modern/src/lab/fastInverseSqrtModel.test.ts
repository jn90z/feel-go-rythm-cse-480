import { describe, expect, it } from "vitest";
import { bits32, clampVectorComponent, fastInverseSqrt, normalizeVector } from "./fastInverseSqrtModel";

describe("fast inverse square root model", () => {
  it("approximates inverse square root accurately after Newton refinement", () => {
    const result = fastInverseSqrt(4);
    expect(result.exact).toBeCloseTo(0.5, 8);
    expect(result.oneIterationErrorPercent).toBeLessThan(0.2);
    expect(result.twoIterationErrorPercent).toBeLessThan(0.001);
  });

  it("normalizes a 3-4-5 vector", () => {
    const result = normalizeVector(3, 4);
    expect(result.lengthSquared).toBe(25);
    expect(result.length).toBe(5);
    expect(result.exact.x).toBeCloseTo(0.6, 8);
    expect(result.exact.y).toBeCloseTo(0.8, 8);
    expect(result.lengthErrorPercent).toBeLessThan(0.2);
    expect(result.angularErrorDegrees).toBeLessThan(0.001);
  });

  it("handles the zero vector safely", () => {
    const result = normalizeVector(0, 0);
    expect(result.exact).toEqual({ x: 0, y: 0 });
    expect(result.approximate).toEqual({ x: 0, y: 0 });
  });

  it("clamps non-finite and extreme vector components", () => {
    expect(clampVectorComponent(Number.NaN)).toBe(0);
    expect(clampVectorComponent(1000)).toBe(100);
    expect(clampVectorComponent(-1000)).toBe(-100);
  });

  it("renders bit patterns as exactly 32 bits", () => {
    expect(bits32(0)).toHaveLength(32);
    expect(bits32(0xffffffff)).toBe("11111111111111111111111111111111");
  });
});
