import "./deadlockLab.css";
import { registerLabModule } from "./moduleRegistry";
import {
  deadlockDemoSchedule,
  normalizeDeadlockSchedule,
  safeOrderingSchedule,
  simulateDeadlock,
  type DeadlockStrategy,
  type DeadlockTrace
} from "./deadlockModel";

registerLabModule({
  id: "deadlocks",
  icon: "🔒↔🔒",
  title: "Deadlocks & Lock Ordering",
  description: "Create a circular wait between two threads, inspect the wait-for graph, then prevent the deadlock with a global lock order.",
  featured: true,
  render(host) {
    host.innerHTML = `
      <div class="deadlock-lab">
        <div class="deadlock-controls">
          <label>Lock strategy
            <select data-deadlock-strategy>
              <option value="opposite-order">Opposite lock order</option>
              <option value="global-order">Global order: R1 → R2</option>
            </select>
          </label>
          <label>Thread schedule
            <input data-deadlock-schedule value="ABAB" maxlength="80" aria-label="Thread schedule using A and B">
          </label>
          <button type="button" data-deadlock-build>Build Trace</button>
          <button type="button" data-deadlock-prev>Previous</button>
          <button type="button" data-deadlock-next>Next</button>
          <button type="button" data-deadlock-play>Play</button>
        </div>
        <div class="deadlock-presets">
          <button type="button" data-deadlock-preset="deadlock">Create Deadlock</button>
          <button type="button" data-deadlock-preset="safe">Prevent With Lock Ordering</button>
          <button type="button" data-deadlock-compare>Compare Strategies</button>
        </div>
        <div class="deadlock-metrics" data-deadlock-metrics aria-live="polite"></div>
        <div class="deadlock-layout">
          <section class="deadlock-panel">
            <strong>Resources and threads</strong>
            <div class="deadlock-resources">
              <div class="deadlock-resource" data-resource="R1"><strong>Resource R1</strong><div data-r1-owner>owner: none</div></div>
              <div class="deadlock-resource" data-resource="R2"><strong>Resource R2</strong><div data-r2-owner>owner: none</div></div>
            </div>
            <div class="deadlock-threads">
              <div class="deadlock-thread" data-thread="A"><strong>Thread A</strong><div data-thread-a></div></div>
              <div class="deadlock-thread" data-thread="B"><strong>Thread B</strong><div data-thread-b></div></div>
            </div>
            <div class="deadlock-explain" data-deadlock-explain aria-live="polite"></div>
            <p class="deadlock-schedule" data-deadlock-sequence></p>
          </section>
          <section class="deadlock-panel">
            <strong>Wait-for graph</strong>
            <div class="deadlock-graph" data-deadlock-graph></div>
            <div class="deadlock-legend">An arrow A → B means Thread A is blocked waiting for a resource currently owned by Thread B. A cycle means deadlock.</div>
            <strong>Execution trace</strong>
            <div class="deadlock-trace" data-deadlock-trace></div>
          </section>
        </div>
      </div>`;

    const strategySelect = host.querySelector<HTMLSelectElement>("[data-deadlock-strategy]")!;
    const scheduleInput = host.querySelector<HTMLInputElement>("[data-deadlock-schedule]")!;
    const metrics = host.querySelector<HTMLElement>("[data-deadlock-metrics]")!;
    const explain = host.querySelector<HTMLElement>("[data-deadlock-explain]")!;
    const sequence = host.querySelector<HTMLElement>("[data-deadlock-sequence]")!;
    const graph = host.querySelector<HTMLElement>("[data-deadlock-graph]")!;
    const traceElement = host.querySelector<HTMLElement>("[data-deadlock-trace]")!;
    const playButton = host.querySelector<HTMLButtonElement>("[data-deadlock-play]")!;
    const r1Owner = host.querySelector<HTMLElement>("[data-r1-owner]")!;
    const r2Owner = host.querySelector<HTMLElement>("[data-r2-owner]")!;
    const threadA = host.querySelector<HTMLElement>("[data-thread-a]")!;
    const threadB = host.querySelector<HTMLElement>("[data-thread-b]")!;
    const resourceR1 = host.querySelector<HTMLElement>("[data-resource='R1']")!;
    const resourceR2 = host.querySelector<HTMLElement>("[data-resource='R2']")!;
    const threadABox = host.querySelector<HTMLElement>("[data-thread='A']")!;
    const threadBBox = host.querySelector<HTMLElement>("[data-thread='B']")!;

    let trace: DeadlockTrace = simulateDeadlock("opposite-order", deadlockDemoSchedule());
    let index = -1;
    let timer: number | null = null;

    const stop = (): void => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      playButton.textContent = "Play";
    };

    const ownerText = (owner: "A" | "B" | null): string => `owner: ${owner ? `Thread ${owner}` : "none"}`;
    const threadText = (thread: "A" | "B"): string => {
      if (index < 0) return "held: none · waiting: no · status: ready";
      const state = trace.steps[index].threads[thread];
      return `held: ${state.held.join(", ") || "none"} · waiting: ${state.waitingFor ?? "no"} · status: ${state.done ? "done" : state.waitingFor ? "blocked" : "runnable"}`;
    };

    function renderGraph(): void {
      const edges = index >= 0 ? trace.steps[index].waitForEdges : [];
      graph.innerHTML = `<svg viewBox="0 0 420 230" role="img" aria-label="Wait-for graph">
        <defs><marker id="deadlock-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#d66565"/></marker></defs>
        ${edges.map(([from, to]) => from === "A"
          ? `<line class="deadlock-edge" x1="145" y1="115" x2="275" y2="115"/>`
          : `<path class="deadlock-edge" d="M275 135 C230 195 190 195 145 135" fill="none"/>`).join("")}
        <circle class="deadlock-node" cx="110" cy="115" r="38"/><text x="110" y="121" text-anchor="middle" fill="white" font-size="22">A</text>
        <circle class="deadlock-node" cx="310" cy="115" r="38"/><text x="310" y="121" text-anchor="middle" fill="white" font-size="22">B</text>
      </svg>`;
    }

    function render(): void {
      const step = index >= 0 ? trace.steps[index] : null;
      r1Owner.textContent = ownerText(step?.resources.R1.owner ?? null);
      r2Owner.textContent = ownerText(step?.resources.R2.owner ?? null);
      threadA.textContent = threadText("A");
      threadB.textContent = threadText("B");
      resourceR1.classList.toggle("owned", Boolean(step?.resources.R1.owner));
      resourceR2.classList.toggle("owned", Boolean(step?.resources.R2.owner));
      threadABox.classList.toggle("waiting", Boolean(step?.threads.A.waitingFor));
      threadBBox.classList.toggle("waiting", Boolean(step?.threads.B.waitingFor));
      sequence.textContent = `Scheduler choices: ${trace.schedule.join(" → ") || "none"}`;
      explain.textContent = step?.message ?? "A deadlock needs four ingredients: mutual exclusion, hold-and-wait, no forced preemption, and circular wait. Step through the schedule to watch the circular wait appear.";

      const final = index >= trace.steps.length - 1 && trace.steps.length > 0;
      metrics.innerHTML = `
        <span class="deadlock-chip">Strategy: ${trace.strategy === "global-order" ? "Global R1 → R2" : "Opposite order"}</span>
        <span class="deadlock-chip">Step: ${Math.max(0, index + 1)} / ${trace.steps.length}</span>
        ${step?.threads.A.waitingFor || step?.threads.B.waitingFor ? `<span class="deadlock-chip">Blocked thread present</span>` : ""}
        ${final ? `<span class="deadlock-chip ${trace.deadlocked ? "bad" : trace.completedThreads === 2 ? "good" : ""}">${trace.deadlocked ? "Deadlock: circular wait" : trace.completedThreads === 2 ? "Both threads completed" : "Schedule ended before completion"}</span>` : ""}`;

      traceElement.innerHTML = trace.steps.map((item, itemIndex) => `
        <div class="deadlock-step ${itemIndex === index ? "current" : ""} ${item.threads[item.scheduled].waitingFor ? "blocked" : ""}">
          <small>#${itemIndex + 1}</small><strong>Thread ${item.scheduled}</strong><span>${item.action}</span>
        </div>`).join("");
      traceElement.querySelector(".current")?.scrollIntoView({ block: "nearest" });
      renderGraph();
    }

    function build(): void {
      stop();
      const schedule = normalizeDeadlockSchedule(scheduleInput.value);
      scheduleInput.value = schedule.join("");
      trace = simulateDeadlock(strategySelect.value as DeadlockStrategy, schedule);
      index = -1;
      render();
    }

    host.querySelector("[data-deadlock-build]")!.addEventListener("click", build);
    host.querySelector("[data-deadlock-prev]")!.addEventListener("click", () => { stop(); index = Math.max(-1, index - 1); render(); });
    host.querySelector("[data-deadlock-next]")!.addEventListener("click", () => { stop(); index = Math.min(trace.steps.length - 1, index + 1); render(); });
    playButton.addEventListener("click", () => {
      if (timer !== null) return stop();
      if (index >= trace.steps.length - 1) index = -1;
      playButton.textContent = "Pause";
      timer = window.setInterval(() => {
        if (index >= trace.steps.length - 1) return stop();
        index += 1;
        render();
      }, 750);
    });

    host.querySelectorAll<HTMLButtonElement>("[data-deadlock-preset]").forEach(button => button.addEventListener("click", () => {
      const safe = button.dataset.deadlockPreset === "safe";
      strategySelect.value = safe ? "global-order" : "opposite-order";
      scheduleInput.value = (safe ? safeOrderingSchedule() : deadlockDemoSchedule()).join("");
      build();
    }));

    host.querySelector("[data-deadlock-compare]")!.addEventListener("click", () => {
      stop();
      const unsafe = simulateDeadlock("opposite-order", deadlockDemoSchedule());
      const safe = simulateDeadlock("global-order", safeOrderingSchedule());
      metrics.innerHTML = `<span class="deadlock-chip bad">Opposite order: deadlock</span><span class="deadlock-chip good">Global order: ${safe.completedThreads}/2 completed</span><span class="deadlock-chip">Unsafe trace: ${unsafe.steps.length} steps</span>`;
      explain.textContent = "The unsafe version creates a cycle: A holds R1 while waiting for R2, and B holds R2 while waiting for R1. Requiring every thread to acquire locks in the same global order removes circular wait, so deadlock cannot form in this two-lock scenario.";
    });
    strategySelect.addEventListener("change", build);

    render();
    return stop;
  }
});
