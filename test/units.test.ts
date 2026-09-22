import { describe, expect, it } from "vitest";

import {
  UnitParseError,
  formatDuration,
  formatLoad,
  parseDuration,
  parseLoad,
} from "@/lib/units";

describe("load", () => {
  it("stores kilos as whole grams", () => {
    expect(parseLoad("60", "kg")).toBe(60_000);
    expect(parseLoad("60.5", "kg")).toBe(60_500);
  });

  it("converts pounds on the way in", () => {
    expect(parseLoad("135", "lb")).toBe(61_235);
  });

  it("lets the same barbell logged in either unit land on one number", () => {
    // 45 kg is 99.208 lb; logged to the nearest tenth of a pound it should
    // still round back to the same gram bucket a kilo entry produces.
    expect(parseLoad("99.2", "lb")).toBeCloseTo(parseLoad("45", "kg"), -2);
  });

  it("renders without a pointless decimal", () => {
    expect(formatLoad(60_000, "kg")).toBe("60 kg");
    expect(formatLoad(60_500, "kg")).toBe("60.5 kg");
  });

  it("rejects nonsense and negatives", () => {
    expect(() => parseLoad("heavy", "kg")).toThrow(UnitParseError);
    expect(() => parseLoad("-5", "kg")).toThrow(UnitParseError);
    expect(() => parseLoad("", "kg")).toThrow(UnitParseError);
  });
});

describe("duration", () => {
  it("reads minutes and seconds", () => {
    expect(parseDuration("12:34")).toBe(754);
  });

  it("reads a bare number as seconds", () => {
    expect(parseDuration("45")).toBe(45);
  });

  it("truncates tenths rather than rounding past the clock", () => {
    expect(parseDuration("9:07.9")).toBe(547.9);
    expect(formatDuration(547.9)).toBe("9:07.9");
  });

  it("pads seconds and drops a zero tenth", () => {
    expect(formatDuration(547)).toBe("9:07");
  });

  it("rejects a sixty-plus seconds field", () => {
    expect(() => parseDuration("12:74")).toThrow(UnitParseError);
  });
});
