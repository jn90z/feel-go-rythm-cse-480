import "./cpuSchedulingLab.css";
import { registerLabModule } from "./moduleRegistry";
import {
  compareSchedulingPolicies,
  parseJobRows,
  simulateScheduling,
  type SchedulingPolicy,
  type SchedulingResult
} from "./cpuSchedulingModel";

const policyNames: Record<SchedulingPolicy, string> = {
  fcfs: "First Come First Served",
  sjf: "Shortest Job First",
  srtf: "Shortest Remaining Time First",
  rr: "Round Robin"
};

registerLabModule({
  id: "cpu-scheduling-metrics",
  icon: "CPU",
  title: "CPU Scheduling Metrics",
  description: "Compare FCFS, SJF, SRTF, and Round Robin with arrivals, Gantt playback, waiting/turnaround/response time, utilization, and context switches.",
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
        </div>
        <div class="cpu-scheduling-presets">
          <button type="button" data-cpu-preset="convoy">Convoy Effect</button>
          <button type="button" data-cpu-preset="preempt">Preemption Demo</button>
          <button type="button" data-cpu-preset="fair">Round Robin Demo</button>
          <button type="button" data-cpu-compare>Compare All Policies</button>
        </div>
        <div class="cpu-scheduling-metrics" data-cpu-metrics aria-live="polite"></div>
        <div class="cpu-scheduling-layout">
          <section class="cpu-scheduling-panel">
            <strong>Gantt timeline</strong>
            <div class="cpu-gantt" data-cpu-gantt></div>
            <div class="cpu-step-strip" data-cpu-steps></div>
            <div class="cpu-explain" data-cpu-explain aria-live="polite"></div>
            <div class="cpu-ready" data-cpu-ready></div>
          </section>
          <section class="cpu-scheduling-panel">
            <strong>Per-process metrics</strong>
            <div data-cpu-table></div>
          </section>
        </div>
        <section class="cpu-scheduling-panel">
          <strong>Policy comparison</strong>
          <div class="cpu-policy-cards" data-cpu-comparison></div>
        </section>
      </div>`;

    const policySelect = host.querySelector<HTMLSelectElement>("[data-cpu-policy]")!;
    const quantumInput = host.querySelector<HTMLInputElement>("[data-cpu-quantum]")!;
    const jobsInput = host.querySelector<HTMLTextAreaElement>("[data-cpu-jobs]")!;
    const metrics = host.querySelector<HTMLElement>("[data-cpu-metrics]")!;
    const gantt = host.querySelector<HTMLElement>("[data-cpu-gantt]")!;
    const steps = host.querySelector<HTMLElement>("[data-cpu-steps]")!;
    const explain = host.querySelector<HTMLElement>("[data-cpu-explain]")!;
    const ready = host.querySelector<HTMLElement>("[data-cpu-ready]")!;
    const table = host.querySelector<HTMLElement>("[data-cpu-table]")!;
    const comparison = host.querySelector<HTMLElement>("[data-cpu-comparison]")!;
    const playButton = host.querySelector<HTMLButtonElement>("[data-cpu-play]")!;

    let result: SchedulingResult = simulateScheduling(parseJobRows(jobsInput.value), "fcfs", 2);
    let index = -1;
    let timer: number | null = null;

    const stop = (): void => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      playButton.textContent = "Play";
    };

    const fmt = (value: number): string => value.toFixed(2).replace(/\.00$/, "");

    function renderTable(): void {
      table.innerHTML = `<table class="cpu-job-table">
        <thead><tr><th>Job</th><th>Arrive</th><th>Burst</th><th>Response</th><th>Waiting</th><th>Turnaround</th></tr></thead>
        <tbody>${result.jobs.map(job => `<tr><td>${job.id}</td><td>${job.arrival}</td><td>${job.burst}</td><td>${job.response}</td><td>${job.waiting}</td><td>${job.turnaround}</td></tr>`).join("")}</tbody>
      </table>`;
    }

    function renderComparison(): void {
      const jobs = parseJobRows(jobsInput.value);
      const quantum = Number(quantumInput.value) || 2;
      const results = compareSchedulingPolicies(jobs, quantum);
      const bestWaiting = Math.min(...results.map(item => item.averageWaiting));
      comparison.innerHTML = results.map(item => `
        <div class="cpu-policy-card ${item.averageWaiting === bestWaiting ? "best" : ""}">
          <strong>${policyNames[item.policy]}</strong>
          <span>Avg waiting: ${fmt(item.averageWaiting)}</span>
          <span>Avg turnaround: ${fmt(item.averageTurnaround)}</span>
          <span>Avg response: ${fmt(item.averageResponse)}</span>
          <span>Context switches: ${item.contextSwitches}</span>
          <span>Utilization: ${fmt(item.utilization * 100)}%</span>
        </div>`).join("");
    }

    function render(): void {
      const current = index >= 0 ? result.timeline[index] : null;
      metrics.innerHTML = `
        <span class="cpu-scheduling-chip">${policyNames[result.policy]}</span>
        <span class="cpu-scheduling-chip">Avg wait: ${fmt(result.averageWaiting)}</span>
        <span class="cpu-scheduling-chip">Avg turnaround: ${fmt(result.averageTurnaround)}</span>
        <span class="cpu-scheduling-chip">Avg response: ${fmt(result.averageResponse)}</span>
        <span class="cpu-scheduling-chip">Switches: ${result.contextSwitches}</span>
        <span class="cpu-scheduling-chip good">CPU utilization: ${fmt(result.utilization * 100)}%</span>`;

      gantt.innerHTML = result.timeline.map((slot, slotIndex) => `<div class="cpu-slot ${slot.jobId === null ? "idle" : ""} ${slotIndex === index ? "current" : ""}"><strong>${slot.jobId ?? "idle"}</strong><small>t=${slot.time}</small></div>`).join("");
      steps.innerHTML = result.timeline.map((slot, slotIndex) => `<button class="cpu-step-dot ${slotIndex === index ? "current" : ""}" type="button" data-cpu-step="${slotIndex}" aria-label="Go to time ${slot.time}">${slot.jobId ?? "–"}</button>`).join("");
      steps.querySelectorAll<HTMLButtonElement>("[data-cpu-step]").forEach(button => button.addEventListener("click", () => {
        stop();
        index = Number(button.dataset.cpuStep);
        render();
      }));
      explain.textContent = current?.reason ?? "Choose a policy and step through the timeline. Response time measures how quickly a process first gets CPU time; waiting time measures total ready-queue delay; turnaround measures arrival-to-completion time.";
      ready.textContent = current ? `Ready at t=${current.time}: ${current.ready.join(", ") || "none"}` : `Makespan: ${result.makespan} time units`;
      renderTable();
      gantt.querySelector(".current")?.scrollIntoView({ block: "nearest", inline: "center" });
    }

    function build(): void {
      stop();
      const jobs = parseJobRows(jobsInput.value);
      const policy = policySelect.value as SchedulingPolicy;
      const quantum = Number(quantumInput.value) || 2;
      result = simulateScheduling(jobs, policy, quantum);
      index = -1;
      comparison.replaceChildren();
      render();
    }

    host.querySelector("[data-cpu-build]")!.addEventListener("click", build);
    host.querySelector("[data-cpu-prev]")!.addEventListener("click", () => { stop(); index = Math.max(-1, index - 1); render(); });
    host.querySelector("[data-cpu-next]")!.addEventListener("click", () => { stop(); index = Math.min(result.timeline.length - 1, index + 1); render(); });
    playButton.addEventListener("click", () => {
      if (timer !== null) return stop();
      if (!result.timeline.length) return;
      if (index >= result.timeline.length - 1) index = -1;
      playButton.textContent = "Pause";
      timer = window.setInterval(() => {
        if (index >= result.timeline.length - 1) return stop();
        index += 1;
        render();
      }, 650);
    });

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
