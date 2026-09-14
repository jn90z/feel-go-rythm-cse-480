export interface Point2D {
  x: number;
  y: number;
  label: 0 | 1;
}

export interface NetworkWeights {
  w1: number;
  w2: number;
  bias: number;
}

export interface TrainingSnapshot {
  epoch: number;
  loss: number;
  accuracy: number;
  weights: NetworkWeights;
}

export interface Prediction {
  logit: number;
  probability: number;
  predicted: 0 | 1;
}

export interface GradientBreakdown {
  probability: number;
  error: number;
  loss: number;
  dw1: number;
  dw2: number;
  db: number;
}

export const DATASETS: Record<string, readonly Point2D[]> = {
  diagonal: [
    { x: -2.4, y: -1.8, label: 0 }, { x: -1.8, y: -1.3, label: 0 }, { x: -1.2, y: -1.9, label: 0 },
    { x: -0.8, y: -0.6, label: 0 }, { x: 0.7, y: 1.0, label: 1 }, { x: 1.2, y: 1.7, label: 1 },
    { x: 1.8, y: 1.1, label: 1 }, { x: 2.4, y: 2.1, label: 1 }
  ],
  noisy: [
    { x: -2.2, y: -1.5, label: 0 }, { x: -1.7, y: -0.8, label: 0 }, { x: -1.2, y: -1.9, label: 0 },
    { x: -0.5, y: 0.7, label: 1 }, { x: 0.3, y: -0.4, label: 0 }, { x: 0.8, y: 1.6, label: 1 },
    { x: 1.5, y: 0.6, label: 1 }, { x: 2.0, y: 1.9, label: 1 }, { x: 2.4, y: 0.2, label: 1 }
  ]
};

export function sigmoid(value: number): number {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

export function predict(point: Pick<Point2D, "x" | "y">, weights: NetworkWeights): Prediction {
  const logit = weights.w1 * point.x + weights.w2 * point.y + weights.bias;
  const probability = sigmoid(logit);
  return { logit, probability, predicted: probability >= 0.5 ? 1 : 0 };
}

function pointLoss(label: 0 | 1, probability: number): number {
  const p = Math.min(1 - 1e-9, Math.max(1e-9, probability));
  return -(label * Math.log(p) + (1 - label) * Math.log(1 - p));
}

export function pointGradient(point: Point2D, weights: NetworkWeights): GradientBreakdown {
  const probability = predict(point, weights).probability;
  const error = probability - point.label;
  return {
    probability,
    error,
    loss: pointLoss(point.label, probability),
    dw1: error * point.x,
    dw2: error * point.y,
    db: error
  };
}

export function batchGradient(points: readonly Point2D[], weights: NetworkWeights): GradientBreakdown {
  if (!points.length) return { probability: 0, error: 0, loss: 0, dw1: 0, dw2: 0, db: 0 };
  let probability = 0;
  let error = 0;
  let loss = 0;
  let dw1 = 0;
  let dw2 = 0;
  let db = 0;
  for (const point of points) {
    const gradient = pointGradient(point, weights);
    probability += gradient.probability;
    error += gradient.error;
    loss += gradient.loss;
    dw1 += gradient.dw1;
    dw2 += gradient.dw2;
    db += gradient.db;
  }
  const scale = 1 / points.length;
  return {
    probability: probability * scale,
    error: error * scale,
    loss: loss * scale,
    dw1: dw1 * scale,
    dw2: dw2 * scale,
    db: db * scale
  };
}

export function binaryCrossEntropy(points: readonly Point2D[], weights: NetworkWeights): number {
  return batchGradient(points, weights).loss;
}

export function accuracy(points: readonly Point2D[], weights: NetworkWeights): number {
  if (!points.length) return 0;
  return points.filter(point => predict(point, weights).predicted === point.label).length / points.length;
}

export function trainOneEpoch(points: readonly Point2D[], weights: NetworkWeights, learningRate: number): NetworkWeights {
  if (!points.length) return { ...weights };
  const lr = Math.max(0.001, Math.min(5, Number.isFinite(learningRate) ? learningRate : 0.1));
  const gradient = batchGradient(points, weights);
  return {
    w1: weights.w1 - lr * gradient.dw1,
    w2: weights.w2 - lr * gradient.dw2,
    bias: weights.bias - lr * gradient.db
  };
}

export function trainNetwork(points: readonly Point2D[], epochs: number, learningRate: number, initial: NetworkWeights = { w1: -0.4, w2: 0.2, bias: 0.3 }): TrainingSnapshot[] {
  const count = Math.max(0, Math.min(500, Math.floor(Number.isFinite(epochs) ? epochs : 0)));
  const snapshots: TrainingSnapshot[] = [];
  let weights = { ...initial };
  snapshots.push({ epoch: 0, loss: binaryCrossEntropy(points, weights), accuracy: accuracy(points, weights), weights: { ...weights } });
  for (let epoch = 1; epoch <= count; epoch++) {
    weights = trainOneEpoch(points, weights, learningRate);
    snapshots.push({ epoch, loss: binaryCrossEntropy(points, weights), accuracy: accuracy(points, weights), weights: { ...weights } });
  }
  return snapshots;
}

export function decisionBoundaryY(x: number, weights: NetworkWeights): number | null {
  if (Math.abs(weights.w2) < 1e-8) return null;
  return -(weights.w1 * x + weights.bias) / weights.w2;
}
