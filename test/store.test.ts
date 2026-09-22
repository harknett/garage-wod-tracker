import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Store } from "@/lib/db/store";
import { compareScores } from "@/lib/workout/formats";
import { parseScore } from "@/lib/workout/score";

let dir: string;
let store: Store;

function makeUser(name: string, email: string) {
  return store.createUser({
    email,
    name,
    passwordHash: "scrypt$1$1$1$c2FsdA==$aGFzaA==",
    role: "member",
    unit: "kg",
    mustChangePassword: false,
  });
}

function makeWorkout(title = "Cindy") {
  return store.createWorkout({
    title,
    format: "amrap",
    description: "20 minutes.",
    capSeconds: 1200,
    source: "manual",
    createdBy: null,
    movements: [
      { name: "Pull-up", reps: 5, sets: null, loadG: null, distanceM: null, seconds: null, notes: "" },
      { name: "Push-up", reps: 10, sets: null, loadG: null, distanceM: null, seconds: null, notes: "" },
      { name: "Air squat", reps: 15, sets: null, loadG: null, distanceM: null, seconds: null, notes: "" },
    ],
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gwt-"));
  store = new Store(join(dir, "test.db"));
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("schema", () => {
  it("migrates a blank file into a usable database", () => {
    expect(store.countUsers()).toBe(0);
  });
});

describe("workouts", () => {
  it("round-trips a workout with its movements in order", () => {
    const id = makeWorkout();
    const workout = store.getWorkout(id)!;
    expect(workout.title).toBe("Cindy");
    expect(workout.format).toBe("amrap");
    expect(workout.movements.map((m) => m.name)).toEqual(["Pull-up", "Push-up", "Air squat"]);
    expect(workout.movements.map((m) => m.position)).toEqual([0, 1, 2]);
  });

  it("takes its movements with it when deleted", () => {
    const id = makeWorkout();
    store.deleteWorkout(id);
    expect(store.getWorkout(id)).toBeUndefined();
  });
});

describe("assignments and results", () => {
  it("attaches a result to the day it was assigned", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, user.id, "2026-09-21");

    const [entry] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
    expect(entry!.result).toBeNull();

    const score = parseScore("18+7", "amrap");
    store.saveResult(
      {
        assignmentId: entry!.assignment.id,
        scoreValue: score.value,
        scoreKind: score.kind,
        scaled: false,
        rpe: 8,
        notes: "Grip went first.",
        movements: [
          {
            movementId: entry!.workout.movements[0]!.id,
            reps: 93,
            loadG: null,
            seconds: null,
            distanceM: null,
            notes: "banded from round 12",
          },
        ],
      },
      user.id,
    );

    const [after] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
    expect(after!.result!.rpe).toBe(8);
    expect(after!.result!.movements).toHaveLength(1);
    expect(after!.result!.movements[0]!.reps).toBe(93);
  });

  it("replaces an earlier result rather than stacking a second one", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, user.id, "2026-09-21");
    const [entry] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");

    const save = (text: string) => {
      const score = parseScore(text, "amrap");
      store.saveResult(
        {
          assignmentId: entry!.assignment.id,
          scoreValue: score.value,
          scoreKind: score.kind,
          scaled: false,
          rpe: null,
          notes: "",
          movements: [],
        },
        user.id,
      );
    };

    save("18+7");
    save("17+3"); // miscounted, corrected a minute later

    expect(store.leaderboard(workoutId)).toHaveLength(1);
    const [entryAfter] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
    expect(entryAfter!.result!.scoreValue).toBe(parseScore("17+3", "amrap").value);
  });

  it("refuses to log against somebody else's assignment", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, alex.id, "2026-09-21");
    const [entry] = store.entriesBetween(alex.id, "2026-09-21", "2026-09-21");

    expect(() =>
      store.saveResult(
        {
          assignmentId: entry!.assignment.id,
          scoreValue: 1,
          scoreKind: "rounds",
          scaled: false,
          rpe: null,
          notes: "",
          movements: [],
        },
        sam.id,
      ),
    ).toThrow(/not yours/);
  });

  it("assigning the same workout twice does not duplicate the day", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, user.id, "2026-09-21");
    store.assign(workoutId, user.id, "2026-09-21");
    expect(store.entriesBetween(user.id, "2026-09-21", "2026-09-21")).toHaveLength(1);
  });
});

describe("leaderboard", () => {
  it("ranks an AMRAP by most rounds once the format is applied", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    const workoutId = makeWorkout();

    for (const [user, text] of [
      [alex, "18+7"],
      [sam, "20+2"],
    ] as const) {
      store.assign(workoutId, user.id, "2026-09-21");
      const [entry] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
      const score = parseScore(text, "amrap");
      store.saveResult(
        {
          assignmentId: entry!.assignment.id,
          scoreValue: score.value,
          scoreKind: score.kind,
          scaled: false,
          rpe: null,
          notes: "",
          movements: [],
        },
        user.id,
      );
    }

    const ranked = store
      .leaderboard(workoutId)
      .sort((a, b) => compareScores("amrap", a.scoreValue, b.scoreValue));
    expect(ranked.map((r) => r.name)).toEqual(["Sam", "Alex"]);
  });

  it("only lists workouts more than one athlete has logged", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const soloId = makeWorkout("Solo");
    store.assign(soloId, alex.id, "2026-09-21");
    const [entry] = store.entriesBetween(alex.id, "2026-09-21", "2026-09-21");
    store.saveResult(
      {
        assignmentId: entry!.assignment.id,
        scoreValue: 5,
        scoreKind: "rounds",
        scaled: false,
        rpe: null,
        notes: "",
        movements: [],
      },
      alex.id,
    );
    expect(store.contestedWorkouts()).toHaveLength(0);
  });
});

describe("accounts", () => {
  it("finds an account by email regardless of case and spacing", () => {
    makeUser("Alex", "alex@example.com");
    expect(store.findUserByEmail("  ALEX@Example.com ")?.name).toBe("Alex");
  });

  it("takes an athlete's training with them when deleted", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, user.id, "2026-09-21");
    store.deleteUser(user.id);
    expect(store.leaderboard(workoutId)).toHaveLength(0);
  });
});

describe("equipment", () => {
  it("lists what the gym owns, kit that is down included", () => {
    store.saveEquipment({ name: "Rower", detail: "Concept2", maxLoadG: null, available: true });
    store.saveEquipment({ name: "Barbell", detail: "20 kg", maxLoadG: 140_000, available: true });
    expect(store.listEquipment().map((e) => e.name)).toEqual(["Barbell", "Rower"]);
  });

  it("keeps kit that is out of action off the programming list", () => {
    store.saveEquipment({ name: "Rower", detail: "chain snapped", maxLoadG: null, available: false });
    store.saveEquipment({ name: "Barbell", detail: "", maxLoadG: 140_000, available: true });

    expect(store.listEquipment()).toHaveLength(2);
    // availableEquipment is what the model is shown, so a broken rower must
    // not reach it - a listed rower is a programmed rower.
    expect(store.availableEquipment().map((e) => e.name)).toEqual(["Barbell"]);
  });

  it("re-adding the same name corrects the entry instead of failing", () => {
    store.saveEquipment({ name: "Barbell", detail: "15 kg", maxLoadG: 60_000, available: true });
    store.saveEquipment({ name: "Barbell", detail: "20 kg", maxLoadG: 140_000, available: true });

    const kit = store.listEquipment();
    expect(kit).toHaveLength(1);
    expect(kit[0]!.detail).toBe("20 kg");
    expect(kit[0]!.maxLoadG).toBe(140_000);
  });

  it("brings kit back into service without losing its detail", () => {
    store.saveEquipment({ name: "Rower", detail: "chain snapped", maxLoadG: null, available: false });
    const id = store.listEquipment()[0]!.id;
    store.setEquipmentAvailable(id, true);

    const [item] = store.listEquipment();
    expect(item!.available).toBe(true);
    expect(item!.detail).toBe("chain snapped");
  });
});
