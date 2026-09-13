export type DeadlockThread = "A" | "B";
export type ResourceId = "R1" | "R2";
export type DeadlockStrategy = "opposite-order" | "global-order";

export interface ResourceState {
  owner: DeadlockThread | null;
}

export interface ThreadLockState {
  held: ResourceId[];
  waitingFor: ResourceId | null;
  done: boolean;
}

export interface DeadlockStep {
  index: number;
  scheduled: DeadlockThread;
  action: string;
  resources: Record<ResourceId, ResourceState>;
  threads: Record<DeadlockThread, ThreadLockState>;
  waitForEdges: Array<[DeadlockThread, DeadlockThread]>;
  deadlocked: boolean;
  message: string;
}

export interface DeadlockTrace {
  strategy: DeadlockStrategy;
  schedule: DeadlockThread[];
  steps: DeadlockStep[];
  deadlocked: boolean;
  completedThreads: number;
}

type Operation = { kind: "acquire" | "release"; resource: ResourceId };

type MutableThread = {
  pc: number;
  held: ResourceId[];
  waitingFor: ResourceId | null;
  done: boolean;
};

const copyResources = (resources: Record<ResourceId, ResourceState>): Record<ResourceId, ResourceState> => ({
  R1: { owner: resources.R1.owner },
  R2: { owner: resources.R2.owner }
});

const copyThreads = (threads: Record<DeadlockThread, MutableThread>): Record<DeadlockThread, ThreadLockState> => ({
  A: { held: [...threads.A.held], waitingFor: threads.A.waitingFor, done: threads.A.done },
  B: { held: [...threads.B.held], waitingFor: threads.B.waitingFor, done: threads.B.done }
});

function operationsFor(strategy: DeadlockStrategy): Record<DeadlockThread, Operation[]> {
  if (strategy === "global-order") {
    return {
      A: [
        { kind: "acquire", resource: "R1" },
        { kind: "acquire", resource: "R2" },
        { kind: "release", resource: "R2" },
        { kind: "release", resource: "R1" }
      ],
      B: [
        { kind: "acquire", resource: "R1" },
        { kind: "acquire", resource: "R2" },
        { kind: "release", resource: "R2" },
        { kind: "release", resource: "R1" }
      ]
    };
  }

  return {
    A: [
      { kind: "acquire", resource: "R1" },
      { kind: "acquire", resource: "R2" },
      { kind: "release", resource: "R2" },
      { kind: "release", resource: "R1" }
    ],
    B: [
      { kind: "acquire", resource: "R2" },
      { kind: "acquire", resource: "R1" },
      { kind: "release", resource: "R1" },
      { kind: "release", resource: "R2" }
    ]
  };
}

function waitForEdges(
  threads: Record<DeadlockThread, MutableThread>,
  resources: Record<ResourceId, ResourceState>
): Array<[DeadlockThread, DeadlockThread]> {
  const edges: Array<[DeadlockThread, DeadlockThread]> = [];
  for (const thread of ["A", "B"] as const) {
    const waiting = threads[thread].waitingFor;
    if (!waiting) continue;
    const owner = resources[waiting].owner;
    if (owner && owner !== thread) edges.push([thread, owner]);
  }
  return edges;
}

function hasWaitCycle(edges: Array<[DeadlockThread, DeadlockThread]>): boolean {
  return edges.some(([from, to]) => edges.some(([otherFrom, otherTo]) => otherFrom === to && otherTo === from));
}

export function normalizeDeadlockSchedule(value: string | DeadlockThread[]): DeadlockThread[] {
  const chars = Array.isArray(value) ? value : value.toUpperCase().split("");
  return chars.filter((char): char is DeadlockThread => char === "A" || char === "B").slice(0, 80);
}

export function deadlockDemoSchedule(): DeadlockThread[] {
  return ["A", "B", "A", "B"];
}

export function safeOrderingSchedule(): DeadlockThread[] {
  return ["A", "B", "A", "B", "A", "B", "A", "B", "B", "B", "B"];
}

export function simulateDeadlock(
  strategy: DeadlockStrategy,
  rawSchedule: string | DeadlockThread[]
): DeadlockTrace {
  const schedule = normalizeDeadlockSchedule(rawSchedule);
  const programs = operationsFor(strategy);
  const resources: Record<ResourceId, ResourceState> = { R1: { owner: null }, R2: { owner: null } };
  const threads: Record<DeadlockThread, MutableThread> = {
    A: { pc: 0, held: [], waitingFor: null, done: false },
    B: { pc: 0, held: [], waitingFor: null, done: false }
  };
  const steps: DeadlockStep[] = [];

  for (const scheduled of schedule) {
    const state = threads[scheduled];
    const program = programs[scheduled];
    let action = "idle";
    let message = `Thread ${scheduled} has already completed its lock sequence.`;

    if (!state.done) {
      const operation = program[state.pc];
      if (!operation) {
        state.done = true;
      } else if (operation.kind === "acquire") {
        const owner = resources[operation.resource].owner;
        action = `acquire ${operation.resource}`;
        if (owner === null || owner === scheduled) {
          resources[operation.resource].owner = scheduled;
          if (!state.held.includes(operation.resource)) state.held.push(operation.resource);
          state.waitingFor = null;
          state.pc += 1;
          message = `Thread ${scheduled} acquired ${operation.resource}.`;
        } else {
          state.waitingFor = operation.resource;
          message = `Thread ${scheduled} cannot acquire ${operation.resource} because Thread ${owner} owns it, so ${scheduled} waits.`;
        }
      } else {
        action = `release ${operation.resource}`;
        if (resources[operation.resource].owner === scheduled) resources[operation.resource].owner = null;
        state.held = state.held.filter(resource => resource !== operation.resource);
        state.waitingFor = null;
        state.pc += 1;
        message = `Thread ${scheduled} released ${operation.resource}, allowing another waiting thread to make progress.`;
      }

      if (state.pc >= program.length) state.done = true;
    }

    const edges = waitForEdges(threads, resources);
    const deadlocked = hasWaitCycle(edges);
    if (deadlocked) {
      message = "Deadlock detected: Thread A waits for a resource held by B while Thread B waits for a resource held by A. Neither can make progress.";
    }

    steps.push({
      index: steps.length,
      scheduled,
      action,
      resources: copyResources(resources),
      threads: copyThreads(threads),
      waitForEdges: edges,
      deadlocked,
      message
    });

    if (deadlocked) break;
  }

  return {
    strategy,
    schedule,
    steps,
    deadlocked: steps.some(step => step.deadlocked),
    completedThreads: Number(threads.A.done) + Number(threads.B.done)
  };
}
