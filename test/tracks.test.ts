import { describe, expect, it } from "vitest";

import { TRACKS, TRACK_SPECS, isTrack, trackLength } from "@/lib/workout/tracks";

describe("the track catalogue", () => {
  it("covers every track", () => {
    for (const track of TRACKS) {
      const spec = TRACK_SPECS[track];
      expect(spec.label).toBeTruthy();
      expect(spec.summary).toBeTruthy();
      expect(spec.brief).toBeTruthy();
      expect(spec.sessions).toBeGreaterThan(0);
      expect(spec.sessions).toBeLessThanOrEqual(7);
    }
  });

  it("gives the model a different instruction per track", () => {
    // Identical briefs would make the track a label that changes nothing,
    // which is the failure this feature exists to avoid.
    const briefs = TRACKS.map((t) => TRACK_SPECS[t].brief);
    expect(new Set(briefs).size).toBe(TRACKS.length);
  });

  it("states its own session length in the brief the model reads", () => {
    for (const track of TRACKS) {
      const [from, to] = TRACK_SPECS[track].minutes;
      const brief = TRACK_SPECS[track].brief;
      expect(brief).toContain(String(from));
      expect(brief).toContain(String(to));
    }
  });

  it("names its session count in the brief too", () => {
    // The model is told the number in words; the planner uses the same figure
    // for the day count, so they must not drift apart.
    expect(TRACK_SPECS.long.brief.toLowerCase()).toContain("three sessions a week");
    expect(TRACK_SPECS.long.sessions).toBe(3);
    expect(TRACK_SPECS.short.brief.toLowerCase()).toContain("six sessions a week");
    expect(TRACK_SPECS.short.sessions).toBe(6);
  });

  it("keeps the minute range ordered and sane", () => {
    for (const track of TRACKS) {
      const [from, to] = TRACK_SPECS[track].minutes;
      expect(from).toBeLessThan(to);
      expect(from).toBeGreaterThan(0);
    }
  });

  it("renders a length for a badge", () => {
    expect(trackLength("long")).toBe("30–45 min");
    expect(trackLength("short")).toBe("10–15 min");
  });

  it("rejects anything that is not a track", () => {
    expect(isTrack("short")).toBe(true);
    expect(isTrack("medium")).toBe(false);
    expect(isTrack(null)).toBe(false);
  });

  it("describes two genuinely different weeks", () => {
    // Six short sessions should be more frequent and shorter than three long
    // ones; if that ever inverts, the labels are lying.
    expect(TRACK_SPECS.short.sessions).toBeGreaterThan(TRACK_SPECS.long.sessions);
    expect(TRACK_SPECS.short.minutes[1]).toBeLessThan(TRACK_SPECS.long.minutes[0]);
  });
});
