export type ReliabilityMode = "stop-and-wait" | "go-back-n";

export type TransportEventKind =
  | "send"
  | "deliver"
  | "drop"
  | "discard"
  | "ack"
  | "timeout"
  | "complete";

export interface TransportSnapshot {
  step: number;
  round: number;
  event: TransportEventKind;
  sequence: number | null;
  senderBase: number;
  receiverExpected: number;
  acknowledgedThrough: number;
  delivered: number[];
  retransmissions: number;
  explanation: string;
}

export interface TransportSimulation {
  mode: ReliabilityMode;
  packetCount: number;
  windowSize: number;
  lossSequence: number | null;
  snapshots: TransportSnapshot[];
  rounds: number;
  transmissions: number;
  retransmissions: number;
  delivered: number[];
}

export interface TransportComparison {
  stopAndWait: TransportSimulation;
  goBackN: TransportSimulation;
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function normalizeTransportInput(
  packetCount: number,
  windowSize: number,
  lossSequence: number | null
): { packetCount: number; windowSize: number; lossSequence: number | null } {
  const packets = clampInteger(packetCount, 1, 12, 6);
  const window = clampInteger(windowSize, 1, Math.min(6, packets), Math.min(4, packets));
  const loss = lossSequence === null || !Number.isFinite(lossSequence)
    ? null
    : clampInteger(lossSequence, 0, packets - 1, 0);
  return { packetCount: packets, windowSize: window, lossSequence: loss };
}

export function simulateReliableTransport(
  mode: ReliabilityMode,
  packetCount = 6,
  windowSize = 4,
  lossSequence: number | null = 2
): TransportSimulation {
  const normalized = normalizeTransportInput(packetCount, windowSize, lossSequence);
  const effectiveWindow = mode === "stop-and-wait" ? 1 : normalized.windowSize;
  const attempts = Array(normalized.packetCount).fill(0) as number[];
  const delivered: number[] = [];
  const snapshots: TransportSnapshot[] = [];
  let senderBase = 0;
  let receiverExpected = 0;
  let round = 0;
  let transmissions = 0;
  let retransmissions = 0;

  const push = (event: TransportEventKind, sequence: number | null, explanation: string) => {
    snapshots.push({
      step: snapshots.length,
      round,
      event,
      sequence,
      senderBase,
      receiverExpected,
      acknowledgedThrough: receiverExpected - 1,
      delivered: [...delivered],
      retransmissions,
      explanation
    });
  };

  while (senderBase < normalized.packetCount) {
    round++;
    const roundStart = senderBase;
    const roundEnd = Math.min(normalized.packetCount, roundStart + effectiveWindow);

    for (let sequence = roundStart; sequence < roundEnd; sequence++) {
      attempts[sequence]++;
      transmissions++;
      if (attempts[sequence] > 1) retransmissions++;
      push(
        "send",
        sequence,
        attempts[sequence] > 1
          ? `Sender retransmits packet ${sequence}.`
          : `Sender transmits packet ${sequence}${effectiveWindow > 1 ? ` inside the current window [${roundStart}–${roundEnd - 1}]` : ""}.`
      );

      const shouldDrop = normalized.lossSequence === sequence && attempts[sequence] === 1;
      if (shouldDrop) {
        push("drop", sequence, `Packet ${sequence} is lost before it reaches the receiver. No new cumulative ACK can advance past this gap.`);
        continue;
      }

      if (sequence !== receiverExpected) {
        push(
          "discard",
          sequence,
          `Receiver expected packet ${receiverExpected}, so out-of-order packet ${sequence} is discarded and ACK ${receiverExpected - 1} is repeated.`
        );
        push("ack", receiverExpected - 1, `Duplicate cumulative ACK ${receiverExpected - 1} tells the sender the gap still starts at packet ${receiverExpected}.`);
        continue;
      }

      delivered.push(sequence);
      receiverExpected++;
      senderBase = receiverExpected;
      push("deliver", sequence, `Receiver accepts packet ${sequence} in order and passes it to the application exactly once.`);
      push("ack", sequence, `Cumulative ACK ${sequence} confirms every packet through ${sequence}; the sender base advances to ${senderBase}.`);
    }

    if (senderBase < roundEnd) {
      push(
        "timeout",
        senderBase,
        mode === "stop-and-wait"
          ? `ACK ${senderBase} never arrived, so Stop-and-Wait times out and retries that one packet.`
          : `The oldest unacknowledged packet is ${senderBase}. Go-Back-N times out and retransmits from that packet through the outstanding window.`
      );
    }
  }

  push("complete", null, `All ${normalized.packetCount} packets arrived in order after ${round} transmission round${round === 1 ? "" : "s"}.`);

  return {
    mode,
    packetCount: normalized.packetCount,
    windowSize: effectiveWindow,
    lossSequence: normalized.lossSequence,
    snapshots,
    rounds: round,
    transmissions,
    retransmissions,
    delivered: [...delivered]
  };
}

export function compareReliableTransport(
  packetCount = 6,
  windowSize = 4,
  lossSequence: number | null = 2
): TransportComparison {
  return {
    stopAndWait: simulateReliableTransport("stop-and-wait", packetCount, 1, lossSequence),
    goBackN: simulateReliableTransport("go-back-n", packetCount, windowSize, lossSequence)
  };
}
