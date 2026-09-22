import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { importWeek } from "@/lib/ai/import";
import { getStore } from "@/lib/db";
import { PHASES, PHASE_SPECS, isPhase } from "@/lib/workout/phases";

describe("the phase catalogue", () => {
  it("covers every phase", () => {
    for (const phase of PHASES) {
      expect(PHASE_SPECS[phase].label).toBeTruthy();
      expect(PHASE_SPECS[phase].summary).toBeTruthy();
      expect(PHASE_SPECS[phase].brief).toBeTruthy();
    }
  });

  it("gives the model a different instruction per phase", () => {
    // If two briefs matched, the phase would be a label that changes nothing -
    // which is the failure this feature exists to avoid.
    const briefs = PHASES.map((p) => PHASE_SPECS[p].brief);
    expect(new Set(briefs).size).toBe(PHASES.length);
  });

  it("names its own phase in each brief, so the model cannot confuse them", () => {
    for (const phase of PHASES) {
      expect(PHASE_SPECS[phase].brief.toLowerCase()).toContain(phase);
    }
  });

  it("rejects anything that is not a phase", () => {
    expect(isPhase("building")).toBe(true);
    expect(isPhase("bulking")).toBe(false);
    expect(isPhase(null)).toBe(false);
  });
});

describe("importWeek", () => {
  let dir: string;

  function resetStore(): void {
    const g = globalThis as { __store?: { close(): void }; __storeClass?: unknown };
    try {
      g.__store?.close();
    } catch {
      // Already closed.
    }
    delete g.__store;
    delete g.__storeClass;
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gwt-import-"));
    process.env.DATA_DIR = dir;
    resetStore();
  });

  afterEach(() => {
    resetStore();
    rmSync(dir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  const week = {
    summary: "A week of getting stronger.",
    workouts: [
      {
        day: 0,
        title: "Heavy squat",
        format: "strength" as const,
        description: "Work up.",
        cap_seconds: null,
        movements: [
          {
            name: "Back squat",
            reps: 5,
            sets: 5,
            load_kg: 102.5,
            distance_m: null,
            seconds: null,
            notes: "",
          },
        ],
      },
      {
        day: 2,
        title: "Engine",
        format: "amrap" as const,
        description: "Twenty minutes.",
        cap_seconds: 1200,
        movements: [
          { name: "Row", reps: null, sets: null, load_kg: null, distance_m: 250, seconds: null, notes: "" },
        ],
      },
    ],
  };

  function makeAthlete() {
    return getStore().createUser({
      email: "alex@example.com",
      name: "Alex",
      passwordHash: "x",
      role: "owner",
      unit: "kg",
      phase: "building",
      mustChangePassword: false,
    });
  }

  it("stamps every imported workout with the phase it was written under", () => {
    const user = makeAthlete();
    const ids = importWeek(week, user.id, "2026-09-21", "building");

    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(getStore().getWorkout(id)!.phase).toBe("building");
      expect(getStore().getWorkout(id)!.source).toBe("ai");
    }
  });

  it("stamps the phase it was given, not the athlete's standing one", () => {
    // The coach can write one week off-phase without moving the athlete.
    const user = makeAthlete();
    const [id] = importWeek(week, user.id, "2026-09-21", "ramping");

    expect(getStore().getWorkout(id!)!.phase).toBe("ramping");
    expect(getStore().findUser(user.id)!.phase).toBe("building");
  });

  it("converts prescribed kilograms into stored grams", () => {
    const user = makeAthlete();
    const [id] = importWeek(week, user.id, "2026-09-21", "building");
    expect(getStore().getWorkout(id!)!.movements[0]!.loadG).toBe(102_500);
  });

  it("lands each workout on its own day, offset from the start", () => {
    const user = makeAthlete();
    importWeek(week, user.id, "2026-09-21", "building");

    const entries = getStore().entriesBetween(user.id, "2026-09-21", "2026-09-27");
    expect(entries.map((e) => e.assignment.date)).toEqual(["2026-09-21", "2026-09-23"]);
  });

  it("drops a cap the format cannot carry", () => {
    const user = makeAthlete();
    const ids = importWeek(week, user.id, "2026-09-21", "building");
    const [strength, amrap] = ids.map((id) => getStore().getWorkout(id)!);

    // A cap on a strength day is the model being tidy, not a real constraint.
    expect(strength!.capSeconds).toBeNull();
    expect(amrap!.capSeconds).toBe(1200);
  });
});
