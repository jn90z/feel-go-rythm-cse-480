import "./weightedPathfindingLab.css";
import { registerLabModule } from "./moduleRegistry";
import {
  createWeightedGrid,
  runWeightedSearch,
  TERRAIN_COST,
  type Terrain,
  type WeightedSearchAlgorithm,
  type WeightedSearchResult
} from "./weightedPathfindingModel";

const ROWS = 10;
const COLS = 14;

registerLabModule({
  id: "weighted-pathfinding",
  icon: "▦+",
  title: "Weighted Pathfinding",
  description: "Paint road, grass, mud and walls, then compare Dijkstra with A* on real movement costs.",
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
          <button type="button" data-wp-run>Run</button>
          <button type="button" data-wp-step>Step</button>
          <button type="button" data-wp-compare>Compare Dijkstra vs A*</button>
          <button type="button" data-wp-demo>Terrain Demo</button>
          <button type="button" data-wp-clear>Clear</button>
        </div>
        <div class="weighted-path-terrain" role="group" aria-label="Terrain paint tool">
          <button type="button" data-terrain="road" aria-pressed="true">Road · 1</button>
          <button type="button" data-terrain="grass" aria-pressed="false">Grass · 3</button>
          <button type="button" data-terrain="mud" aria-pressed="false">Mud · 7</button>
          <button type="button" data-terrain="wall" aria-pressed="false">Wall · blocked</button>
        </div>
        <div class="weighted-path-legend">
          <span>Blue = start</span><span>Red = goal</span><span>Yellow = frontier</span><span>Blue haze = visited</span><span>Green = final path</span>
        </div>
        <div class="weighted-path-grid" data-wp-grid aria-label="Weighted terrain grid"></div>
        <div class="weighted-path-metrics" data-wp-metrics aria-live="polite"></div>
        <div class="weighted-path-explain" data-wp-explain aria-live="polite">Paint terrain, then run a search. Entering grass costs 3 and mud costs 7, so the cheapest path may be longer in number of cells.</div>
        <div class="weighted-path-compare" data-wp-compare-results hidden></div>
      </div>`;

    const gridElement = host.querySelector<HTMLElement>("[data-wp-grid]")!;
    const metrics = host.querySelector<HTMLElement>("[data-wp-metrics]")!;
    const explain = host.querySelector<HTMLElement>("[data-wp-explain]")!;
    const compareResults = host.querySelector<HTMLElement>("[data-wp-compare-results]")!;
    const algorithmSelect = host.querySelector<HTMLSelectElement>("[data-wp-algorithm]")!;
    const terrainButtons = [...host.querySelectorAll<HTMLButtonElement>("[data-terrain]")];

    let grid = createWeightedGrid(ROWS, COLS);
    let paint: Terrain = "road";
    let result: WeightedSearchResult | null = null;
    let stepIndex = -1;
    let dragging = false;

    const stopDragging = (): void => { dragging = false; };

    function setPaint(next: Terrain): void {
      paint = next;
      terrainButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.terrain === next)));
    }

    function paintCell(index: number): void {
      if (index === grid.start || index === grid.goal) return;
      grid.terrain[index] = paint;
      result = null;
      stepIndex = -1;
      compareResults.hidden = true;
      renderGrid();
    }

    function renderGrid(): void {
      const step = result && stepIndex >= 0 ? result.steps[Math.min(stepIndex, result.steps.length - 1)] : null;
      const visited = new Set(step?.visited ?? []);
      const frontier = new Set(step?.frontier ?? []);
      const finalPath = result && stepIndex >= result.steps.length - 1 ? new Set(result.path) : new Set<number>();
      gridElement.innerHTML = grid.terrain.map((terrain, index) => {
        const classes = ["weighted-path-cell", terrain];
        if (visited.has(index)) classes.push("visited");
        if (frontier.has(index)) classes.push("frontier");
        if (finalPath.has(index)) classes.push("path");
        if (index === grid.start) classes.push("start");
        if (index === grid.goal) classes.push("goal");
        const cost = terrain === "wall" ? "blocked" : String(TERRAIN_COST[terrain]);
        return `<button type="button" class="${classes.join(" ")}" data-cell="${index}" aria-label="Cell ${index}, ${terrain}, cost ${cost}"></button>`;
      }).join("");
    }

    function updateExplanation(): void {
      if (!result) {
        metrics.textContent = "";
        return;
      }
      if (!result.steps.length) {
        metrics.textContent = "No route available.";
        explain.textContent = "The start or goal is blocked, or no traversable route can reach the goal.";
        return;
      }
      const step = result.steps[Math.max(0, Math.min(stepIndex, result.steps.length - 1))];
      const pathStatus = Number.isFinite(result.totalCost) ? `optimal cost ${result.totalCost}` : "no path";
      metrics.textContent = `${result.algorithm === "astar" ? "A*" : "Dijkstra"} · step ${Math.max(0, stepIndex + 1)} / ${result.steps.length} · visited ${step.visited.length} · ${pathStatus}`;
      explain.textContent = step.message + (result.algorithm === "astar"
        ? " A* adds Manhattan distance to the known travel cost, so equally cheap candidates closer to the goal are preferred."
        : " Dijkstra ignores direction and expands strictly by the cheapest known accumulated travel cost.");
    }

    function run(resetToEnd = true): void {
      result = runWeightedSearch(grid, algorithmSelect.value as WeightedSearchAlgorithm);
      stepIndex = resetToEnd ? Math.max(0, result.steps.length - 1) : -1;
      renderGrid();
      updateExplanation();
    }

    function step(): void {
      if (!result || result.algorithm !== algorithmSelect.value) {
        result = runWeightedSearch(grid, algorithmSelect.value as WeightedSearchAlgorithm);
        stepIndex = -1;
      }
      stepIndex = Math.min(result.steps.length - 1, stepIndex + 1);
      renderGrid();
      updateExplanation();
    }

    function compare(): void {
      const dijkstra = runWeightedSearch(grid, "dijkstra");
      const astar = runWeightedSearch(grid, "astar");
      compareResults.hidden = false;
      const card = (label: string, search: WeightedSearchResult) => `
        <div class="weighted-path-card">
          <strong>${label}</strong>
          <p>Path cost: ${Number.isFinite(search.totalCost) ? search.totalCost : "unreachable"}</p>
          <p>Visited cells: ${search.visitedCount}</p>
          <p>Path cells: ${search.path.length}</p>
        </div>`;
      compareResults.innerHTML = card("Dijkstra", dijkstra) + card("A*", astar);

      if (!Number.isFinite(dijkstra.totalCost) && !Number.isFinite(astar.totalCost)) {
        explain.textContent = `Neither algorithm can reach the goal. Dijkstra visited ${dijkstra.visitedCount} cells and A* visited ${astar.visitedCount} before proving the route is blocked.`;
        return;
      }

      const sameCost = dijkstra.totalCost === astar.totalCost;
      explain.textContent = sameCost
        ? `Both algorithms found the same optimal cost. A* visited ${astar.visitedCount} cells versus Dijkstra's ${dijkstra.visitedCount}; the heuristic changes how much of the map must be explored, not the optimal answer.`
        : "The algorithms disagreed on path cost. That indicates the terrain or search model needs review.";
    }

    function terrainDemo(): void {
      grid = createWeightedGrid(ROWS, COLS);
      const middleRow = Math.floor(ROWS / 2);
      for (let col = 2; col < COLS - 2; col++) grid.terrain[middleRow * COLS + col] = "mud";
      for (let col = 1; col < COLS - 1; col++) grid.terrain[(middleRow - 1) * COLS + col] = "grass";
      for (let row = 1; row < ROWS - 2; row++) grid.terrain[row * COLS + 6] = "wall";
      grid.terrain[(middleRow + 1) * COLS + 6] = "road";
      result = null;
      stepIndex = -1;
      compareResults.hidden = true;
      explain.textContent = "Demo loaded: the direct-looking route crosses expensive terrain and a wall. Compare algorithms to see how they explore while still agreeing on cheapest total cost.";
      renderGrid();
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

    host.querySelector("[data-wp-run]")!.addEventListener("click", () => run(true));
    host.querySelector("[data-wp-step]")!.addEventListener("click", step);
    host.querySelector("[data-wp-compare]")!.addEventListener("click", compare);
    host.querySelector("[data-wp-demo]")!.addEventListener("click", terrainDemo);
    host.querySelector("[data-wp-clear]")!.addEventListener("click", () => {
      grid = createWeightedGrid(ROWS, COLS);
      result = null;
      stepIndex = -1;
      compareResults.hidden = true;
      explain.textContent = "Grid cleared. Paint terrain, then run or step through the search.";
      renderGrid();
      updateExplanation();
    });
    algorithmSelect.addEventListener("change", () => {
      result = null;
      stepIndex = -1;
      compareResults.hidden = true;
      renderGrid();
      explain.textContent = `${algorithmSelect.value === "astar" ? "A*" : "Dijkstra"} selected. Use Step to see why each cell is expanded.`;
    });

    renderGrid();

    return () => {
      stopDragging();
      window.removeEventListener("pointerup", stopDragging);
    };
  }
});
