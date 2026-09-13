export type ThreadId = "A" | "B";
export type ConcurrencyMode = "unsafe" | "mutex";
export type ThreadPhase = "read" | "increment" | "write" | "done";

export interface ThreadState {
  phase: ThreadPhase;
  local: number | null;
}

export interface ConcurrencyStep {
  turn: number;
  scheduled: ThreadId;
  counter: number;
  lockOwner: ThreadId | null;
  threads: Record<ThreadId, ThreadState>;
  action: string;
  message: string;
  blocked: boolean;
}

export interface ConcurrencyTrace {
  mode: ConcurrencyMode;
  schedule: ThreadId[];
  steps: ConcurrencyStep[];
  finalCounter: number;
  completedThreads: number;
  lostUpdate: boolean;
}

function cloneThreads(threads: Record<ThreadId, ThreadState>): Record<ThreadId, ThreadState> {
  return {
    A: { ...threads.A },
    B: { ...threads.B }
  };
}

function other(thread: ThreadId): ThreadId {
  return thread === "A" ? "B" : "A";
}

export function normalizeSchedule(input: string): ThreadId[] {
  return input
    .toUpperCase()
    .split("")
    .filter((value): value is ThreadId => value === "A" || value === "B")
    .slice(0, 60);
}

export function runConcurrencySchedule(schedule: ThreadId[], mode: ConcurrencyMode): ConcurrencyTrace {
  let counter = 0;
  let lockOwner: ThreadId | null = null;
  const threads: Record<ThreadId, ThreadState> = {
    A: { phase: "read", local: null },
    B: { phase: "read", local: null }
  };
  const steps: ConcurrencyStep[] = [];

  const push = (scheduled: ThreadId, action: string, message: string, blocked = false): void => {
    steps.push({
      turn: steps.length + 1,
      scheduled,
      counter,
      lockOwner,
      threads: cloneThreads(threads),
      action,
      message,
      blocked
    });
  };

  for (const scheduled of schedule) {
    const thread = threads[scheduled];
    if (thread.phase === "done") {
      push(scheduled, "already finished", `Thread ${scheduled} has already completed its increment.`, true);
      continue;
    }

    if (mode === "mutex" && lockOwner !== null && lockOwner !== scheduled) {
      push(
        scheduled,
        "blocked on mutex",
        `Thread ${scheduled} cannot enter the critical section because Thread ${lockOwner} owns the mutex.`,
        true
      );
      continue;
    }

    if (mode === "mutex" && lockOwner === null) {
      lockOwner = scheduled;
    }

    if (thread.phase === "read") {
      thread.local = counter;
      thread.phase = "increment";
      push(
        scheduled,
        `read counter → ${counter}`,
        mode === "mutex"
          ? `Thread ${scheduled} acquired the mutex and copied shared counter ${counter} into its private local value.`
          : `Thread ${scheduled} copied shared counter ${counter} into its private local value. Another thread can still read the same old value before this one writes.`
      );
      continue;
    }

    if (thread.phase === "increment") {
      thread.local = (thread.local ?? 0) + 1;
      thread.phase = "write";
      push(
        scheduled,
        `local = ${thread.local}`,
        `Thread ${scheduled} increments only its private local copy. The shared counter is still ${counter}.`
      );
      continue;
    }

    counter = thread.local ?? counter;
    thread.phase = "done";
    const released = mode === "mutex";
    if (released) lockOwner = null;
    push(
      scheduled,
      `write ${counter}`,
      mode === "mutex"
        ? `Thread ${scheduled} writes ${counter} to shared memory and releases the mutex. Thread ${other(scheduled)} may now enter.`
        : `Thread ${scheduled} writes its local value ${counter} back to shared memory. A stale local value from the other thread can overwrite it.`
    );
  }

  const completedThreads = Number(threads.A.phase === "done") + Number(threads.B.phase === "done");
  return {
    mode,
    schedule: [...schedule],
    steps,
    finalCounter: counter,
    completedThreads,
    lostUpdate: completedThreads === 2 && counter < 2
  };
}

export function classicLostUpdateSchedule(): ThreadId[] {
  return ["A", "B", "A", "B", "A", "B"];
}

export function serialSchedule(): ThreadId[] {
  return ["A", "A", "A", "B", "B", "B"];
}
