export interface TinyToken {
  text: string;
  embedding: [number, number, number];
}

export interface AttentionResult {
  tokens: string[];
  scores: number[];
  weights: number[];
}

export interface NextTokenCandidate {
  token: string;
  logit: number;
  probability: number;
}

const VOCAB: Record<string, [number, number, number]> = {
  the: [0.2, 0.1, 0.1], cat: [0.9, 0.3, 0.1], dog: [0.88, 0.28, 0.12], robot: [0.3, 0.9, 0.2], battery: [0.1, 0.85, 0.75], power: [0.08, 0.9, 0.8], sat: [0.6, 0.2, 0.2], on: [0.1, 0.2, 0.1], mat: [0.7, 0.2, 0.15], floor: [0.55, 0.16, 0.12], because: [0.05, 0.05, 0.05], it: [0.2, 0.35, 0.35], needed: [0.2, 0.55, 0.4], chased: [0.7, 0.22, 0.2]
};

const DEFAULT_EMBEDDING: [number, number, number] = [0.1, 0.1, 0.1];
const MAX_TEXT = 120;

export function tokenizeTiny(text: string): string[] {
  return Array.from(text).slice(0, MAX_TEXT).join("").toLowerCase().match(/[a-z0-9']+|[^\s\w]/g)?.slice(0, 32) ?? [];
}

export function embeddingFor(token: string): [number, number, number] {
  return VOCAB[token] ?? DEFAULT_EMBEDDING;
}

function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

export function softmax(values: readonly number[], temperature = 1): number[] {
  const safeT = Math.max(0.1, Math.min(3, Number.isFinite(temperature) ? temperature : 1));
  if (!values.length) return [];
  const scaled = values.map(value => value / safeT);
  const max = Math.max(...scaled);
  const exps = scaled.map(value => Math.exp(value - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map(value => value / total);
}

export function attentionFor(text: string, focusIndex: number): AttentionResult {
  const tokens = tokenizeTiny(text);
  if (!tokens.length) return { tokens: [], scores: [], weights: [] };
  const index = Math.max(0, Math.min(tokens.length - 1, Math.floor(Number.isFinite(focusIndex) ? focusIndex : 0)));
  const query = embeddingFor(tokens[index]);
  const scores = tokens.map(token => dot(query, embeddingFor(token)) / Math.sqrt(query.length));
  return { tokens, scores, weights: softmax(scores) };
}

export function nextTokenDistribution(context: string, temperature = 1): NextTokenCandidate[] {
  const tokens = tokenizeTiny(context);
  const last = tokens.at(-1) ?? "the";
  const base: Record<string, number> = last === "the"
    ? { cat: 3.3, dog: 3.1, robot: 2.4, mat: 1.4 }
    : last === "chased"
      ? { cat: 2.7, dog: 2.3, robot: 1.1, mat: 0.7 }
      : last === "on"
        ? { mat: 3.8, floor: 2.9, robot: 0.5, dog: 0.2 }
        : { the: 2.5, cat: 1.9, dog: 1.7, robot: 1.2, mat: 0.8 };
  const entries = Object.entries(base);
  const probabilities = softmax(entries.map(([, logit]) => logit), temperature);
  return entries.map(([token, logit], index) => ({ token, logit, probability: probabilities[index] }));
}

export function deterministicSample(candidates: readonly NextTokenCandidate[], sample = 0.42): string {
  const target = Math.max(0, Math.min(0.999999, Number.isFinite(sample) ? sample : 0.42));
  let cumulative = 0;
  for (const candidate of candidates) {
    cumulative += candidate.probability;
    if (target < cumulative) return candidate.token;
  }
  return candidates.at(-1)?.token ?? "";
}
