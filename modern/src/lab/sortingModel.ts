export type SortAlgorithm = "bubble" | "selection" | "insertion" | "merge" | "quick" | "heap";

export interface SortStep {
  values: number[];
  active: number[];
  finalized: number[];
  comparisons: number;
  writes: number;
  message: string;
}

const indices = (start: number, endExclusive: number): number[] =>
  Array.from({ length: Math.max(0, endExclusive - start) }, (_, index) => start + index);

export function buildSortSteps(input: number[], algorithm: SortAlgorithm): SortStep[] {
  const a = [...input];
  const steps: SortStep[] = [];
  const finalized = new Set<number>();
  let comparisons = 0;
  let writes = 0;

  const push = (active: number[], message: string) => {
    steps.push({
      values: [...a],
      active: [...active],
      finalized: [...finalized].sort((left, right) => left - right),
      comparisons,
      writes,
      message
    });
  };

  push([], "Ready");

  if (algorithm === "bubble") {
    for (let end = a.length - 1; end > 0; end--) {
      for (let i = 0; i < end; i++) {
        comparisons++;
        push([i, i + 1], `Compare ${a[i]} and ${a[i + 1]}`);
        if (a[i] > a[i + 1]) {
          [a[i], a[i + 1]] = [a[i + 1], a[i]];
          writes += 2;
          push([i, i + 1], "Swap adjacent values");
        }
      }
      finalized.add(end);
      push([end], `Position ${end} is final: the largest remaining value bubbled here.`);
    }
    if (a.length) finalized.add(0);
  } else if (algorithm === "selection") {
    for (let i = 0; i < a.length - 1; i++) {
      let min = i;
      for (let j = i + 1; j < a.length; j++) {
        comparisons++;
        if (a[j] < a[min]) min = j;
        push([min, j], "Scan the unsorted region for its minimum.");
      }
      if (min !== i) {
        [a[i], a[min]] = [a[min], a[i]];
        writes += 2;
      }
      finalized.add(i);
      push([i], `Position ${i} is final: it now contains the smallest remaining value.`);
    }
    if (a.length) finalized.add(a.length - 1);
  } else if (algorithm === "insertion") {
    for (let i = 1; i < a.length; i++) {
      const key = a[i];
      let j = i - 1;
      while (j >= 0) {
        comparisons++;
        push([j, j + 1], `Compare ${key} with ${a[j]}`);
        if (a[j] <= key) break;
        a[j + 1] = a[j];
        writes++;
        j--;
      }
      a[j + 1] = key;
      writes++;
      push([j + 1], "Inserted into the sorted prefix, but later values may still shift this position.");
    }
  } else if (algorithm === "merge") {
    for (let width = 1; width < a.length; width *= 2) {
      for (let lo = 0; lo < a.length; lo += width * 2) {
        const mid = Math.min(lo + width, a.length);
        const hi = Math.min(lo + width * 2, a.length);
        const left = a.slice(lo, mid);
        const right = a.slice(mid, hi);
        let i = 0;
        let j = 0;
        let k = lo;
        const finalMerge = lo === 0 && hi === a.length && width * 2 >= a.length;

        while (i < left.length || j < right.length) {
          if (j >= right.length || (i < left.length && (++comparisons, left[i] <= right[j]))) {
            a[k] = left[i++];
          } else {
            a[k] = right[j++];
          }
          writes++;
          if (finalMerge) finalized.add(k);
          push(indices(lo, hi), finalMerge
            ? `Final merge wrote position ${k}; this value can no longer move.`
            : `Merge ranges ${lo}–${mid - 1} and ${mid}–${hi - 1}.`);
          k++;
        }
      }
    }
  } else if (algorithm === "quick") {
    const quick = (lo: number, hi: number): void => {
      if (lo > hi) return;
      if (lo === hi) {
        finalized.add(lo);
        push([lo], `Position ${lo} is final: this partition contains one value.`);
        return;
      }

      const pivot = a[hi];
      let i = lo;
      for (let j = lo; j < hi; j++) {
        comparisons++;
        push([j, hi], `Compare ${a[j]} with pivot ${pivot}.`);
        if (a[j] <= pivot) {
          if (i !== j) {
            [a[i], a[j]] = [a[j], a[i]];
            writes += 2;
          }
          i++;
        }
      }
      if (i !== hi) {
        [a[i], a[hi]] = [a[hi], a[i]];
        writes += 2;
      }
      finalized.add(i);
      push([i], `Pivot ${pivot} is final at position ${i}.`);
      quick(lo, i - 1);
      quick(i + 1, hi);
    };
    quick(0, a.length - 1);
  } else {
    const heapify = (n: number, root: number): void => {
      let i = root;
      while (true) {
        let largest = i;
        const left = i * 2 + 1;
        const right = left + 1;
        if (left < n) {
          comparisons++;
          if (a[left] > a[largest]) largest = left;
        }
        if (right < n) {
          comparisons++;
          if (a[right] > a[largest]) largest = right;
        }
        if (largest === i) break;
        [a[i], a[largest]] = [a[largest], a[i]];
        writes += 2;
        push([i, largest], "Restore the max-heap property.");
        i = largest;
      }
    };

    for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) heapify(a.length, i);
    for (let end = a.length - 1; end > 0; end--) {
      [a[0], a[end]] = [a[end], a[0]];
      writes += 2;
      finalized.add(end);
      push([0, end], `Position ${end} is final: the heap maximum was extracted here.`);
      heapify(end, 0);
    }
    if (a.length) finalized.add(0);
  }

  for (let i = 0; i < a.length; i++) finalized.add(i);
  push([], "Sorted — every position is final.");
  return steps;
}
