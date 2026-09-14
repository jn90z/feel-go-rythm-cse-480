import { describe, expect, it } from "vitest";
import { getTuringMachine, simulateTuringMachine, tapeWindow } from "./turingMachineModel";

describe("Turing machine model", () => {
  it("increments binary input with carry propagation", () => {
    const run = simulateTuringMachine(getTuringMachine("binary-increment"), "111");
    const final = run.snapshots.at(-1)!;
    expect(run.halted).toBe(true);
    expect(run.accepted).toBe(true);
    expect(final.tape[-1]).toBe("1");
    expect(final.tape[0]).toBe("0");
    expect(final.tape[1]).toBe("0");
    expect(final.tape[2]).toBe("0");
  });

  it("increments unary input", () => {
    const run = simulateTuringMachine(getTuringMachine("unary-increment"), "111");
    const final = run.snapshots.at(-1)!;
    expect(run.accepted).toBe(true);
    expect([0, 1, 2, 3].map(index => final.tape[index])).toEqual(["1", "1", "1", "1"]);
  });

  it("erases every binary symbol", () => {
    const run = simulateTuringMachine(getTuringMachine("erase"), "10101");
    const final = run.snapshots.at(-1)!;
    expect(run.accepted).toBe(true);
    expect(Object.keys(final.tape)).toHaveLength(0);
  });

  it("rejects when no transition matches", () => {
    const run = simulateTuringMachine(getTuringMachine("binary-increment"), "10x1");
    expect(run.halted).toBe(true);
    expect(run.accepted).toBe(false);
    expect(run.rejected).toBe(true);
  });

  it("bounds long input and execution limits", () => {
    const run = simulateTuringMachine(getTuringMachine("unary-increment"), "1".repeat(100), 9999);
    expect(run.input.length).toBe(24);
    expect(run.snapshots.length).toBeLessThanOrEqual(121);
  });

  it("creates a centered bounded tape window", () => {
    const run = simulateTuringMachine(getTuringMachine("binary-increment"), "1");
    const snapshot = run.snapshots[0];
    const window = tapeWindow(snapshot, "□", 4);
    expect(window).toHaveLength(9);
    expect(window[4].index).toBe(snapshot.head);
    expect(window[4].symbol).toBe("1");
  });
});
