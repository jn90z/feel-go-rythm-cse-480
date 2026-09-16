export type BitWidth = 8 | 16 | 32;

export interface NumberSnapshot {
  width: BitWidth;
  raw: number;
  signed: number;
  unsigned: number;
  binary: string;
  hex: string;
  octal: string;
}

export function maskFor(width: BitWidth): number {
  return width === 32 ? 0xffffffff : (2 ** width) - 1;
}

export function normalizeRaw(value: number, width: BitWidth): number {
  return (Math.trunc(value) >>> 0) & maskFor(width);
}

export function signedValue(rawValue: number, width: BitWidth): number {
  const raw = normalizeRaw(rawValue, width);
  if (width === 32) return raw | 0;
  const sign = 2 ** (width - 1);
  return raw >= sign ? raw - 2 ** width : raw;
}

export function snapshot(value: number, width: BitWidth): NumberSnapshot {
  const raw = normalizeRaw(value, width);
  return {
    width,
    raw,
    unsigned: raw >>> 0,
    signed: signedValue(raw, width),
    binary: raw.toString(2).padStart(width, "0"),
    hex: raw.toString(16).toUpperCase().padStart(width / 4, "0"),
    octal: raw.toString(8)
  };
}

export function toggleBit(rawValue: number, width: BitWidth, bit: number): number {
  if (!Number.isInteger(bit) || bit < 0 || bit >= width) return normalizeRaw(rawValue, width);
  return normalizeRaw((normalizeRaw(rawValue, width) ^ (2 ** bit)), width);
}

export function parseInBase(text: string, base: number): number | null {
  const clean = text.trim().replaceAll("_", "").replace(/^0[xX]/, "").replace(/^0[bB]/, "").replace(/^0[oO]/, "");
  if (!clean || !Number.isInteger(base) || base < 2 || base > 36) return null;
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const allowed = alphabet.slice(0, base);
  if (![...clean.toLowerCase()].every(char => allowed.includes(char))) return null;
  const parsed = Number.parseInt(clean, base);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function positionalTerms(rawValue: number, width: BitWidth): { bit: number; power: number; value: number }[] {
  const raw = normalizeRaw(rawValue, width);
  return Array.from({ length: width }, (_, index) => width - 1 - index)
    .map(power => ({ bit: Math.floor(raw / 2 ** power) % 2, power, value: 2 ** power }))
    .filter(term => term.bit === 1);
}

export function addFixedWidth(aValue: number, bValue: number, width: BitWidth) {
  const a = normalizeRaw(aValue, width);
  const b = normalizeRaw(bValue, width);
  const full = a + b;
  const result = normalizeRaw(full, width);
  const carry = full >= 2 ** width;
  const sa = signedValue(a, width), sb = signedValue(b, width), sr = signedValue(result, width);
  const signedOverflow = (sa >= 0 && sb >= 0 && sr < 0) || (sa < 0 && sb < 0 && sr >= 0);
  return { a, b, result, carry, signedOverflow, signedA: sa, signedB: sb, signedResult: sr };
}
