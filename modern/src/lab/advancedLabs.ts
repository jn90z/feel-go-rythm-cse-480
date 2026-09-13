import "./advancedLabs.css";

export {};

type CurveId = "constant" | "log" | "linear" | "nlogn" | "quadratic" | "exponential";

type Curve = {
  id: CurveId;
  label: string;
  notation: string;
  description: string;
  value: (n: number) => number;
};

const curves: Curve[] = [
  { id: "constant", label: "Constant", notation: "O(1)", description: "Work stays roughly the same as input grows.", value: () => 1 },
  { id: "log", label: "Logarithmic", notation: "O(log n)", description: "Each step removes a large fraction of the remaining problem.", value: n => Math.max(1, Math.log2(n)) },
  { id: "linear", label: "Linear", notation: "O(n)", description: "Work grows in direct proportion to input size.", value: n => n },
  { id: "nlogn", label: "Linearithmic", notation: "O(n log n)", description: "Common for efficient comparison sorting and divide-and-conquer work.", value: n => n * Math.max(1, Math.log2(n)) },
  { id: "quadratic", label: "Quadratic", notation: "O(n²)", description: "Often appears when every item is compared with many other items.", value: n => n * n },
  { id: "exponential", label: "Exponential", notation: "O(2ⁿ)", description: "Work doubles with each additional input item; growth becomes enormous quickly.", value: n => 2 ** Math.min(n, 24) }
];

const examples: Record<CurveId, string> = {
  constant: "Array index lookup, stack push/pop",
  log: "Binary search, balanced-tree lookup",
  linear: "Linear search, one full array scan",
  nlogn: "Merge sort, heap sort, average quicksort",
  quadratic: "Bubble sort, selection sort, insertion sort worst case",
  exponential: "Naive recursive Fibonacci, brute-force subset exploration"
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatWork(value: number): string {
  if (!Number.isFinite(value)) return "huge";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value < 10 ? value.toFixed(1).replace(".0", "") : Math.round(value).toLocaleString();
}

function renderComplexity(host: HTMLElement): void {
  host.innerHTML = `
    <div class="lab-module complexity-module">
      <div class="lab-controls">
        <label>Input size n
          <input id="complexityN" type="range" min="2" max="100" value="24" />
        </label>
        <strong id="complexityNValue">n = 24</strong>
        <button id="complexityRace" type="button">Growth Race</button>
        <button id="complexityReset" type="button">Reset</button>
      </div>
      <div class="complexity-layout">
        <div class="lab-panel complexity-chart-panel">
          <div class="complexity-chart-header">
            <div><strong>How fast does the work grow?</strong><p>Normalized view — shape matters more than exact scale.</p></div>
          </div>
          <svg id="complexityChart" class="complexity-chart" viewBox="0 0 760 360" role="img" aria-label="Big O growth curves"></svg>
        </div>
        <div class="lab-panel complexity-side">
          <strong>At this input size</strong>
          <div id="complexityTable" class="complexity-table"></div>
        </div>
      </div>
      <div class="lab-panel complexity-explainer">
        <strong id="complexityWhyTitle">Why this matters</strong>
        <p id="complexityWhy">As n grows, algorithms that feel similar on tiny inputs can separate dramatically. Change n and compare their estimated work.</p>
      </div>
    </div>`;

  const slider = host.querySelector<HTMLInputElement>("#complexityN")!;
  const nLabel = host.querySelector<HTMLElement>("#complexityNValue")!;
  const svg = host.querySelector<SVGSVGElement>("#complexityChart")!;
  const table = host.querySelector<HTMLElement>("#complexityTable")!;
  const whyTitle = host.querySelector<HTMLElement>("#complexityWhyTitle")!;
  const why = host.querySelector<HTMLElement>("#complexityWhy")!;
  const raceButton = host.querySelector<HTMLButtonElement>("#complexityRace")!;
  let raceTimer: number | null = null;
  let selected: CurveId = "nlogn";

  const stopRace = () => {
    if (raceTimer !== null) window.clearInterval(raceTimer);
    raceTimer = null;
    raceButton.textContent = "Growth Race";
  };

  const draw = () => {
    const n = clamp(Number(slider.value) || 24, 2, 100);
    nLabel.textContent = `n = ${n}`;

    const chartMaxN = 100;
    const samples = Array.from({ length: 50 }, (_, i) => 2 + (i / 49) * (chartMaxN - 2));
    const cap = 10_000;
    const x = (value: number) => 52 + ((value - 2) / (chartMaxN - 2)) * 674;
    const y = (value: number) => 320 - (Math.log10(1 + Math.min(value, cap)) / Math.log10(1 + cap)) * 275;

    const grid = [1, 10, 100, 1000, 10000].map(v => `<g><line x1="52" y1="${y(v)}" x2="726" y2="${y(v)}" class="complexity-grid-line"/><text x="44" y="${y(v) + 4}" text-anchor="end" class="complexity-axis-text">${formatWork(v)}</text></g>`).join("");
    const markerX = x(n);
    const paths = curves.map(curve => {
      const points = samples.map((sample, index) => `${index === 0 ? "M" : "L"}${x(sample).toFixed(1)},${y(curve.value(sample)).toFixed(1)}`).join(" ");
      return `<path data-curve="${curve.id}" d="${points}" class="complexity-curve ${curve.id === selected ? "selected" : ""}"/>`;
    }).join("");

    svg.innerHTML = `
      <line x1="52" y1="25" x2="52" y2="320" class="complexity-axis"/>
      <line x1="52" y1="320" x2="726" y2="320" class="complexity-axis"/>
      ${grid}
      ${paths}
      <line x1="${markerX}" y1="25" x2="${markerX}" y2="320" class="complexity-marker"/>
      <text x="${Math.min(700, markerX + 8)}" y="42" class="complexity-marker-label">n=${n}</text>
      <text x="389" y="350" text-anchor="middle" class="complexity-axis-text">Input size n</text>`;

    table.innerHTML = curves.map(curve => {
      const work = curve.value(n);
      return `<button type="button" class="complexity-row ${curve.id === selected ? "selected" : ""}" data-complexity="${curve.id}">
        <span><strong>${curve.notation}</strong><small>${curve.label}</small></span>
        <b>${formatWork(work)}</b>
      </button>`;
    }).join("");

    const active = curves.find(curve => curve.id === selected)!;
    whyTitle.textContent = `${active.notation} — ${active.label}`;
    why.textContent = `${active.description} Example: ${examples[active.id]}. At n=${n}, the simplified work estimate is about ${formatWork(active.value(n))} operations.`;

    table.querySelectorAll<HTMLButtonElement>("[data-complexity]").forEach(button => button.addEventListener("click", () => {
      selected = button.dataset.complexity as CurveId;
      draw();
    }));
  };

  slider.addEventListener("input", draw);
  host.querySelector("#complexityReset")!.addEventListener("click", () => {
    stopRace();
    slider.value = "24";
    selected = "nlogn";
    draw();
  });
  raceButton.addEventListener("click", () => {
    if (raceTimer !== null) return stopRace();
    slider.value = "2";
    raceButton.textContent = "Stop Race";
    draw();
    raceTimer = window.setInterval(() => {
      const next = Number(slider.value) + 1;
      if (next > 100) return stopRace();
      slider.value = String(next);
      draw();
    }, 75);
  });

  draw();

  const overlay = document.querySelector<HTMLElement>(".lab-overlay");
  const cleanupObserver = new MutationObserver(() => {
    if (!overlay || overlay.hidden || !host.isConnected) stopRace();
  });
  if (overlay) cleanupObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
}

function installComplexityCard(): void {
  const overlay = document.querySelector<HTMLElement>(".lab-overlay");
  const body = overlay?.querySelector<HTMLElement>(".lab-body");
  const heading = overlay?.querySelector<HTMLHeadingElement>("h2");
  const back = overlay?.querySelector<HTMLButtonElement>(".lab-back");
  if (!overlay || !body || !heading || !back) return;

  const addCard = () => {
    const grid = body.querySelector<HTMLElement>(".lab-home-grid");
    if (!grid || grid.querySelector("[data-advanced-module='complexity']")) return;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "lab-card lab-card-featured";
    card.dataset.advancedModule = "complexity";
    card.innerHTML = `<span class="lab-icon">O(n)</span><h3>Complexity & Big-O</h3><p>Experiment with input size and see O(1), O(log n), O(n), O(n log n), O(n²), and O(2ⁿ) pull apart.</p>`;
    card.addEventListener("click", () => {
      back.hidden = false;
      heading.textContent = "Complexity & Big-O";
      body.replaceChildren();
      const host = document.createElement("div");
      body.append(host);
      renderComplexity(host);
    });
    grid.append(card);
  };

  const observer = new MutationObserver(addCard);
  observer.observe(body, { childList: true, subtree: true });
  addCard();
}

installComplexityCard();
