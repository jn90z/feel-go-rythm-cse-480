export type TraversalOrder = "row-major" | "column-major";

export interface CacheLineState {
  line: number;
  block: number | null;
}

export interface CacheAccess {
  step: number;
  row: number;
  column: number;
  address: number;
  block: number;
  cacheLine: number;
  offset: number;
  hit: boolean;
  evictedBlock: number | null;
  hits: number;
  misses: number;
  cache: CacheLineState[];
}

export interface CacheSimulation {
  rows: number;
  columns: number;
  elementsPerLine: number;
  cacheLineCount: number;
  order: TraversalOrder;
  accesses: CacheAccess[];
  hits: number;
  misses: number;
  hitRate: number;
}

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min));

export function normalizeCacheConfig(rows: number, columns: number, elementsPerLine: number, cacheLineCount: number) {
  return {
    rows: clampInt(rows, 2, 8),
    columns: clampInt(columns, 2, 8),
    elementsPerLine: clampInt(elementsPerLine, 1, 8),
    cacheLineCount: clampInt(cacheLineCount, 1, 8)
  };
}

export function matrixAddress(row: number, column: number, columns: number): number {
  const safeColumns = clampInt(columns, 1, 8);
  const safeRow = clampInt(row, 0, 7);
  const safeColumn = clampInt(column, 0, safeColumns - 1);
  return safeRow * safeColumns + safeColumn;
}

export function traversalCoordinates(rows: number, columns: number, order: TraversalOrder): Array<{ row: number; column: number }> {
  const config = normalizeCacheConfig(rows, columns, 1, 1);
  const coordinates: Array<{ row: number; column: number }> = [];
  if (order === "column-major") {
    for (let column = 0; column < config.columns; column += 1) {
      for (let row = 0; row < config.rows; row += 1) coordinates.push({ row, column });
    }
    return coordinates;
  }
  for (let row = 0; row < config.rows; row += 1) {
    for (let column = 0; column < config.columns; column += 1) coordinates.push({ row, column });
  }
  return coordinates;
}

export function simulateCache(
  rows = 4,
  columns = 4,
  order: TraversalOrder = "row-major",
  elementsPerLine = 4,
  cacheLineCount = 4
): CacheSimulation {
  const config = normalizeCacheConfig(rows, columns, elementsPerLine, cacheLineCount);
  const tags: Array<number | null> = Array.from({ length: config.cacheLineCount }, () => null);
  const accesses: CacheAccess[] = [];
  let hits = 0;
  let misses = 0;

  traversalCoordinates(config.rows, config.columns, order).forEach(({ row, column }, step) => {
    const address = matrixAddress(row, column, config.columns);
    const block = Math.floor(address / config.elementsPerLine);
    const cacheLine = block % config.cacheLineCount;
    const offset = address % config.elementsPerLine;
    const previous = tags[cacheLine];
    const hit = previous === block;
    const evictedBlock = hit || previous === null ? null : previous;
    if (hit) hits += 1;
    else {
      misses += 1;
      tags[cacheLine] = block;
    }
    accesses.push({
      step,
      row,
      column,
      address,
      block,
      cacheLine,
      offset,
      hit,
      evictedBlock,
      hits,
      misses,
      cache: tags.map((tag, line) => ({ line, block: tag }))
    });
  });

  return {
    ...config,
    order,
    accesses,
    hits,
    misses,
    hitRate: accesses.length ? hits / accesses.length : 0
  };
}

export function compareTraversal(rows = 4, columns = 4, elementsPerLine = 4, cacheLineCount = 4) {
  return {
    rowMajor: simulateCache(rows, columns, "row-major", elementsPerLine, cacheLineCount),
    columnMajor: simulateCache(rows, columns, "column-major", elementsPerLine, cacheLineCount)
  };
}
