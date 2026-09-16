import { describe, expect, it } from "vitest";
import { addFixedWidth, parseInBase, signedValue, snapshot, toggleBit } from "./numberSystemsModel";

describe("number systems model", () => {
  it("shows the same 8-bit pattern as unsigned 255 and signed -1", () => {
    const value = snapshot(255, 8);
    expect(value.binary).toBe("11111111");
    expect(value.hex).toBe("FF");
    expect(value.unsigned).toBe(255);
    expect(value.signed).toBe(-1);
  });

  it("converts binary and hex input", () => {
    expect(parseInBase("1101_0110", 2)).toBe(214);
    expect(parseInBase("0xD6", 16)).toBe(214);
    expect(parseInBase("G1", 16)).toBeNull();
  });

  it("toggles positional bits", () => {
    expect(toggleBit(0, 8, 5)).toBe(32);
    expect(toggleBit(32, 8, 5)).toBe(0);
  });

  it("distinguishes carry from signed overflow", () => {
    expect(addFixedWidth(255, 1, 8)).toMatchObject({ result: 0, carry: true, signedOverflow: false });
    expect(addFixedWidth(127, 1, 8)).toMatchObject({ result: 128, carry: false, signedOverflow: true, signedResult: -128 });
  });

  it("handles 32-bit signed interpretation", () => {
    expect(signedValue(0xffffffff, 32)).toBe(-1);
  });
});
