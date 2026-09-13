export type SchedulingPolicy = "fcfs" | "sjf" | "srtf" | "rr";

export interface SchedulingJob {
  id: string;
  arrival: number;
  burst: number;
}

export interface SchedulingSlot {
  time: number;
  jobId: string | null;
  ready: string[];
  reason: string;
}

export interface SchedulingJobMetrics extends SchedulingJob {
  firstStart: number;
  completion: number;
  response: number;
  turnaround: number;
  waiting: number;
}

export interface SchedulingResult {
  policy: SchedulingPolicy;
  quantum: number;
  jobs: SchedulingJobMetrics[];
  timeline: SchedulingSlot[];
  contextSwitches: number;
  averageWaiting: number;
  averageTurnaround: number;
  averageResponse: number;
  makespan: number;
  utilization: number;
}

const MAX_JOBS = 12;
const MAX_TIME = 500;

export function normalizeJobs(input: SchedulingJob[]): SchedulingJob[] {
  const seen = new Map<string, number>();
  return input.slice(0, MAX_JOBS).map((job, index) => {
    const base = job.id.trim() || `P${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return {
      id: count === 1 ? base : `${base}${count}`,
      arrival: Math.max(0, Math.min(MAX_TIME, Math.floor(Number.isFinite(job.arrival) ? job.arrival : 0))),
      burst: Math.max(1, Math.min(100, Math.floor(Number.isFinite(job.burst) ? job.burst : 1)))
    };
  });
}

export function parseJobRows(text: string): SchedulingJob[] {
  const rows = text.split(/\n|;/).map(row => row.trim()).filter(Boolean);
  const jobs = rows.map((row, index) => {
    const [rawId, rawArrival, rawBurst] = row.split(/[\s,]+/);
    return {
      id: rawId || `P${index + 1}`,
      arrival: Number(rawArrival),
      burst: Number(rawBurst)
    };
  }).filter(job => Number.isFinite(job.arrival) && Number.isFinite(job.burst));
  return normalizeJobs(jobs);
}

function compareReady(a: number, b: number, jobs: SchedulingJob[], remaining: number[], policy: SchedulingPolicy): number {
  if (policy === "sjf") return jobs[a].burst - jobs[b].burst || jobs[a].arrival - jobs[b].arrival || a - b;
  if (policy === "srtf") return remaining[a] - remaining[b] || jobs[a].arrival - jobs[b].arrival || a - b;
  return jobs[a].arrival - jobs[b].arrival || a - b;
}

export function simulateScheduling(input: SchedulingJob[], policy: SchedulingPolicy, requestedQuantum = 2): SchedulingResult {
  const jobs = normalizeJobs(input);
  const quantum = Math.max(1, Math.min(20, Math.floor(requestedQuantum) || 2));
  if (!jobs.length) {
    return { policy, quantum, jobs: [], timeline: [], contextSwitches: 0, averageWaiting: 0, averageTurnaround: 0, averageResponse: 0, makespan: 0, utilization: 0 };
  }

  const remaining = jobs.map(job => job.burst);
  const firstStart = Array<number | null>(jobs.length).fill(null);
  const completion = Array<number | null>(jobs.length).fill(null);
  const timeline: SchedulingSlot[] = [];
  const rrQueue: number[] = [];
  const admitted = new Set<number>();
  let current: number | null = null;
  let rrUsed = 0;
  let time = 0;
  let completed = 0;

  while (completed < jobs.length && time < MAX_TIME + jobs.reduce((sum, job) => sum + job.burst, 0) + 100) {
    jobs.forEach((job, index) => {
      if (job.arrival <= time && !admitted.has(index)) {
        admitted.add(index);
        if (policy === "rr") rrQueue.push(index);
      }
    });

    const ready = jobs.map((job, index) => ({ job, index }))
      .filter(({ job, index }) => job.arrival <= time && remaining[index] > 0)
      .map(({ index }) => index);

    if (policy === "rr") {
      if (current === null && rrQueue.length) {
        current = rrQueue.shift()!;
        rrUsed = 0;
      }
    } else if (policy === "srtf") {
      current = ready.length ? [...ready].sort((a, b) => compareReady(a, b, jobs, remaining, policy))[0] : null;
    } else if (current === null && ready.length) {
      current = [...ready].sort((a, b) => compareReady(a, b, jobs, remaining, policy))[0];
    }

    if (current === null) {
      timeline.push({ time, jobId: null, ready: [], reason: "No process has arrived yet, so the CPU is idle." });
      time += 1;
      continue;
    }

    if (firstStart[current] === null) firstStart[current] = time;
    const currentId = jobs[current].id;
    const readyIds = ready.map(index => jobs[index].id);
    const reason = policy === "fcfs"
      ? `${currentId} runs because FCFS keeps the earliest-arriving ready process until it finishes.`
      : policy === "sjf"
        ? `${currentId} runs because it has the shortest burst among ready processes; SJF is non-preemptive.`
        : policy === "srtf"
          ? `${currentId} runs because it has the shortest remaining CPU time among ready processes.`
          : `${currentId} gets CPU time from the Round Robin queue (quantum ${quantum}).`;
    timeline.push({ time, jobId: currentId, ready: readyIds, reason });

    remaining[current] -= 1;
    rrUsed += 1;
    time += 1;

    if (remaining[current] === 0) {
      completion[current] = time;
      completed += 1;
      current = null;
      rrUsed = 0;
    } else if (policy === "rr" && rrUsed >= quantum) {
      jobs.forEach((job, index) => {
        if (job.arrival <= time && !admitted.has(index)) {
          admitted.add(index);
          rrQueue.push(index);
        }
      });
      rrQueue.push(current);
      current = null;
      rrUsed = 0;
    }
  }

  const metrics: SchedulingJobMetrics[] = jobs.map((job, index) => {
    const start = firstStart[index] ?? job.arrival;
    const done = completion[index] ?? time;
    const turnaround = done - job.arrival;
    return {
      ...job,
      firstStart: start,
      completion: done,
      response: start - job.arrival,
      turnaround,
      waiting: turnaround - job.burst
    };
  });

  let contextSwitches = 0;
  let previous: string | null = null;
  for (const slot of timeline) {
    if (slot.jobId === null) {
      previous = null;
      continue;
    }
    if (previous !== null && previous !== slot.jobId) contextSwitches += 1;
    previous = slot.jobId;
  }

  const average = (key: "waiting" | "turnaround" | "response") => metrics.reduce((sum, job) => sum + job[key], 0) / metrics.length;
  const busy = timeline.filter(slot => slot.jobId !== null).length;
  return {
    policy,
    quantum,
    jobs: metrics,
    timeline,
    contextSwitches,
    averageWaiting: average("waiting"),
    averageTurnaround: average("turnaround"),
    averageResponse: average("response"),
    makespan: timeline.length,
    utilization: timeline.length ? busy / timeline.length : 0
  };
}

export function compareSchedulingPolicies(input: SchedulingJob[], quantum = 2): SchedulingResult[] {
  return (["fcfs", "sjf", "srtf", "rr"] as SchedulingPolicy[]).map(policy => simulateScheduling(input, policy, quantum));
}
