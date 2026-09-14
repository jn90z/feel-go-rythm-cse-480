export type TuringDirection = "L" | "R" | "S";

export interface TuringTransition {
  state: string;
  read: string;
  write: string;
  move: TuringDirection;
  nextState: string;
  explanation: string;
}

export interface TuringMachineDefinition {
  id: string;
  title: string;
  description: string;
  initialState: string;
  acceptStates: readonly string[];
  rejectStates?: readonly string[];
  blank: string;
  transitions: readonly TuringTransition[];
}

export interface TuringSnapshot {
  step: number;
  state: string;
  head: number;
  tape: Readonly<Record<number, string>>;
  read: string;
  transition: TuringTransition | null;
  halted: boolean;
  accepted: boolean;
  rejected: boolean;
  message: string;
}

export interface TuringRun {
  machine: TuringMachineDefinition;
  input: string;
  snapshots: readonly TuringSnapshot[];
  halted: boolean;
  accepted: boolean;
  rejected: boolean;
  maxStepsReached: boolean;
}

const MAX_INPUT = 24;
export const MAX_TURING_STEPS = 120;

function normalizeInput(value: string): string {
  return Array.from(value).slice(0, MAX_INPUT).join("");
}

function makeTape(input: string): Record<number, string> {
  const tape: Record<number, string> = {};
  Array.from(input).forEach((symbol, index) => {
    tape[index] = symbol;
  });
  return tape;
}

function readTape(tape: Readonly<Record<number, string>>, head: number, blank: string): string {
  return tape[head] ?? blank;
}

function findTransition(machine: TuringMachineDefinition, state: string, read: string): TuringTransition | null {
  return machine.transitions.find(transition => transition.state === state && transition.read === read) ?? null;
}

export function simulateTuringMachine(
  machine: TuringMachineDefinition,
  rawInput: string,
  maxSteps = MAX_TURING_STEPS
): TuringRun {
  const input = normalizeInput(rawInput);
  const tape = makeTape(input);
  const snapshots: TuringSnapshot[] = [];
  const boundedSteps = Number.isFinite(maxSteps) ? Math.max(1, Math.min(MAX_TURING_STEPS, Math.floor(maxSteps))) : MAX_TURING_STEPS;
  let state = machine.initialState;
  let head = 0;
  let step = 0;

  const pushSnapshot = (transition: TuringTransition | null, message: string): TuringSnapshot => {
    const accepted = machine.acceptStates.includes(state);
    const rejected = machine.rejectStates?.includes(state) ?? false;
    const halted = accepted || rejected || transition === null;
    const snapshot: TuringSnapshot = {
      step,
      state,
      head,
      tape: { ...tape },
      read: readTape(tape, head, machine.blank),
      transition,
      halted,
      accepted,
      rejected,
      message
    };
    snapshots.push(snapshot);
    return snapshot;
  };

  if (machine.acceptStates.includes(state)) {
    pushSnapshot(null, "The machine starts in an accepting state.");
    return { machine, input, snapshots, halted: true, accepted: true, rejected: false, maxStepsReached: false };
  }

  while (step < boundedSteps) {
    const read = readTape(tape, head, machine.blank);
    const transition = findTransition(machine, state, read);
    if (!transition) {
      const snapshot = pushSnapshot(null, `No rule matches state ${state} reading ${read}. The machine halts.`);
      return {
        machine,
        input,
        snapshots,
        halted: true,
        accepted: snapshot.accepted,
        rejected: snapshot.rejected || !snapshot.accepted,
        maxStepsReached: false
      };
    }

    pushSnapshot(transition, transition.explanation);
    if (transition.write === machine.blank) delete tape[head];
    else tape[head] = transition.write;
    head += transition.move === "L" ? -1 : transition.move === "R" ? 1 : 0;
    state = transition.nextState;
    step++;

    if (machine.acceptStates.includes(state) || (machine.rejectStates?.includes(state) ?? false)) {
      const accepted = machine.acceptStates.includes(state);
      pushSnapshot(null, accepted ? "The machine entered an accepting state." : "The machine entered a rejecting state.");
      return {
        machine,
        input,
        snapshots,
        halted: true,
        accepted,
        rejected: !accepted,
        maxStepsReached: false
      };
    }
  }

  pushSnapshot(null, `Stopped after the ${boundedSteps}-step safety limit.`);
  return {
    machine,
    input,
    snapshots,
    halted: false,
    accepted: false,
    rejected: false,
    maxStepsReached: true
  };
}

export function tapeWindow(snapshot: TuringSnapshot, blank: string, radius = 6): { index: number; symbol: string }[] {
  const safeRadius = Math.max(2, Math.min(12, Math.floor(radius)));
  const cells: { index: number; symbol: string }[] = [];
  for (let index = snapshot.head - safeRadius; index <= snapshot.head + safeRadius; index++) {
    cells.push({ index, symbol: snapshot.tape[index] ?? blank });
  }
  return cells;
}

export const TURING_MACHINES: readonly TuringMachineDefinition[] = [
  {
    id: "binary-increment",
    title: "Binary +1",
    description: "Walk to the end of a binary number, then propagate a carry leftward.",
    initialState: "scan",
    acceptStates: ["accept"],
    blank: "□",
    transitions: [
      { state: "scan", read: "0", write: "0", move: "R", nextState: "scan", explanation: "Scan right across the binary digits." },
      { state: "scan", read: "1", write: "1", move: "R", nextState: "scan", explanation: "Scan right across the binary digits." },
      { state: "scan", read: "□", write: "□", move: "L", nextState: "carry", explanation: "The end is reached. Move left and start adding the carry." },
      { state: "carry", read: "0", write: "1", move: "S", nextState: "accept", explanation: "0 + carry becomes 1, so the carry is finished." },
      { state: "carry", read: "1", write: "0", move: "L", nextState: "carry", explanation: "1 + carry becomes 0 and the carry continues left." },
      { state: "carry", read: "□", write: "1", move: "S", nextState: "accept", explanation: "The carry passed the most-significant bit, so write a new leading 1." }
    ]
  },
  {
    id: "unary-increment",
    title: "Unary +1",
    description: "Append one mark to a unary number such as 111 → 1111.",
    initialState: "scan",
    acceptStates: ["accept"],
    blank: "□",
    transitions: [
      { state: "scan", read: "1", write: "1", move: "R", nextState: "scan", explanation: "Move right across each unary mark." },
      { state: "scan", read: "□", write: "1", move: "S", nextState: "accept", explanation: "The first blank marks the end. Write one more 1." }
    ]
  },
  {
    id: "erase",
    title: "Erase the Tape",
    description: "Replace every 0 or 1 with blank, demonstrating destructive tape updates.",
    initialState: "erase",
    acceptStates: ["accept"],
    blank: "□",
    transitions: [
      { state: "erase", read: "0", write: "□", move: "R", nextState: "erase", explanation: "Erase this 0 and move right." },
      { state: "erase", read: "1", write: "□", move: "R", nextState: "erase", explanation: "Erase this 1 and move right." },
      { state: "erase", read: "□", write: "□", move: "S", nextState: "accept", explanation: "The first blank after the input means every symbol has been erased." }
    ]
  }
];

export function getTuringMachine(id: string): TuringMachineDefinition {
  return TURING_MACHINES.find(machine => machine.id === id) ?? TURING_MACHINES[0];
}
