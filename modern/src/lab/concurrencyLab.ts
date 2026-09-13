import "./concurrencyLab.css";
import { registerLabModule } from "./moduleRegistry";
import {
  classicLostUpdateSchedule,
  normalizeSchedule,
  runConcurrencySchedule,
  serialSchedule,
  type ConcurrencyMode,
  type ConcurrencyTrace,
  type ThreadId
} from "./concurrencyModel";

registerLabModule({
  id: "thread-interleavings",
  icon: "A⇄B",
  title: "Thread Interleavings",
  description: "Force context switches instruction-by-instruction, reproduce lost updates, then see exactly how a mutex prevents them.",
  featured: true,
  render(host) {
    host.innerHTML = `
      <div class="concurrency-lab">
        <div class="concurrency-controls">
          <label>Mode
            <select data-concurrency-mode>
              <option value="unsafe">No synchronization</option>
              <option value="mutex">Mutex protected</option>
            </select>
          </label>
          <label>Thread schedule
            <input data-concurrency-schedule value="ABABAB" maxlength="60" aria-label="Thread schedule using A and B">
          </label>
          <button type="button" data-concurrency-build>Build Trace</button>
          <button type="button" data-concurrency-prev>Previous</button>
          <button type="button" data-concurrency-next>Next</button>
          <button type="button" data-concurrency-play>Play</button>
        </div>
        <div class="concurrency-presets">
          <button type="button" data-preset="lost">Lost Update Demo</button>
          <button type="button" data-preset="serial">Serial Demo</button>
          <button type="button" data-concurrency-compare>Compare Unsafe vs Mutex</button>
        </div>
        <div class="concurrency-metrics" data-concurrency-metrics aria-live="polite"></div>
        <div class="concurrency-layout">
          <section class="concurrency-panel">
            <div class="concurrency-memory">
              <div class="concurrency-box" data-thread="A"><strong>Thread A</strong><div class="concurrency-thread-state" data-thread-a></div></div>
              <div class="concurrency-box"><strong>Shared counter</strong><div class="concurrency-counter" data-counter>0</div><div class="concurrency-lock" data-lock>mutex: off</div></div>
              <div class="concurrency-box" data-thread="B"><strong>Thread B</strong><div class="concurrency-thread-state" data-thread-b></div></div>
            </div>
            <div class="concurrency-explain" data-concurrency-explain aria-live="polite"></div>
            <p class="concurrency-schedule" data-concurrency-sequence></p>
          </section>
          <section class="concurrency-panel">
            <strong>Execution trace</strong>
            <div class="concurrency-trace" data-concurrency-trace></div>
          </section>
        </div>
      </div>`;

    const modeSelect = host.querySelector<HTMLSelectElement>("[data-concurrency-mode]")!;
    const scheduleInput = host.querySelector<HTMLInputElement>("[data-concurrency-schedule]")!;
    const metrics = host.querySelector<HTMLElement>("[data-concurrency-metrics]")!;
    const explain = host.querySelector<HTMLElement>("[data-concurrency-explain]")!;
    const sequence = host.querySelector<HTMLElement>("[data-concurrency-sequence]")!;
    const traceElement = host.querySelector<HTMLElement>("[data-concurrency-trace]")!;
    const counterElement = host.querySelector<HTMLElement>("[data-counter]")!;
    const lockElement = host.querySelector<HTMLElement>("[data-lock]")!;
    const threadAElement = host.querySelector<HTMLElement>("[data-thread-a]")!;
    const threadBElement = host.querySelector<HTMLElement>("[data-thread-b]")!;
    const threadABox = host.querySelector<HTMLElement>("[data-thread='A']")!;
    const threadBBox = host.querySelector<HTMLElement>("[data-thread='B']")!;
    const playButton = host.querySelector<HTMLButtonElement>("[data-concurrency-play]")!;

    let trace: ConcurrencyTrace = runConcurrencySchedule(classicLostUpdateSchedule(), "unsafe");
    let index = -1;
    let timer: number | null = null;

    const stop = (): void => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      playButton.textContent = "Play";
    };

    function stateText(thread: ThreadId, stepIndex: number): string {
      if (stepIndex < 0) return "phase=read · local=—";
      const state = trace.steps[stepIndex].threads[thread];
      return `phase=${state.phase} · local=${state.local ?? "—"}`;
    }

    function render(): void {
      const step = index >= 0 ? trace.steps[index] : null;
      const final = index >= trace.steps.length - 1 && trace.steps.length > 0;
      counterElement.textContent = String(step?.counter ?? 0);
      lockElement.textContent = trace.mode === "mutex"
        ? `mutex: ${step?.lockOwner ? `Thread ${step.lockOwner}` : "unlocked"}`
        : "mutex: disabled";
      threadAElement.textContent = stateText("A", index);
      threadBElement.textContent = stateText("B", index);
      threadABox.classList.toggle("active", step?.scheduled === "A" && !step.blocked);
      threadBBox.classList.toggle("active", step?.scheduled === "B" && !step.blocked);
      threadABox.classList.toggle("blocked", step?.scheduled === "A" && Boolean(step.blocked));
      threadBBox.classList.toggle("blocked", step?.scheduled === "B" && Boolean(step.blocked));

      sequence.textContent = `Scheduler choices: ${trace.schedule.join(" → ") || "none"}`;
      if (!step) {
        explain.textContent = "The shared counter starts at 0. Each thread must READ the counter, INCREMENT its private copy, then WRITE that copy back. Step through the scheduler choices to see where context switches matter.";
      } else {
        explain.textContent = `Step ${index + 1}: ${step.message}`;
      }

      const shownCounter = step?.counter ?? 0;
      const shownCompleted = step
        ? Number(step.threads.A.phase === "done") + Number(step.threads.B.phase === "done")
        : 0;
      metrics.innerHTML = `
        <span class="concurrency-chip">Mode: ${trace.mode === "mutex" ? "Mutex" : "Unsafe"}</span>
        <span class="concurrency-chip">Counter: ${shownCounter}</span>
        <span class="concurrency-chip">Completed: ${shownCompleted}/2</span>
        ${final ? `<span class="concurrency-chip ${trace.lostUpdate ? "bad" : trace.completedThreads === 2 ? "good" : ""}">${trace.lostUpdate ? "Lost update detected" : trace.completedThreads === 2 ? "Both increments preserved" : "Schedule ended early"}</span>` : ""}`;

      traceElement.innerHTML = trace.steps.map((item, itemIndex) => `
        <div class="concurrency-step ${itemIndex === index ? "current" : ""} ${item.blocked ? "blocked" : ""}">
          <small>#${itemIndex + 1}</small><strong>Thread ${item.scheduled}</strong><span>${item.action}</span>
        </div>`).join("");
      traceElement.querySelector(".current")?.scrollIntoView({ block: "nearest" });
    }

    function build(): void {
      stop();
      const schedule = normalizeSchedule(scheduleInput.value);
      scheduleInput.value = schedule.join("");
      trace = runConcurrencySchedule(schedule, modeSelect.value as ConcurrencyMode);
      index = -1;
      render();
    }

    function usePreset(kind: string): void {
      const schedule = kind === "serial" ? serialSchedule() : classicLostUpdateSchedule();
      scheduleInput.value = schedule.join("");
      modeSelect.value = "unsafe";
      build();
    }

    host.querySelector("[data-concurrency-build]")!.addEventListener("click", build);
    host.querySelector("[data-concurrency-prev]")!.addEventListener("click", () => { stop(); index = Math.max(-1, index - 1); render(); });
    host.querySelector("[data-concurrency-next]")!.addEventListener("click", () => { stop(); index = Math.min(trace.steps.length - 1, index + 1); render(); });
    playButton.addEventListener("click", () => {
      if (timer !== null) return stop();
      if (index >= trace.steps.length - 1) index = -1;
      playButton.textContent = "Pause";
      timer = window.setInterval(() => {
        if (index >= trace.steps.length - 1) return stop();
        index += 1;
        render();
      }, 650);
    });
    host.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach(button => button.addEventListener("click", () => usePreset(button.dataset.preset ?? "lost")));
    host.querySelector("[data-concurrency-compare]")!.addEventListener("click", () => {
      stop();
      const base = classicLostUpdateSchedule();
      const unsafe = runConcurrencySchedule(base, "unsafe");
      const mutexSchedule = [...base, "A", "A", "B", "B", "B"] as ThreadId[];
      const safe = runConcurrencySchedule(mutexSchedule, "mutex");
      explain.textContent = `Same adversarial idea, different protection: unsafe execution finishes at ${unsafe.finalCounter} because both threads read 0 before either write. With a mutex, competing turns block until the owner finishes its read-modify-write critical section, preserving counter = ${safe.finalCounter}.`;
      metrics.innerHTML = `<span class="concurrency-chip bad">Unsafe: counter ${unsafe.finalCounter}</span><span class="concurrency-chip good">Mutex: counter ${safe.finalCounter}</span><span class="concurrency-chip">Blocked mutex turns: ${safe.steps.filter(step => step.blocked).length}</span>`;
    });
    modeSelect.addEventListener("change", build);

    render();
    return stop;
  }
});
