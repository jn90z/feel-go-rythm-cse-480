import { describe, expect, it } from "vitest";
import {
  compareReliableTransport,
  normalizeTransportInput,
  simulateReliableTransport
} from "./reliableTransportModel";

describe("reliable transport model", () => {
  it("delivers every packet exactly once and in order after loss", () => {
    const result = simulateReliableTransport("go-back-n", 6, 4, 2);
    expect(result.delivered).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(result.delivered).size).toBe(6);
    expect(result.snapshots.some(step => step.event === "drop" && step.sequence === 2)).toBe(true);
    expect(result.snapshots.some(step => step.event === "timeout" && step.sequence === 2)).toBe(true);
  });

  it("discards packets that arrive beyond a Go-Back-N gap", () => {
    const result = simulateReliableTransport("go-back-n", 5, 4, 1);
    const discarded = result.snapshots
      .filter(step => step.event === "discard")
      .map(step => step.sequence);
    expect(discarded).toEqual([2, 3]);
    expect(result.retransmissions).toBeGreaterThan(0);
  });

  it("shows sliding windows need fewer no-loss rounds than Stop-and-Wait", () => {
    const comparison = compareReliableTransport(8, 4, null);
    expect(comparison.stopAndWait.rounds).toBe(8);
    expect(comparison.goBackN.rounds).toBe(2);
    expect(comparison.goBackN.transmissions).toBe(8);
    expect(comparison.goBackN.retransmissions).toBe(0);
  });

  it("retries only the current packet in Stop-and-Wait", () => {
    const result = simulateReliableTransport("stop-and-wait", 4, 4, 1);
    expect(result.windowSize).toBe(1);
    expect(result.retransmissions).toBe(1);
    expect(result.rounds).toBe(5);
    expect(result.delivered).toEqual([0, 1, 2, 3]);
  });

  it("normalizes packet, window, and loss inputs to bounded values", () => {
    expect(normalizeTransportInput(99, 99, 99)).toEqual({
      packetCount: 12,
      windowSize: 6,
      lossSequence: 11
    });
    expect(normalizeTransportInput(Number.NaN, Number.NaN, null)).toEqual({
      packetCount: 6,
      windowSize: 4,
      lossSequence: null
    });
  });
});
