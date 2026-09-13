import "./weightedPathfindingLab.css";
import { registerLabModule } from "./moduleRegistry";
import {
  createWeightedGrid,
  runWeightedSearch,
  TERRAIN_COST,
  type Terrain,
  type WeightedCandidateScore,
  type WeightedSearchAlgorithm,
  type WeightedSearchResult
} from "./weightedPathfindingModel";

const ROWS = 10;
const COLS = 14;
const SPEEDS = [0.5, 1, 2, 4] as const;

function algorithmName(algorithm: WeightedSearchAlgorithm): string {
  return algorithm === "astar" ? "A*" : "Dijkstra";
}

function cellLabel(index: number, cols: number): string {
  return `r${Math.floor(index / cols) + 1} c${index % cols + 1}`;
}

registerLabModule({
  id: "weighted-pathfinding",
  icon: "▦+",
  title: "Weighted Pathfinding",
  description: "Paint weighted terrain, inspect frontier priorities, predict the next expansion, and compare Dijkstra with A*.",
  featured: true,
  render(host) {
    host.innerHTML = `
      <div class="weighted-path-lab">
        <div class="weighted-path-controls">
          <label>Algorithm
            <select data-wp-algorithm>
              <option value="dijkstra">Dijkstra</option>
              <option value="astar">A*</option>
            </select>
          </label>
          <label>Speed
            <select data-wp-speed>
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
            </select>
          </label>
          <button type="button" data-wp-run>Run to End</button>
          <button type="button" data-wp-prev>Previous</button>
          <button type="button" data-wp-play>Play</button>
          <button type="button" data-wp-next>Next</button>
          <button type="button" data-wp-compare>Compare Dijkstra vs A*</button>
          <button type="button" data-wp-demo>Cost + Wall Demo</button>
          <button type="button" data-wp-clear>Clear</button>
        </div>
        <div class="weighted-path-terrain" role="group" aria-label="Terrain paint tool">
          <button type="button" data-terrain="road" aria-pressed="true">Road · 1</button>
          <button type="button" data-terrain="grass" aria-pressed="false">Grass · 3</button>
          <button type="button" data-terrain="mud" aria-pressed="false">Mud · 7</button>
          <button type="button" data-terrain="wall" aria-pressed="false">Wall · blocked</button>
        </div>
        <div class="weighted-path-legend">
          <span>Blue = start</span><span>Red = goal</span><span>Orange ring = current</span><span>Yellow = frontier</span><span>Blue haze = visited</span><span>Green = final path</span>
        </div>
        <div class="weighted-path-grid" data-wp-grid aria-label="Weighted terrain grid"></div>
        <div class="weighted-path-timeline" data-wp-timeline hidden>
          <label><span data-wp-timeline-label>Before search</span><input data-wp-scrubber type="range" min="0" max="0" value="0" aria-label="Search step timeline"></label>
        </div>
        <div class="weighted-path-metrics" data-wp-metrics aria-live="polite"></div>
        <div class="weighted-path-learning-layout">
          <section class="weighted-path-explain" aria-live="polite">
            <strong>Why this cell?</strong>
            <p data-wp-explain>Paint terrain, then step through a search. Entering grass costs 3 and mud costs 7, so the cheapest path may use more cells.</p>
          </section>
          <section class="weighted-path-frontier" data-wp-frontier-panel hidden>
            <strong>Frontier decision</strong>
            <p class="lab-note" data-wp-frontier-rule></p>
            <div class="weighted-path-candidates" data-wp-candidates></div>
          </section>
        </div>
        <section class="weighted-path-challenge" data-wp-challenge hidden>
          <strong>Predict the next expansion</strong>
          <p class="lab-note">Use the frontier priorities above. Which cell will the algorithm remove from the frontier next?</p>
          <div class="weighted-path-predictions" data-wp-predictions></div>
          <p class="weighted-path-feedback" data-wp-feedback role="status" aria-live="polite"></p>
        </section>
        <div class="weighted-path-compare" data-wp-compare-results hidden></div>
      </div>`;

    const gridElement = host.querySelector<HTMLElement>("[data-wp-grid]")!;
    const metrics = host.querySelector<HTMLElement>("[data-wp-metrics]")!;
    const explain = host.querySelector<HTMLElement>("[data-wp-explain]")!;
    const compareResults = host.querySelector<HTMLElement>("[data-wp-compare-results]")!;
    const algorithmSelect = host.querySelector<HTMLSelectElement>("[data-wp-algorithm]")!;
    const speedSelect = host.querySelector<HTMLSelectElement>("[data-wp-speed]")!;
    const playButton = host.querySelector<HTMLButtonElement>("[data-wp-play]")!;
    const timeline = host.querySelector<HTMLElement>("[data-wp-timeline]")!;
    const timelineLabel = host.querySelector<HTMLElement>("[data-wp-timeline-label]")!;
    const scrubber = host.querySelector<HTMLInputElement>("[data-wp-scrubber]")!;
    const frontierPanel = host.querySelector<HTMLElement>("[data-wp-frontier-panel]")!;
    const frontierRule = host.querySelector<HTMLElement>("[data-wp-frontier-rule]")!;
    const candidates = host.querySelector<HTMLElement>("[data-wp-candidates]")!;
    const challenge = host.querySelector<HTMLElement>("[data-wp-challenge]")!;
    const predictions = host.querySelector<HTMLElement>("[data-wp-predictions]")!;
    const feedback = host.querySelector<HTMLElement>("[data-wp-feedback]")!;
    const terrainButtons = [...host.querySelectorAll<HTMLButtonElement>("[data-terrain]")];

    let grid = createWeightedGrid(ROWS, COLS);
    let paint: Terrain = "road";
    let result: WeightedSearchResult | null = null;
    let stepIndex = -1;
    let dragging = false;
    let playTimer: number | null = null;

    const stopDragging = (): void => { dragging = false; };
    const stopPlayback = (): void => {
      if (playTimer !== null) window.clearInterval(playTimer);
      playTimer = null;
      playButton.textContent = "Play";
    };

    function setPaint(next: Terrain): void {
      paint = next;
      terrainButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.terrain === next)));
    }

    function clearSearchState(message?: string): void {
      stopPlayback();
      result = null;
      stepIndex = -1;
      compareResults.hidden = true;
      challenge.hidden = true;
      frontierPanel.hidden = true;
      timeline.hidden = true;
      feedback.textContent = "";
      if (message) explain.textContent = message;
    }

    function paintCell(index: number): void {
      if (!Number.isInteger(index) || index < 0 || index >= grid.terrain.length || index === grid.start || index === grid.goal) return;
      grid.terrain[index] = paint;
      clearSearchState("Terrain changed. Step through the search to see how the frontier reacts to the new costs.");
      renderGrid();
      updateLearningPanels();
    }

    function currentStep() {
      if (!result || stepIndex < 0 || !result.steps.length) return null;
      return result.steps[Math.min(stepIndex, result.steps.length - 1)];
    }

    function renderGrid(): void {
      const step = currentStep();
      const visited = new Set(step?.visited ?? []);
      const frontier = new Set(step?.frontier ?? []);
      const finalPath = result && stepIndex >= result.steps.length - 1 ? new Set(result.path) : new Set<number>();
      const priority = new Map((step?.nextCandidates ?? []).map(candidate => [candidate.index, candidate.priority]));
      gridElement.replaceChildren();

      grid.terrain.forEach((terrain, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `weighted-path-cell ${terrain}`;
        button.dataset.cell = String(index);
        if (visited.has(index)) button.classList.add("visited");
        if (frontier.has(index)) button.classList.add("frontier");
        if (finalPath.has(index)) button.classList.add("path");
        if (step?.current === index) button.classList.add("current");
        if (index === grid.start) button.classList.add("start");
        if (index === grid.goal) button.classList.add("goal");
        const cost = terrain === "wall" ? "blocked" : String(TERRAIN_COST[terrain]);
        const score = priority.get(index);
        button.setAttribute("aria-label", `${cellLabel(index, grid.cols)}, ${terrain}, cost ${cost}${score === undefined ? "" : `, frontier priority ${score}`}`);
        if (score !== undefined) {
          const scoreLabel = document.createElement("span");
          scoreLabel.className = "weighted-path-cell-score";
          scoreLabel.textContent = String(score);
          button.append(scoreLabel);
        }
        gridElement.append(button);
      });
    }

    function renderCandidates(stepCandidates: WeightedCandidateScore[]): void {
      candidates.replaceChildren();
      const visibleCandidates = [...stepCandidates].sort((left, right) => left.index - right.index).slice(0, 12);
      for (const candidate of visibleCandidates) {
        const card = document.createElement("div");
        card.className = "weighted-path-candidate";
        const name = document.createElement("strong");
        name.textContent = cellLabel(candidate.index, grid.cols);
        const detail = document.createElement("span");
        detail.textContent = result?.algorithm === "astar"
          ? `g=${candidate.pathCost} + h=${candidate.heuristic} → f=${candidate.priority}`
          : `known cost g=${candidate.pathCost}`;
        card.append(name, detail);
        candidates.append(card);
      }
      if (stepCandidates.length > visibleCandidates.length) {
        const more = document.createElement("div");
        more.className = "lab-note";
        more.textContent = `+${stepCandidates.length - visibleCandidates.length} more frontier cells`;
        candidates.append(more);
      }
    }

    function renderPrediction(): void {
      predictions.replaceChildren();
      feedback.textContent = "";
      if (!result || stepIndex < 0 || stepIndex >= result.steps.length - 1) {
        challenge.hidden = true;
        return;
      }

      const step = result.steps[stepIndex];
      const answer = result.steps[stepIndex + 1].current;
      const optionIndexes = [...step.nextCandidates]
        .sort((left, right) => left.index - right.index)
        .slice(0, 8)
        .map(candidate => candidate.index);
      if (!optionIndexes.includes(answer)) optionIndexes[optionIndexes.length - 1] = answer;
      const uniqueOptions = [...new Set(optionIndexes)].sort((left, right) => left - right);
      if (uniqueOptions.length < 2) {
        challenge.hidden = true;
        return;
      }

      challenge.hidden = false;
      uniqueOptions.forEach(index => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = cellLabel(index, grid.cols);
        button.addEventListener("click", () => {
          const correct = index === answer;
          predictions.querySelectorAll<HTMLButtonElement>("button").forEach(option => { option.disabled = true; });
          button.classList.add(correct ? "correct" : "incorrect");
          const best = step.nextCandidates[0];
          feedback.textContent = correct
            ? `Correct. ${cellLabel(answer, grid.cols)} has the lowest priority (${best.priority}), so it expands next.`
            : `Not this one. ${cellLabel(answer, grid.cols)} has the lowest priority (${best.priority}) and expands next.`;
        });
        predictions.append(button);
      });
    }

    function updateLearningPanels(): void {
      if (!result) {
        metrics.textContent = "";
        timeline.hidden = true;
        frontierPanel.hidden = true;
        challenge.hidden = true;
        return;
      }
      if (!result.steps.length) {
        metrics.textContent = "No route available.";
        explain.textContent = "The start or goal is blocked, or no traversable route can reach the goal.";
        timeline.hidden = true;
        frontierPanel.hidden = true;
        challenge.hidden = true;
        return;
      }

      timeline.hidden = false;
      scrubber.max = String(result.steps.length);
      scrubber.value = String(stepIndex + 1);
      timelineLabel.textContent = stepIndex < 0 ? `Before search · ${result.steps.length} expansions available` : `Expansion ${stepIndex + 1} of ${result.steps.length}`;

      if (stepIndex < 0) {
        metrics.textContent = `${algorithmName(result.algorithm)} ready · ${result.steps.length} total expansions in this trace`;
        explain.textContent = `${algorithmName(result.algorithm)} starts at ${cellLabel(grid.start, grid.cols)}. Advance one step to expand the start and discover its first frontier cells.`;
        frontierPanel.hidden = true;
        challenge.hidden = true;
        return;
      }

      const step = result.steps[stepIndex];
      const pathStatus = Number.isFinite(result.totalCost) ? `optimal cost ${result.totalCost}` : "no path";
      metrics.textContent = `${algorithmName(result.algorithm)} · expansion ${stepIndex + 1}/${result.steps.length} · visited ${step.visited.length} · frontier ${step.frontier.length} · ${pathStatus}`;
      explain.textContent = step.message + (result.algorithm === "astar"
        ? " A* ranks the frontier by f = known cost g + Manhattan estimate h."
        : " Dijkstra ranks the frontier only by the cheapest known accumulated cost g.");

      frontierPanel.hidden = step.nextCandidates.length === 0;
      frontierRule.textContent = result.algorithm === "astar"
        ? "A* expands the smallest f = g + h. Ties use the lower cell index in this demo."
        : "Dijkstra expands the smallest known path cost g. Ties use the lower cell index in this demo.";
      renderCandidates(step.nextCandidates);
      renderPrediction();
    }

    function draw(): void {
      renderGrid();
      updateLearningPanels();
    }

    function ensureResult(): WeightedSearchResult {
      const selected = algorithmSelect.value as WeightedSearchAlgorithm;
      if (!result || result.algorithm !== selected) result = runWeightedSearch(grid, selected);
      return result;
    }

    function moveTo(nextIndex: number): void {
      stopPlayback();
      const search = ensureResult();
      if (!search.steps.length) {
        stepIndex = -1;
      } else {
        stepIndex = Math.max(-1, Math.min(search.steps.length - 1, nextIndex));
      }
      draw();
    }

    function runToEnd(): void {
      const search = ensureResult();
      stepIndex = search.steps.length ? search.steps.length - 1 : -1;
      draw();
    }

    function startPlayback(): void {
      const search = ensureResult();
      if (!search.steps.length) return draw();
      if (stepIndex >= search.steps.length - 1) stepIndex = -1;
      const speed = Number(speedSelect.value) || 1;
      playButton.textContent = "Pause";
      playTimer = window.setInterval(() => {
        if (!result || stepIndex >= result.steps.length - 1) return stopPlayback();
        stepIndex += 1;
        draw();
      }, Math.max(90, 650 / speed));
      draw();
    }

    function compare(): void {
      stopPlayback();
      const dijkstra = runWeightedSearch(grid, "dijkstra");
      const astar = runWeightedSearch(grid, "astar");
      compareResults.hidden = false;
      compareResults.replaceChildren();

      for (const [label, search] of [["Dijkstra", dijkstra], ["A*", astar]] as const) {
        const card = document.createElement("div");
        card.className = "weighted-path-card";
        const title = document.createElement("strong");
        title.textContent = label;
        const cost = document.createElement("p");
        cost.textContent = `Path cost: ${Number.isFinite(search.totalCost) ? search.totalCost : "unreachable"}`;
        const visited = document.createElement("p");
        visited.textContent = `Expanded cells: ${search.visitedCount}`;
        const path = document.createElement("p");
        path.textContent = `Path cells: ${search.path.length}`;
        card.append(title, cost, visited, path);
        compareResults.append(card);
      }

      if (!Number.isFinite(dijkstra.totalCost) && !Number.isFinite(astar.totalCost)) {
        explain.textContent = `Neither algorithm can reach the goal. Dijkstra expanded ${dijkstra.visitedCount} cells and A* expanded ${astar.visitedCount} before proving the route is blocked.`;
      } else if (dijkstra.totalCost === astar.totalCost) {
        explain.textContent = `Both algorithms found the same optimal cost. A* expanded ${astar.visitedCount} cells versus Dijkstra's ${dijkstra.visitedCount}; the heuristic changes how much of the map must be explored, not the optimal answer.`;
      } else {
        explain.textContent = "The algorithms disagreed on path cost. That indicates the terrain or search model needs review.";
      }
    }

    function terrainDemo(): void {
      stopPlayback();
      grid = createWeightedGrid(ROWS, COLS);
      const middleRow = Math.floor(ROWS / 2);
      for (let col = 2; col < COLS - 2; col++) grid.terrain[middleRow * COLS + col] = "mud";
      for (let col = 1; col < COLS - 1; col++) grid.terrain[(middleRow - 1) * COLS + col] = "grass";
      for (let row = 1; row < ROWS - 2; row++) grid.terrain[row * COLS + 6] = "wall";
      grid.terrain[(middleRow + 1) * COLS + 6] = "road";
      clearSearchState("Demo loaded: the direct-looking route crosses expensive terrain and a wall. Step through the frontier priorities, then compare Dijkstra with A*.");
      renderGrid();
      updateLearningPanels();
    }

    terrainButtons.forEach(button => button.addEventListener("click", () => setPaint(button.dataset.terrain as Terrain)));
    gridElement.addEventListener("pointerdown", event => {
      dragging = true;
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]");
      if (target) paintCell(Number(target.dataset.cell));
    });
    gridElement.addEventListener("pointerover", event => {
      if (!dragging) return;
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-cell]");
      if (target) paintCell(Number(target.dataset.cell));
    });
    window.addEventListener("pointerup", stopDragging);

    host.querySelector("[data-wp-run]")!.addEventListener("click", runToEnd);
    host.querySelector("[data-wp-prev]")!.addEventListener("click", () => moveTo(stepIndex - 1));
    host.querySelector("[data-wp-next]")!.addEventListener("click", () => moveTo(stepIndex + 1));
    playButton.addEventListener("click", () => playTimer !== null ? stopPlayback() : startPlayback());
    speedSelect.addEventListener("change", () => {
      if (playTimer !== null) {
        stopPlayback();
        startPlayback();
      }
    });
    scrubber.addEventListener("input", () => moveTo(Number(scrubber.value) - 1));
    host.querySelector("[data-wp-compare]")!.addEventListener("click", compare);
    host.querySelector("[data-wp-demo]")!.addEventListener("click", terrainDemo);
    host.querySelector("[data-wp-clear]")!.addEventListener("click", () => {
      grid = createWeightedGrid(ROWS, COLS);
      clearSearchState("Grid cleared. Paint terrain, then step through the search and predict which frontier cell expands next.");
      renderGrid();
      updateLearningPanels();
    });
    algorithmSelect.addEventListener("change", () => {
      clearSearchState(`${algorithmName(algorithmSelect.value as WeightedSearchAlgorithm)} selected. Advance one step, inspect frontier priorities, and predict the next expansion.`);
      renderGrid();
      updateLearningPanels();
    });

    renderGrid();

    return () => {
      stopPlayback();
      stopDragging();
      window.removeEventListener("pointerup", stopDragging);
    };
  }
});
