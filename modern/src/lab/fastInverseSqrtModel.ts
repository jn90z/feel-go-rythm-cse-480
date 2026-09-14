export interface FastInverseSqrtResult {
  input: number;
  exact: number;
  inputBits: number;
  shiftedBits: number;
  guessBits: number;
  initialGuess: number;
  afterOneNewton: number;
  afterTwoNewton: number;
  oneIterationErrorPercent: number;
  twoIterationErrorPercent: number;
}

export interface VectorNormalizationResult {
  x: number;
  y: number;
  lengthSquared: number;
  length: number;
  exactInverseLength: number;
  approximateInverseLength: number;
  exact: { x: number; y: number };
  approximate: { x: number; y: number };
  angularErrorDegrees: number;
  lengthErrorPercent: number;
}

const MAGIC = 0x5f3759df;
const buffer = new ArrayBuffer(4);
const view = new DataView(buffer);

function toFloat32(value: number): number {
  return Math.fround(value);
}

function floatToBits(value: number): number {
  view.setFloat32(0, toFloat32(value), true);
  return view.getUint32(0, true);
}

function bitsToFloat(bits: number): number {
  view.setUint32(0, bits >>> 0, true);
  return view.getFloat32(0, true);
}

export function clampVectorComponent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-100, Math.min(100, value));
}

export function fastInverseSqrt(value: number): FastInverseSqrtResult {
  const input = Math.max(Number.MIN_VALUE, Math.min(1e12, Number.isFinite(value) && value > 0 ? value : 1));
  const x = toFloat32(input);
  const inputBits = floatToBits(x);
  const shiftedBits = inputBits >>> 1;
  const guessBits = (MAGIC - shiftedBits) >>> 0;
  const initialGuess = bitsToFloat(guessBits);
  const xHalf = toFloat32(0.5 * x);
  const afterOneNewton = toFloat32(initialGuess * (1.5 - xHalf * initialGuess * initialGuess));
  const afterTwoNewton = toFloat32(afterOneNewton * (1.5 - xHalf * afterOneNewton * afterOneNewton));
  const exact = 1 / Math.sqrt(x);
  return {
    input: x,
    exact,
    inputBits,
    shiftedBits,
    guessBits,
    initialGuess,
    afterOneNewton,
    afterTwoNewton,
    oneIterationErrorPercent: Math.abs((afterOneNewton - exact) / exact) * 100,
    twoIterationErrorPercent: Math.abs((afterTwoNewton - exact) / exact) * 100
  };
}

export function normalizeVector(xValue: number, yValue: number): VectorNormalizationResult {
  const x = clampVectorComponent(xValue);
  const y = clampVectorComponent(yValue);
  const lengthSquared = x * x + y * y;
  if (lengthSquared === 0) {
    return {
      x, y, lengthSquared: 0, length: 0, exactInverseLength: 0, approximateInverseLength: 0,
      exact: { x: 0, y: 0 }, approximate: { x: 0, y: 0 }, angularErrorDegrees: 0, lengthErrorPercent: 0
    };
  }
  const length = Math.sqrt(lengthSquared);
  const exactInverseLength = 1 / length;
  const approximateInverseLength = fastInverseSqrt(lengthSquared).afterOneNewton;
  const exact = { x: x * exactInverseLength, y: y * exactInverseLength };
  const approximate = { x: x * approximateInverseLength, y: y * approximateInverseLength };
  const approximateLength = Math.hypot(approximate.x, approximate.y);
  const dot = exact.x * approximate.x + exact.y * approximate.y;
  const denom = Math.max(Number.EPSILON, Math.hypot(exact.x, exact.y) * approximateLength);
  const angularErrorDegrees = Math.acos(Math.max(-1, Math.min(1, dot / denom))) * 180 / Math.PI;
  return {
    x, y, lengthSquared, length, exactInverseLength, approximateInverseLength, exact, approximate,
    angularErrorDegrees,
    lengthErrorPercent: Math.abs(approximateLength - 1) * 100
  };
}

export function bits32(value: number): string {
  return (value >>> 0).toString(2).padStart(32, "0");
}

export const FAST_INV_SQRT_MAGIC = MAGIC;
