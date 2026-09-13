import "./sortingLab.css";
import { registerLabModule, type LabModuleCleanup } from "./moduleRegistry";
import {
  buildSortComparison,
  buildSortSteps,
  type SortAlgorithm,
  type SortComparisonEntry,
  type SortStep
} from "./sortingModel";
import {
  explainWorkWinner,
  getSortLearningProfile,
  rankSortWork,
  type SortWorkRanking
} from "./sortingLearning";

const ALGORITHMS: Array<{ value: SortAlgorithm; label: string }> = [
  { value: "bubble", label: "Bubble" },
  { value: "selection", label: "Selection" },
  { value: "insertion", label: "Insertion" },
  { value: "merge", label: "Merge" },
  { value: "quick", label: "Quick" },
  { value: "heap", label: "Heap" }
];

const labelFor = (algorithm: SortAlgorithm): string =>
  ALGORITHMS.find(item => item.value === algorithm)?.label ?? algorithm;

function shuffle(count: number): number[] {
  const values = Array.from({ length: count }, (_, index) => index + 1);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function clampCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(6, Math.min(60, parsed)) : 24;
}

function renderBars(container: HTMLElement, step: SortStep, compact = false): void {
  container.replaceChildren();
  const max = Math.max(1, ...step.values);
  step.values.forEach((value, index) => {
    const bar = document.createElement("div");
    bar.className = compact ? "sorting-mini-bar" : "sorting-bar";
    if (step.finalized.includes(index)) bar.classList.add("finalized");
    else if (step.active.includes(index)) bar.classList.add("active");
    bar.style.height = `${Math.max(5, value / max * (compact ? 100 : 94))}%`;
    bar.setAttribute("aria-label", `${value}${step.finalized.includes(index) ? ", final position" : ""}`);
    if (!compact && step.values.length <= 30) {
      const label = document.createElement("span");
      label.textContent = String(value);
      bar.append(label);
    }
    container.append(bar);
  });
}

function appendCell(row: HTMLTableRowElement, text: string, best = false): void {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (best) cell.classList.add("best");
  row.append(cell);
}

function renderComparisonSummary(
  container: HTMLElement,
  entries: SortComparisonEntry[],
  elapsedMs: Map<SortAlgorithm, number>
): void {
  container.replaceChildren();
  if (!entries.length) return;

  const ranking = rankSortWork(entries);
  const rankingByAlgorithm = new Map<SortAlgorithm, SortWorkRanking>(ranking.map(item => [item.entry.algorithm, item]));
  const winner = document.createElement("div");
  winner.className = "sorting-winner";
  const winnerTitle = document.createElement("strong");
  winnerTitle.textContent = "🏆 Overall winner for this input";
  const winnerText = document.createElement("p");
  winnerText.textContent = explainWorkWinner(ranking).replace(/\b(bubble|selection|insertion|merge|quick|heap)\b/g, name => `${labelFor(name as SortAlgorithm)} Sort`);
  winner.append(winnerTitle, winnerText);

  const timingNote = document.createElement("p");
  timingNote.className = "lab-note sorting-timing-note";
  timingNote.textContent = "Race time is visualization time: how long each animated trace took to reach its final step at the current playback rate. It is useful for seeing relative trace length, but it is not a CPU benchmark. Big-O describes how algorithmic work grows as n grows.";

  const minComparisons = Math.min(...entries.map(entry => entry.comparisons));
  const minWrites = Math.min(...entries.map(entry => entry.writes));
  const minSteps = Math.min(...entries.map(entry => entry.totalSteps));
  const finiteTimes = entries.map(entry => elapsedMs.get(entry.algorithm)).filter((value): value is number => Number.isFinite(value));
  const minTime = finiteTimes.length ? Math.min(...finiteTimes) : Infinity;

  const tableWrap = document.createElement("div");
  tableWrap.className = "sorting-summary-scroll";
  const table = document.createElement("table");
  table.className = "sorting-summary-table sorting-results-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Algorithm", "Work score", "Comparisons", "Writes", "Steps", "Race time", "Avg Big-O", "Worst Big-O", "Space"].forEach(text => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = text;
    headRow.append(cell);
  });
  head.append(headRow);
  const body = document.createElement("tbody");

  entries.forEach(entry => {
    const profile = getSortLearningProfile(entry.algorithm);
    const work = rankingByAlgorithm.get(entry.algorithm)!;
    const time = elapsedMs.get(entry.algorithm);
    const row = document.createElement("tr");
    if (work.winner) row.classList.add("winner-row");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = `${labelFor(entry.algorithm)}${work.winner ? " 🏆" : ""}`;
    row.append(name);
    appendCell(row, String(work.workScore), work.winner);
    appendCell(row, String(entry.comparisons), entry.comparisons === minComparisons);
    appendCell(row, String(entry.writes), entry.writes === minWrites);
    appendCell(row, String(entry.totalSteps), entry.totalSteps === minSteps);
    appendCell(row, Number.isFinite(time) ? `${time!.toFixed(0)} ms` : "—", time === minTime);
    appendCell(row, profile.averageTime);
    appendCell(row, profile.worstTime);
    appendCell(row, profile.space);
    body.append(row);
  });

  table.append(head, body);
  tableWrap.append(table);

  const lessonHeading = document.createElement("strong");
  lessonHeading.textContent = "Algorithm learning cards";
  const cards = document.createElement("div");
  cards.className = "sorting-learning-grid";
  entries.forEach(entry => {
    const profile = getSortLearningProfile(entry.algorithm);
    const card = document.createElement("article");
    card.className = "sorting-learning-card";
    const title = document.createElement("h4");
    title.textContent = `${labelFor(entry.algorithm)} Sort`;
    const complexity = document.createElement("p");
    complexity.className = "sorting-complexity-line";
    complexity.textContent = `Best ${profile.bestTime} · Average ${profile.averageTime} · Worst ${profile.worstTime}`;
    const traits = document.createElement("p");
    traits.className = "lab-note";
    traits.textContent = `Space ${profile.space} · ${profile.stable ? "Stable" : "Not stable"} · ${profile.inPlace ? "In-place" : "Uses auxiliary storage"}`;
    const strengths = document.createElement("p");
    strengths.textContent = profile.strengths;
    const caution = document.createElement("p");
    caution.className = "lab-note";
    caution.textContent = profile.caution;
    card.append(title, complexity, traits, strengths, caution);
    cards.append(card);
  });

  const interpretation = document.createElement("div");
  interpretation.className = "sorting-interpretation";
  const interpretationTitle = document.createElement("strong");
  interpretationTitle.textContent = "How to interpret the race";
  const interpretationText = document.createElement("p");
  interpretationText.className = "lab-note";
  interpretationText.textContent = "A small input can let a quadratic algorithm look competitive. The work score explains this particular array; Big-O predicts growth across much larger inputs. Stable means equal-valued records keep their original relative order. In-place means the algorithm uses little extra storage beyond the array itself.";
  interpretation.append(interpretationTitle, interpretationText);

  container.append(winner, timingNote, tableWrap, lessonHeading, cards, interpretation);
}

function renderSorting(host: HTMLElement): LabModuleCleanup {
  host.innerHTML = `
    <div class="lab-module sorting-lab">
      <div class="lab-controls">
        <label>Algorithm<select id="sortingAlgorithm"></select></label>
        <label>Items<input id="sortingCount" type="number" min="6" max="60" value="24" /></label>
        <button id="sortingShuffle" type="button">Shuffle</button>
        <button id="sortingPrev" type="button">Previous</button>
        <button id="sortingPlay" type="button">Play</button>
        <button id="sortingNext" type="button">Next</button>
      </div>
      <div class="lab-meta" aria-live="polite">
        <span id="sortingStep"></span><span id="sortingComparisons"></span><span id="sortingWrites"></span><span id="sortingFinalized"></span>
      </div>
      <p id="sortingMessage" class="sorting-message" aria-live="polite"></p>
      <div class="lab-visual sorting-visual">
        <div id="sortingBars" class="sorting-bars"></div>
      </div>

      <section class="lab-panel sorting-compare-panel">
        <div class="sorting-compare-heading">
          <div><strong>Compare algorithms</strong><p class="lab-note">Every selected algorithm gets the exact same shuffled array. Results include a winner, race timing, work metrics, and Big-O learning notes.</p></div>
          <div class="sorting-preset-buttons">
            <button id="sortingSelectAll" type="button">All 6</button>
            <button id="sortingClassic" type="button">Bubble vs Merge</button>
            <button id="sortingEfficient" type="button">Merge vs Quick vs Heap</button>
          </div>
        </div>
        <div id="sortingCompareChoices" class="sorting-compare-choices" aria-label="Algorithms to compare"></div>
        <div class="sorting-compare-actions">
          <button id="sortingCompare" type="button">Compare Selected</button>
          <span id="sortingCompareStatus" class="lab-note" role="status" aria-live="polite">All six algorithms selected.</span>
        </div>
      </section>

      <div id="sortingRaceView" class="sorting-race" hidden></div>
      <section id="sortingSummary" class="lab-panel sorting-summary" hidden></section>

      <section class="lab-panel">
        <strong>What the colors mean</strong>
        <p class="lab-note"><span class="sorting-key active"></span> Orange means this position is being compared or moved. <span class="sorting-key finalized"></span> Green means the algorithm can prove that value is already in its final sorted position and it will not move again.</p>
        <p class="lab-note">A locally sorted region is not automatically final. Insertion Sort, for example, keeps a sorted prefix, but a later smaller value can still shift that whole prefix.</p>
      </section>
    </div>`;

  const algorithm = host.querySelector<HTMLSelectElement>("#sortingAlgorithm")!;
  const count = host.querySelector<HTMLInputElement>("#sortingCount")!;
  const bars = host.querySelector<HTMLElement>("#sortingBars")!;
  const visual = host.querySelector<HTMLElement>(".sorting-visual")!;
  const raceView = host.querySelector<HTMLElement>("#sortingRaceView")!;
  const summary = host.querySelector<HTMLElement>("#sortingSummary")!;
  const compareChoices = host.querySelector<HTMLElement>("#sortingCompareChoices")!;
  const compareStatus = host.querySelector<HTMLElement>("#sortingCompareStatus")!;
  const play = host.querySelector<HTMLButtonElement>("#sortingPlay")!;

  ALGORITHMS.forEach(item => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    algorithm.append(option);

    const label = document.createElement("label");
    label.className = "sorting-choice";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = item.value;
    checkbox.checked = true;
    checkbox.dataset.sortCompare = item.value;
    const text = document.createElement("span");
    text.textContent = item.label;
    label.append(checkbox, text);
    compareChoices.append(label);
  });

  let values = shuffle(24);
  let steps = buildSortSteps(values, "bubble");
  let index = 0;
  let timer: number | null = null;
  let raceTimer: number | null = null;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    if (raceTimer !== null) window.clearInterval(raceTimer);
    timer = null;
    raceTimer = null;
    play.textContent = "Play";
  };

  const draw = () => {
    const step = steps[index];
    renderBars(bars, step);
    host.querySelector<HTMLElement>("#sortingStep")!.textContent = `Step ${index + 1}/${steps.length}`;
    host.querySelector<HTMLElement>("#sortingComparisons")!.textContent = `Comparisons: ${step.comparisons}`;
    host.querySelector<HTMLElement>("#sortingWrites")!.textContent = `Writes/swaps: ${step.writes}`;
    host.querySelector<HTMLElement>("#sortingFinalized")!.textContent = `Final positions: ${step.finalized.length}/${step.values.length}`;
    host.querySelector<HTMLElement>("#sortingMessage")!.textContent = step.message;
  };

  const exitComparison = () => {
    raceView.hidden = true;
    summary.hidden = true;
    visual.hidden = false;
  };

  const rebuild = (reshuffle = false) => {
    stop();
    const nextCount = clampCount(count.value);
    count.value = String(nextCount);
    if (reshuffle || values.length !== nextCount) values = shuffle(nextCount);
    steps = buildSortSteps(values, algorithm.value as SortAlgorithm);
    index = 0;
    exitComparison();
    draw();
  };

  const selectedAlgorithms = (): SortAlgorithm[] =>
    [...compareChoices.querySelectorAll<HTMLInputElement>("input[data-sort-compare]:checked")]
      .map(input => input.value as SortAlgorithm);

  const setSelectedAlgorithms = (selected: SortAlgorithm[]) => {
    const wanted = new Set(selected);
    compareChoices.querySelectorAll<HTMLInputElement>("input[data-sort-compare]").forEach(input => {
      input.checked = wanted.has(input.value as SortAlgorithm);
    });
    compareStatus.textContent = `${selected.length} algorithm${selected.length === 1 ? "" : "s"} selected.`;
  };

  const showComparison = () => {
    stop();
    const selected = selectedAlgorithms();
    if (selected.length < 2) {
      compareStatus.textContent = "Select at least two algorithms to compare.";
      return;
    }

    const entries = buildSortComparison(values, selected);
    const positions = entries.map(() => 0);
    const elapsedMs = new Map<SortAlgorithm, number>();
    const startedAt = performance.now();
    visual.hidden = true;
    raceView.hidden = false;
    summary.hidden = true;
    raceView.replaceChildren();
    summary.replaceChildren();
    compareStatus.textContent = `Running ${entries.length} algorithms on the same ${values.length}-item array.`;

    const columns = entries.map((entry, traceIndex) => {
      const column = document.createElement("section");
      column.className = "sorting-race-column";
      const heading = document.createElement("h4");
      heading.textContent = `${labelFor(entry.algorithm)} Sort`;
      const profile = getSortLearningProfile(entry.algorithm);
      const bigO = document.createElement("div");
      bigO.className = "sorting-race-bigo";
      bigO.textContent = `Avg ${profile.averageTime} · Worst ${profile.worstTime}`;
      const miniBars = document.createElement("div");
      miniBars.className = "sorting-mini-bars";
      const meta = document.createElement("p");
      meta.className = "lab-note sorting-race-meta";
      const message = document.createElement("p");
      message.className = "sorting-race-message";
      column.append(heading, bigO, miniBars, meta, message);
      raceView.append(column);
      return { miniBars, meta, message, traceIndex };
    });

    const drawRace = () => columns.forEach(({ miniBars, meta, message, traceIndex }) => {
      const entry = entries[traceIndex];
      const step = entry.steps[positions[traceIndex]];
      renderBars(miniBars, step, true);
      const done = positions[traceIndex] >= entry.steps.length - 1;
      const elapsed = elapsedMs.get(entry.algorithm);
      meta.textContent = `${positions[traceIndex] + 1}/${entry.steps.length} · ${step.comparisons} comparisons · ${step.writes} writes · ${step.finalized.length}/${step.values.length} final${done ? ` · done in ${elapsed?.toFixed(0) ?? "0"} ms` : ""}`;
      message.textContent = step.message;
    });

    const finish = () => {
      if (raceTimer !== null) window.clearInterval(raceTimer);
      raceTimer = null;
      drawRace();
      renderComparisonSummary(summary, entries, elapsedMs);
      summary.hidden = false;
      compareStatus.textContent = `Comparison complete for ${entries.length} algorithms. Winner and complexity lessons are below.`;
    };

    drawRace();
    raceTimer = window.setInterval(() => {
      positions.forEach((position, traceIndex) => {
        const entry = entries[traceIndex];
        if (position < entry.steps.length - 1) {
          positions[traceIndex]++;
          if (positions[traceIndex] >= entry.steps.length - 1 && !elapsedMs.has(entry.algorithm)) {
            elapsedMs.set(entry.algorithm, performance.now() - startedAt);
          }
        }
      });
      drawRace();
      if (positions.every((position, traceIndex) => position >= entries[traceIndex].steps.length - 1)) finish();
    }, 70);
  };

  host.querySelector("#sortingShuffle")!.addEventListener("click", () => rebuild(true));
  host.querySelector("#sortingPrev")!.addEventListener("click", () => { stop(); exitComparison(); index = Math.max(0, index - 1); draw(); });
  host.querySelector("#sortingNext")!.addEventListener("click", () => { stop(); exitComparison(); index = Math.min(steps.length - 1, index + 1); draw(); });
  host.querySelector("#sortingCompare")!.addEventListener("click", showComparison);
  host.querySelector("#sortingSelectAll")!.addEventListener("click", () => setSelectedAlgorithms(ALGORITHMS.map(item => item.value)));
  host.querySelector("#sortingClassic")!.addEventListener("click", () => setSelectedAlgorithms(["bubble", "merge"]));
  host.querySelector("#sortingEfficient")!.addEventListener("click", () => setSelectedAlgorithms(["merge", "quick", "heap"]));
  compareChoices.addEventListener("change", () => {
    const selected = selectedAlgorithms();
    compareStatus.textContent = `${selected.length} algorithm${selected.length === 1 ? "" : "s"} selected.`;
  });
  algorithm.addEventListener("change", () => rebuild(false));
  count.addEventListener("change", () => rebuild(true));
  play.addEventListener("click", () => {
    exitComparison();
    if (timer !== null) return stop();
    if (index >= steps.length - 1) index = 0;
    play.textContent = "Pause";
    draw();
    timer = window.setInterval(() => {
      if (index >= steps.length - 1) return stop();
      index++;
      draw();
    }, 140);
  });

  draw();
  return stop;
}

registerLabModule({
  id: "sorting",
  replacesLegacyId: "sorting",
  icon: "▂▆▃█",
  title: "Sorting",
  description: "Animate six sorting algorithms, track provably final positions, compare exact-input winners, and learn Big-O, stability, memory, and scaling tradeoffs.",
  render: renderSorting
});
