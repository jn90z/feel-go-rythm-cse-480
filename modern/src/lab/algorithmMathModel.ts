export type GrowthId = "constant" | "log" | "linear" | "nlogn" | "quadratic" | "exponential" | "factorial";

export interface GrowthFunction {
  id: GrowthId;
  label: string;
  notation: string;
  evaluate: (n: number) => number;
}

export const GROWTH_FUNCTIONS: readonly GrowthFunction[] = [
  { id: "constant", label: "Constant", notation: "O(1)", evaluate: () => 1 },
  { id: "log", label: "Logarithmic", notation: "O(log n)", evaluate: n => Math.log2(Math.max(1, n)) },
  { id: "linear", label: "Linear", notation: "O(n)", evaluate: n => n },
  { id: "nlogn", label: "Linearithmic", notation: "O(n log n)", evaluate: n => n * Math.log2(Math.max(1, n)) },
  { id: "quadratic", label: "Quadratic", notation: "O(n²)", evaluate: n => n * n },
  { id: "exponential", label: "Exponential", notation: "O(2ⁿ)", evaluate: n => 2 ** Math.min(1023, n) },
  { id: "factorial", label: "Factorial", notation: "O(n!)", evaluate: n => factorial(n) }
];

export function normalizeN(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(1000, Math.floor(value)));
}

export function factorial(value: number): number {
  const n = Math.max(0, Math.min(170, Math.floor(Number.isFinite(value) ? value : 0)));
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

export function growthValue(id: GrowthId, value: number): number {
  const n = normalizeN(value);
  return GROWTH_FUNCTIONS.find(item => item.id === id)!.evaluate(n);
}

export function hardwareEquivalentInput(id: GrowthId, baselineN: number, speedup: number): number {
  const n = normalizeN(baselineN);
  const multiplier = Math.max(1, Math.min(1_000_000, Number.isFinite(speedup) ? speedup : 1));
  const budget = growthValue(id, n) * multiplier;
  let low = n;
  let high = n;
  while (high < 1_000_000 && finiteGrowthValue(id, high) <= budget) high = Math.min(1_000_000, high * 2);
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (finiteGrowthValue(id, mid) <= budget) low = mid;
    else high = mid;
  }
  return finiteGrowthValue(id, high) <= budget ? high : low;
}

function finiteGrowthValue(id: GrowthId, n: number): number {
  if (id === "factorial") return n > 170 ? Number.POSITIVE_INFINITY : factorial(n);
  if (id === "exponential") return n > 1023 ? Number.POSITIVE_INFINITY : 2 ** n;
  const fn = GROWTH_FUNCTIONS.find(item => item.id === id)!;
  return fn.evaluate(n);
}

export interface ParameterOptimization {
  n: number;
  optimum: number;
  derivativeAtOptimum: number;
  cost: number;
}

export function optimizeSplitParameter(value: number): ParameterOptimization {
  const n = normalizeN(value);
  const optimum = Math.sqrt(n);
  return {
    n,
    optimum,
    derivativeAtOptimum: -n / (optimum * optimum) + 1,
    cost: n / optimum + optimum
  };
}

export function harmonicSum(value: number): number {
  const n = normalizeN(value);
  let sum = 0;
  for (let k = 1; k <= n; k++) sum += 1 / k;
  return sum;
}

export function harmonicIntegralApprox(value: number): number {
  const n = normalizeN(value);
  return 1 + Math.log(n);
}
