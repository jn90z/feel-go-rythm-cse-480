import "./sortingLab.css";
import { registerLabModule, type LabModuleCleanup } from "./moduleRegistry";
import { buildSortSteps, type SortAlgorithm, type SortStep } from "./sortingModel";

const ALGORITHMS: Array<{ value: SortAlgorithm; label: string }> = [
  { value: "bubble", label: "Bubble" },
  { value: "selection", label: "Selection" },
  { value: "insertion", label: "Insertion" },
  { value: "merge", label: "Merge" },
  { value: "quick", label: "Quick" },
  { value: "heap", label: "Heap" }
];

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
        <button id="sortingRace" type="button">Bubble vs Merge</button>
      </div>
      <div class="lab-meta" aria-live="polite">
        <span id="sortingStep"></span><span id="sortingComparisons"></span><span id="sortingWrites"></span><span id="sortingFinalized"></span>
      </div>
      <p id="sortingMessage" class="sorting-message" aria-live="polite"></p>
      <div class="lab-visual sorting-visual">
        <div id="sortingBars" class="sorting-bars"></div>
        <div id="sortingRaceView" class="sorting-race" hidden></div>
      </div>
      <section class="lab-panel">
        <strong>What the colors mean</strong>
        <p class="lab-note"><span class="sorting-key active"></span> Orange means this position is being compared or moved. <span class="sorting-key finalized"></span> Green means the algorithm can prove that value is already in its final sorted position and it will not move again.</p>
        <p class="lab-note">A locally sorted region is not automatically final. Insertion Sort, for example, keeps a sorted prefix, but a later smaller value can still shift that whole prefix.</p>
      </section>
    </div>`;

  const algorithm = host.querySelector<HTMLSelectElement>("#sortingAlgorithm")!;
  const count = host.querySelector<HTMLInputElement>("#sortingCount")!;
  const bars = host.querySelector<HTMLElement>("#sortingBars")!;
  const raceView = host.querySelector<HTMLElement>("#sortingRaceView")!;
  const play = host.querySelector<HTMLButtonElement>("#sortingPlay")!;

  ALGORITHMS.forEach(item => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    algorithm.append(option);
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

  const rebuild = (reshuffle = false) => {
    stop();
    const nextCount = clampCount(count.value);
    count.value = String(nextCount);
    if (reshuffle || values.length !== nextCount) values = shuffle(nextCount);
    steps = buildSortSteps(values, algorithm.value as SortAlgorithm);
    index = 0;
    raceView.hidden = true;
    bars.hidden = false;
    draw();
  };

  const showRace = () => {
    stop();
    bars.hidden = true;
    raceView.hidden = false;
    raceView.replaceChildren();
    const algorithms: SortAlgorithm[] = ["bubble", "merge"];
    const traces = algorithms.map(item => buildSortSteps(values, item));
    const positions = [0, 0];
    const columns = algorithms.map((item, traceIndex) => {
      const column = document.createElement("section");
      column.className = "sorting-race-column";
      const heading = document.createElement("h4");
      heading.textContent = item === "bubble" ? "Bubble Sort" : "Merge Sort";
      const miniBars = document.createElement("div");
      miniBars.className = "sorting-mini-bars";
      const meta = document.createElement("p");
      meta.className = "lab-note";
      column.append(heading, miniBars, meta);
      raceView.append(column);
      return { miniBars, meta, traceIndex };
    });

    const drawRace = () => columns.forEach(({ miniBars, meta, traceIndex }) => {
      const step = traces[traceIndex][positions[traceIndex]];
      renderBars(miniBars, step, true);
      meta.textContent = `${positions[traceIndex] + 1}/${traces[traceIndex].length} · ${step.comparisons} comparisons · ${step.finalized.length} final`;
    });

    drawRace();
    raceTimer = window.setInterval(() => {
      positions.forEach((position, traceIndex) => {
        if (position < traces[traceIndex].length - 1) positions[traceIndex]++;
      });
      drawRace();
      if (positions.every((position, traceIndex) => position >= traces[traceIndex].length - 1)) stop();
    }, 55);
  };

  host.querySelector("#sortingShuffle")!.addEventListener("click", () => rebuild(true));
  host.querySelector("#sortingPrev")!.addEventListener("click", () => { stop(); index = Math.max(0, index - 1); draw(); });
  host.querySelector("#sortingNext")!.addEventListener("click", () => { stop(); index = Math.min(steps.length - 1, index + 1); draw(); });
  host.querySelector("#sortingRace")!.addEventListener("click", showRace);
  algorithm.addEventListener("change", () => rebuild(false));
  count.addEventListener("change", () => rebuild(true));
  play.addEventListener("click", () => {
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
  description: "Animate six sorting algorithms and watch positions turn green the moment they are provably final.",
  render: renderSorting
});
