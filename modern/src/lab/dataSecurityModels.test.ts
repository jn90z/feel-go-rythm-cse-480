import { describe, expect, it } from "vitest";
import {
  clampLearningText,
  encryptionHandshakeStages,
  encryptionVisibility,
  runLengthEncode,
  vpnTunnelStages,
  vpnVisibility,
  zipPipelineStages
} from "./dataSecurityModels";

describe("data protection learning models", () => {
  it("round-trips run-length encoded text exactly", () => {
    const result = runLengthEncode("AAAABBBCCDAA");
    expect(result.decoded).toBe("AAAABBBCCDAA");
    expect(result.reversible).toBe(true);
    expect(result.tokens.map(token => [token.symbol, token.count])).toEqual([
      ["A", 4], ["B", 3], ["C", 2], ["D", 1], ["A", 2]
    ]);
  });

  it("keeps compression learning input bounded", () => {
    expect(clampLearningText("x".repeat(500))).toHaveLength(160);
    expect(runLengthEncode("x".repeat(500)).input).toHaveLength(160);
  });

  it("does not split Unicode code points at the input limit", () => {
    const source = `${"x".repeat(159)}😀😀`;
    const clamped = clampLearningText(source);
    const result = runLengthEncode(source);

    expect(Array.from(clamped)).toHaveLength(160);
    expect(clamped.endsWith("😀")).toBe(true);
    expect(clamped).not.toContain("�");
    expect(result.input).toBe(clamped);
    expect(result.decoded).toBe(clamped);
    expect(result.reversible).toBe(true);
  });

  it("counts UTF-8 bytes rather than JavaScript characters", () => {
    const result = runLengthEncode("é");
    expect(result.inputBytes).toBe(2);
  });

  it("describes ZIP as a reversible multi-stage archive pipeline", () => {
    const stages = zipPipelineStages();
    expect(stages.length).toBeGreaterThanOrEqual(5);
    expect(stages.some(stage => stage.detail.includes("DEFLATE"))).toBe(true);
    expect(stages.at(-1)?.detail).toContain("exactly");
  });

  it("teaches hybrid TLS-style protection rather than public-key encryption for every packet", () => {
    const stages = encryptionHandshakeStages();
    expect(stages.some(stage => stage.detail.includes("Diffie"))).toBe(true);
    expect(stages.some(stage => stage.detail.includes("symmetric"))).toBe(true);
    expect(stages.some(stage => stage.detail.includes("private key"))).toBe(true);
  });

  it("distinguishes observer visibility for encrypted and tunneled traffic", () => {
    expect(encryptionVisibility().find(row => row.observer === "Network observer")?.cannotSee).toContain("plaintext");
    expect(vpnVisibility().find(row => row.observer === "Local network / ISP")?.cannotSee).toContain("payload");
    expect(vpnTunnelStages().some(stage => stage.detail.includes("outer"))).toBe(true);
  });
});
