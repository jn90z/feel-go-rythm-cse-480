import "./cpuSchedulingLab.css";
import { registerLabModule } from "./moduleRegistry";
import {
  compareSchedulingPolicies,
  parseJobRows,
  simulateScheduling,
  type SchedulingPolicy,
  type SchedulingResult,
  type SchedulingSlot
} from "./cpuSchedulingModel";

const policyNames: Record<SchedulingPolicy, string> = {
  fcfs: "First Come First Served",
  sjf: "Shortest Job First",
  srtf: "Shortest Remaining Time First",
  rr: "Round Robin"
};

const playbackDelays: Record<string, number> = {
  "0.5": 1100,
  "1": 650,
  "2": 325,
  "4": 160
};

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

registerLabModule({
  id: "cpu-scheduling-metrics",
  icon: "CPU",
  title: "CPU Scheduling Metrics",
  description: "Predict the next CPU owner, scrub through FCFS, SJF, SRTF, and Round Robin schedules, and compare waiting, turnaround, response, utilization, and context switches.",
  featured: true,
  render(host) {
    host.innerHTML = `
      <div class="cpu-scheduling-lab">
        <div class="cpu-scheduling-controls">
          <label>Policy
            <select data-cpu-policy>
              <option value="fcfs">First Come First Served</option>
              <option value="sjf">Shortest Job First</option>
              <option value="srtf">Shortest Remaining Time First</option>
              <option value="rr">Round Robin</option>
            </select>
          </label>
          <label>Round Robin quantum
            <input data-cpu-quantum type="number" min="1" max="20" value="2">
          </label>
          <label>Jobs: ID, arrival, burst
            <textarea data-cpu-jobs aria-label="CPU jobs as ID arrival burst">A, 0, 6\nB, 1, 3\nC, 2, 1\nD, 4, 4</textarea>
          </label>
          <button type="button" data-cpu-build>Build Schedule</button>
          <button type="button" data-cpu-prev>Previous</button>
          <button type="button" data-cpu-next>Next</button>
          <button type="button" data-cpu-play>Play</button>
          <label>Speed
            <select data-cpu-speed aria-label="CPU scheduling playback speed">
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
            </select>
          </label>
        </div>
        <div class="cpu-scheduling-presets" aria-label="CPU scheduling examples">
          <button type="button" data-cpu-preset="convoy">Convoy Effect</button>
          <button type="button" data-cpu-preset="preempt">Preemption Demo</button>
          <button type="button" data-cpu-preset="fair">Round Robin Demo</button>
          <button type="button" data-cpu-compare>Compare All Policies</button>
        </div>
        <div class="cpu-scheduling-metrics" data-cpu-metrics aria-live="polite"></div>
        <div class="cpu-scheduling-layout">
          <section class="cpu-scheduling-panel">
            <div class="cpu-panel-heading">
              <strong>Gantt timeline</strong>
              <span class="cpu-time-label" data-cpu-time></span>
            </div>
            <div class="cpu-gantt" data-cpu-gantt></div>
            <div class="cpu-scrubber-row">
              <span>Start</span>
              <input data-cpu-scrub type="range" min="0" value="0" aria-label="Scrub CPU scheduling timeline">
              <span data-cpu-scrub-label>0/0</span>
            </div>
            <div class="cpu-step-strip" data-cpu-steps></div>
            <div class="cpu-explain" data-cpu-explain aria-live="polite"></div>
            <div class="cpu-state-board">
              <div><small>Running</small><strong data-cpu-running>—</strong></div>
              <div><small>Ready queue</small><div class="cpu-ready-chips" data-cpu-ready></div></div>
            </div>
            <div class="cpu-prediction" data-cpu-prediction>
              <strong>Predict the scheduler</strong>
              <p class="lab-note" data-cpu-predict-prompt>Before stepping forward, predict which process gets the CPU next.</p>
              <div class="cpu-predict-options" data-cpu-predict-options></div>
              <p class="cpu-predict-feedback" data-cpu-predict-feedback aria-live="polite"></p>
            </div>
          </section>
          <section class="cpu-scheduling-panel">
            <strong>Per-process metrics</strong>
            <div data-cpu-table></div>
          </section>
        </div>
        <section class="cpu-scheduling-panel">
          <strong>Policy comparison</strong>
          <p class="lab-note">Run all four policies on the exact same workload. Lower waiting time is highlighted, but response time, fairness, context switches, and preemption trade off against one another.</p>
          <div class="cpu-policy-cards" data-cpu-comparison></div>
        </section>
      </div>`;

    const policySelect = host.querySelector<HTMLSelectElement>("[data-cpu-policy]")!;
    const quantumInput = host.querySelector<HTMLInputElement>("[data-cpu-quantum]")!;
    const jobsInput = host.querySelector<HTMLTextAreaElement>("[data-cpu-jobs]")!;
    const speedSelect = host.querySelector<HTMLSelectElement>("[data-cpu-speed]")!;
    const metrics = host.querySelector<HTMLElement>("[data-cpu-metrics]")!;
    const gantt = host.querySelector<HTMLElement>("[data-cpu-gantt]")!;
    const steps = host.querySelector<HTMLElement>("[data-cpu-steps]")!;
    const explain = host.querySelector<HTMLElement>("[data-cpu-explain]")!;
    const ready = host.querySelector<HTMLElement>("[data-cpu-ready]")!;
    const running = host.querySelector<HTMLElement>("[data-cpu-running]")!;
    const timeLabel = host.querySelector<HTMLElement>("[data-cpu-time]")!;
    const scrub = host.querySelector<HTMLInputElement>("[data-cpu-scrub]")!;
    const scrubLabel = host.querySelector<HTMLElement>("[data-cpu-scrub-label]")!;
    const table = host.querySelector<HTMLElement>("[data-cpu-table]")!;
    const comparison = host.querySelector<HTMLElement>("[data-cpu-comparison]")!;
    const predictPrompt = host.querySelector<HTMLElement>("[data-cpu-predict-prompt]")!;
    const predictOptions = host.querySelector<HTMLElement>("[data-cpu-predict-options]")!;
    const predictFeedback = host.querySelector<HTMLElement>("[data-cpu-predict-feedback]")!;
    const playButton = host.querySelector<HTMLButtonElement>("[data-cpu-play]")!;

    let result: SchedulingResult = simulateScheduling(parseJobRows(jobsInput.value), "fcfs", 2);
    let index = -1;
    let timer: number | null = null;
    let predictionForIndex = -1;

    const stop = (): void => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      playButton.textContent = "Play";
    };

    const fmt = (value: number): string => value.toFixed(2).replace(/\.00$/, "");
    const playbackDelay = (): number => playbackDelays[speedSelect.value] ?? playbackDelays["1"];

    function createChip(text: string, good = false): HTMLElement {
      return textElement("span", text, `cpu-scheduling-chip${good ? " good" : ""}`);
    }

    function renderMetrics(): void {
      metrics.replaceChildren(
        createChip(policyNames[result.policy]),
        createChip(`Avg wait: ${fmt(result.averageWaiting)}`),
        createChip(`Avg turnaround: ${fmt(result.averageTurnaround)}`),
        createChip(`Avg response: ${fmt(result.averageResponse)}`),
        createChip(`Switches: ${result.contextSwitches}`),
        createChip(`CPU utilization: ${fmt(result.utilization * 100)}%`, true)
      );
    }

    function renderTable(): void {
      const element = document.createElement("table");
      element.className = "cpu-job-table";
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      ["Job", "Arrive", "Burst", "Response", "Waiting", "Turnaround"].forEach(label => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = label;
        headRow.append(th);
      });
      head.append(headRow);
      const body = document.createElement("tbody");
      result.jobs.forEach(job => {
        const row = document.createElement("tr");
        [job.id, job.arrival, job.burst, job.response, job.waiting, job.turnaround].forEach(value => {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          row.append(cell);
        });
        body.append(row);
      });
      element.append(head, body);
      table.replaceChildren(element);
    }

    function renderComparison(): void {
      const jobs = parseJobRows(jobsInput.value);
      const quantum = Number(quantumInput.value) || 2;
      const results = compareSchedulingPolicies(jobs, quantum);
      const bestWaiting = Math.min(...results.map(item => item.averageWaiting));
      comparison.replaceChildren();
      results.forEach(item => {
        const card = document.createElement("div");
        card.className = `cpu-policy-card${item.averageWaiting === bestWaiting ? " best" : ""}`;
        card.append(textElement("strong", policyNames[item.policy]));
        [
          `Avg waiting: ${fmt(item.averageWaiting)}`,
          `Avg turnaround: ${fmt(item.averageTurnaround)}`,
          `Avg response: ${fmt(item.averageResponse)}`,
          `Context switches: ${item.contextSwitches}`,
          `Utilization: ${fmt(item.utilization * 100)}%`
        ].forEach(line => card.append(textElement("span", line)));
        comparison.append(card);
      });
    }

    function renderGantt(): void {
      gantt.replaceChildren();
      result.timeline.forEach((slot, slotIndex) => {
        const block = document.createElement("div");
        block.className = `cpu-slot${slot.jobId === null ? " idle" : ""}${slotIndex === index ? " current" : ""}`;
        if (slotIndex > index) block.classList.add("future");
        block.append(textElement("strong", slot.jobId ?? "idle"), textElement("small", `t=${slot.time}`));
        gantt.append(block);
      });
    }

    function renderStepButtons(): void {
      steps.replaceChildren();
      result.timeline.forEach((slot, slotIndex) => {
        const button = document.createElement("button");
        button.className = `cpu-step-dot${slotIndex === index ? " current" : ""}`;
        button.type = "button";
        button.dataset.cpuStep = String(slotIndex);
        button.setAttribute("aria-label", `Go to time ${slot.time}, ${slot.jobId ?? "CPU idle"}`);
        button.textContent = slot.jobId ?? "–";
        button.addEventListener("click", () => {
          stop();
          index = slotIndex;
          predictionForIndex = -1;
          render();
        });
        steps.append(button);
      });
    }

    function renderState(current: SchedulingSlot | null): void {
      running.textContent = current?.jobId ?? (current ? "idle" : "—");
      ready.replaceChildren();
      if (!current) {
        ready.append(textElement("span", "Step into the schedule to inspect the ready queue.", "lab-note"));
        return;
      }
      if (!current.ready.length) {
        ready.append(textElement("span", "none", "cpu-ready-chip muted"));
        return;
      }
      current.ready.forEach(id => ready.append(textElement("span", id, `cpu-ready-chip${id === current.jobId ? " running" : ""}`)));
    }

    function predictionChoices(next: SchedulingSlot): string[] {
      const choices = new Set(next.ready);
      choices.add(next.jobId ?? "idle");
      return [...choices];
    }

    function renderPrediction(): void {
      const nextIndex = index + 1;
      predictOptions.replaceChildren();
      predictFeedback.textContent = "";
      if (nextIndex >= result.timeline.length) {
        predictPrompt.textContent = "The schedule is complete. Rebuild or load another preset to make another prediction.";
        return;
      }

      const next = result.timeline[nextIndex];
      predictPrompt.textContent = `At t=${next.time}, who gets the CPU next? Use the ready-state and the ${policyNames[result.policy]} rule.`;
      predictionChoices(next).forEach(choice => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = choice;
        button.addEventListener("click", () => {
          const expected = next.jobId ?? "idle";
          predictionForIndex = nextIndex;
          const correct = choice === expected;
          predictFeedback.textContent = correct
            ? `Correct — ${expected} is next. ${next.reason}`
            : `Not this time — ${expected} runs next. ${next.reason}`;
          predictFeedback.className = `cpu-predict-feedback ${correct ? "correct" : "incorrect"}`;
          [...predictOptions.querySelectorAll<HTMLButtonElement>("button")].forEach(option => {
            option.disabled = true;
            if (option.textContent === expected) option.classList.add("answer");
          });
        });
        predictOptions.append(button);
      });
    }

    function render(): void {
      const current = index >= 0 ? result.timeline[index] : null;
      renderMetrics();
      renderGantt();
      renderStepButtons();
      renderState(current);
      renderTable();

      explain.textContent = current?.reason ?? "Choose a policy and step through the timeline. Response time measures how quickly a process first gets CPU time; waiting time measures total ready-queue delay; turnaround measures arrival-to-completion time.";
      timeLabel.textContent = current ? `t=${current.time} of ${result.makespan - 1}` : `Makespan ${result.makespan}`;
      scrub.max = String(result.timeline.length);
      scrub.value = String(index + 1);
      scrubLabel.textContent = `${index + 1}/${result.timeline.length}`;
      if (predictionForIndex !== index + 1) renderPrediction();
      gantt.querySelector(".current")?.scrollIntoView({ block: "nearest", inline: "center" });
      steps.querySelector(".current")?.scrollIntoView({ block: "nearest", inline: "center" });
    }

    function build(): void {
      stop();
      const jobs = parseJobRows(jobsInput.value);
      const policy = policySelect.value as SchedulingPolicy;
      const quantum = Number(quantumInput.value) || 2;
      result = simulateScheduling(jobs, policy, quantum);
      quantumInput.value = String(result.quantum);
      index = -1;
      predictionForIndex = -1;
      comparison.replaceChildren();
      render();
    }

    function advance(): void {
      if (index >= result.timeline.length - 1) return stop();
      index += 1;
      predictionForIndex = -1;
      render();
    }

    function restartTimerIfPlaying(): void {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = window.setInterval(advance, playbackDelay());
    }

    host.querySelector("[data-cpu-build]")!.addEventListener("click", build);
    host.querySelector("[data-cpu-prev]")!.addEventListener("click", () => {
      stop();
      index = Math.max(-1, index - 1);
      predictionForIndex = -1;
      render();
    });
    host.querySelector("[data-cpu-next]")!.addEventListener("click", () => {
      stop();
      index = Math.min(result.timeline.length - 1, index + 1);
      predictionForIndex = -1;
      render();
    });
    scrub.addEventListener("input", () => {
      stop();
      index = Math.max(-1, Math.min(result.timeline.length - 1, Number(scrub.value) - 1));
      predictionForIndex = -1;
      render();
    });
    playButton.addEventListener("click", () => {
      if (timer !== null) return stop();
      if (!result.timeline.length) return;
      if (index >= result.timeline.length - 1) index = -1;
      playButton.textContent = "Pause";
      timer = window.setInterval(advance, playbackDelay());
    });
    speedSelect.addEventListener("change", restartTimerIfPlaying);

    host.querySelectorAll<HTMLButtonElement>("[data-cpu-preset]").forEach(button => button.addEventListener("click", () => {
      const preset = button.dataset.cpuPreset;
      if (preset === "convoy") {
        jobsInput.value = "A, 0, 9\nB, 0, 2\nC, 0, 1";
        policySelect.value = "fcfs";
      } else if (preset === "preempt") {
        jobsInput.value = "A, 0, 8\nB, 2, 2\nC, 3, 1";
        policySelect.value = "srtf";
      } else {
        jobsInput.value = "A, 0, 6\nB, 0, 6\nC, 0, 6";
        policySelect.value = "rr";
        quantumInput.value = "2";
      }
      build();
    }));

    host.querySelector("[data-cpu-compare]")!.addEventListener("click", () => {
      stop();
      renderComparison();
      explain.textContent = "No scheduler is universally best. SJF/SRTF often minimize average waiting time when burst estimates are accurate, while Round Robin trades more context switches for earlier response and fairer time sharing. FCFS is simple but can suffer the convoy effect behind a long job.";
    });
    policySelect.addEventListener("change", build);
    quantumInput.addEventListener("change", build);

    render();
    return stop;
  }
});
