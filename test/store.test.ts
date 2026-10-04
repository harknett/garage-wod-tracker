import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MIGRATIONS } from "@/lib/db/migrations";
import { Store } from "@/lib/db/store";
import type { Role } from "@/lib/db/types";
import { compareScores } from "@/lib/workout/formats";
import { roundsValue } from "@/lib/workout/score";

let dir: string;
let store: Store;

function makeUser(name: string, email: string) {
  return store.createUser({
    email,
    name,
    passwordHash: "scrypt$1$1$1$c2FsdA==$aGFzaA==",
    role: "member",
    unit: "kg",
    phase: "building",
    track: "long",
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
    phase: null,
    track: null,
    planId: null,
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

/**
 * Build a database at an older schema version, then open it normally so the
 * outstanding migrations run against real rows. `upTo` is how many migrations
 * to apply by hand before handing over.
 */
function withLegacyDb(
  upTo: number,
  seed: (raw: DatabaseSync) => void,
  check: (migrated: Store) => void,
): void {
  const legacyDir = mkdtempSync(join(tmpdir(), "gwt-legacy-"));
  const file = join(legacyDir, "legacy.db");
  try {
    const raw = new DatabaseSync(file);
    raw.exec("PRAGMA foreign_keys = ON");
    for (let i = 0; i < upTo; i++) raw.exec(MIGRATIONS[i]!);
    raw.exec(`PRAGMA user_version = ${upTo}`);
    seed(raw);
    raw.close();

    const migrated = new Store(file);
    try {
      check(migrated);
    } finally {
      migrated.close();
    }
  } finally {
    rmSync(legacyDir, { recursive: true, force: true });
  }
}

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

    const score = { kind: "rounds" as const, value: roundsValue(18, 7) };
    store.saveResult(
      {
        assignmentId: entry!.assignment.id,
        scoreValue: score.value,
        scoreKind: score.kind,
        scaled: false,

        completed: true,
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

    const save = (rounds: number, reps: number) => {
      const score = { kind: "rounds" as const, value: roundsValue(rounds, reps) };
      store.saveResult(
        {
          assignmentId: entry!.assignment.id,
          scoreValue: score.value,
          scoreKind: score.kind,
          scaled: false,

          completed: true,
          rpe: null,
          notes: "",
          movements: [],
        },
        user.id,
      );
    };

    save(18, 7);
    save(17, 3); // miscounted, corrected a minute later

    expect(store.leaderboard(workoutId)).toHaveLength(1);
    const [entryAfter] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
    expect(entryAfter!.result!.scoreValue).toBe(roundsValue(17, 3));
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

          completed: true,
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

    for (const [user, rounds, reps] of [
      [alex, 18, 7],
      [sam, 20, 2],
    ] as const) {
      store.assign(workoutId, user.id, "2026-09-21");
      const [entry] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
      const score = { kind: "rounds" as const, value: roundsValue(rounds, reps) };
      store.saveResult(
        {
          assignmentId: entry!.assignment.id,
          scoreValue: score.value,
          scoreKind: score.kind,
          scaled: false,

          completed: true,
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

        completed: true,
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

describe("training phase", () => {
  it("starts an athlete where the owner put them", () => {
    const user = makeUser("Alex", "alex@example.com");
    expect(user.phase).toBe("building");
    expect(store.findUser(user.id)!.phase).toBe("building");
  });

  it("moves an athlete between phases", () => {
    const user = makeUser("Alex", "alex@example.com");
    store.setPhase(user.id, "ramping");
    expect(store.findUser(user.id)!.phase).toBe("ramping");
  });

  it("leaves already-written sessions on the phase they were written under", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = store.createWorkout({
      title: "Heavy day",
      format: "strength",
      description: "",
      capSeconds: null,
      source: "ai",
      phase: "building",
      track: "long",
      planId: null,
      createdBy: user.id,
      movements: [
        { name: "Back squat", reps: 5, sets: 5, loadG: 100_000, distanceM: null, seconds: null, notes: "" },
      ],
    });

    // The athlete gets hurt and is moved back to ramping. What was already
    // programmed must still read as the building session it was.
    store.setPhase(user.id, "ramping");
    expect(store.getWorkout(workoutId)!.phase).toBe("building");
    expect(store.findUser(user.id)!.phase).toBe("ramping");
  });

  it("accepts a hand-written workout that belongs to no phase", () => {
    const workoutId = makeWorkout("One-off");
    expect(store.getWorkout(workoutId)!.phase).toBeNull();
  });

  it("migrates an existing database, defaulting athletes to ramping", () => {
    // Migration 1 adds the column to a schema that already has rows. Proven by
    // stepping a database through migration 0 only, then opening it normally.
    withLegacyDb(1, (raw) => {
      raw
        .prepare(
          `INSERT INTO users (email, name, password_hash, role, unit)
           VALUES ('old@example.com', 'Old Hand', 'x', 'member', 'kg')`,
        )
        .run();
    }, (migrated) => {
      expect(migrated.findUserByEmail("old@example.com")!.phase).toBe("ramping");
    });
  });

  it("widens the phase constraint without disturbing anything that points at it", () => {
    // Migration 2 swaps the phase column to allow a fourth value. Rebuilding
    // the table instead would have dropped `users` while sessions, assignments
    // and results held cascading foreign keys into it.
    withLegacyDb(2, (raw) => {
      raw
        .prepare(
          `INSERT INTO users (email, name, password_hash, role, unit, phase)
           VALUES ('old@example.com', 'Old Hand', 'x', 'member', 'kg', 'building')`,
        )
        .run();
      raw
        .prepare(
          `INSERT INTO sessions (token_hash, user_id, expires_at)
           VALUES ('abc', 1, datetime('now', '+1 day'))`,
        )
        .run();
    }, (migrated) => {
      // The value survived the swap, the session that referenced the row is
      // still there, and the new phase is now accepted.
      const user = migrated.findUserByEmail("old@example.com")!;
      expect(user.phase).toBe("building");
      expect(migrated.findSessionUser("abc")?.email).toBe("old@example.com");

      migrated.setPhase(user.id, "conditioning");
      expect(migrated.findUser(user.id)!.phase).toBe("conditioning");
    });
  });

  it("still refuses a phase that is not in the catalogue", () => {
    const user = makeUser("Alex", "alex@example.com");
    expect(() =>
      // Cast past the type system: the database is the last line of defence
      // when a bad value arrives from somewhere TypeScript cannot see.
      store.setPhase(user.id, "bulking" as unknown as Parameters<Store["setPhase"]>[1]),
    ).toThrow(/CHECK constraint failed/);
  });
});

describe("nested transactions", () => {
  it("lets a transaction-wrapping method be called inside a larger one", () => {
    // This is exactly what importWeek does: one transaction around a whole
    // week, with createWorkout opening its own for each session.
    const ids = store.transaction(() => [makeWorkout("A"), makeWorkout("B")]);
    expect(ids).toHaveLength(2);
    expect(store.listWorkouts().map((w) => w.title).sort()).toEqual(["A", "B"]);
  });

  it("unwinds the whole outer unit when an inner one fails", () => {
    expect(() =>
      store.transaction(() => {
        makeWorkout("Kept?");
        throw new Error("something failed after the first workout");
      }),
    ).toThrow(/something failed/);

    // A half-written week is worse than a failed one, because it looks
    // finished. Nothing should have survived.
    expect(store.listWorkouts()).toHaveLength(0);
  });

  it("recovers to a working connection after a rollback", () => {
    expect(() =>
      store.transaction(() => {
        makeWorkout("Doomed");
        throw new Error("boom");
      }),
    ).toThrow();

    // A leaked savepoint or an unclosed transaction shows up here, as the
    // next write failing for no visible reason.
    const id = makeWorkout("After");
    expect(store.getWorkout(id)!.title).toBe("After");
    expect(store.listWorkouts()).toHaveLength(1);
  });

  it("rolls an inner failure back without losing committed outer work", () => {
    const kept = store.transaction(() => {
      const id = makeWorkout("Committed");
      try {
        store.transaction(() => {
          makeWorkout("Discarded");
          throw new Error("inner");
        });
      } catch {
        // Swallowed on purpose: the outer unit decides to carry on.
      }
      return id;
    });

    expect(store.getWorkout(kept)!.title).toBe("Committed");
    expect(store.listWorkouts().map((w) => w.title)).toEqual(["Committed"]);
  });
});

/** The person doing the moving, as the store wants them. */
const actor = (u: { id: number; role: Role }) => ({ id: u.id, role: u.role });

describe("moving a session", () => {
  function assignAndLog(userId: number, workoutId: number, date: string) {
    store.assign(workoutId, userId, date);
    const [entry] = store.entriesBetween(userId, date, date);
    store.saveResult(
      {
        assignmentId: entry!.assignment.id,
        scoreValue: 18_007,
        scoreKind: "rounds",
        scaled: false,

        completed: true,
        rpe: 8,
        notes: "",
        movements: [],
      },
      userId,
    );
    return entry!.assignment.id;
  }

  it("moves the session to another day", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, user.id, "2026-09-21");
    const [entry] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");

    expect(store.moveAssignment(entry!.assignment.id, "2026-09-24", actor(user))).toBe(true);
    expect(store.entriesBetween(user.id, "2026-09-21", "2026-09-21")).toHaveLength(0);
    expect(store.entriesBetween(user.id, "2026-09-24", "2026-09-24")).toHaveLength(1);
  });

  it("takes the logged result with it", () => {
    const user = makeUser("Alex", "alex@example.com");
    const id = assignAndLog(user.id, makeWorkout(), "2026-09-21");

    store.moveAssignment(id, "2026-09-24", actor(user));

    // results.date is a denormalised copy; leaving it behind would put the
    // session on the new day in the planner and the old one in the record.
    const [moved] = store.entriesBetween(user.id, "2026-09-24", "2026-09-24");
    expect(moved!.result!.date).toBe("2026-09-24");
    expect(moved!.result!.rpe).toBe(8);
    expect(store.resultsSince(user.id, "2026-09-22")).toHaveLength(1);
  });

  it("refuses to move onto a day that already holds the same workout", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, user.id, "2026-09-21");
    store.assign(workoutId, user.id, "2026-09-24");
    const [first] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");

    // The unique index would otherwise reject this with a raw SQL error.
    expect(store.moveAssignment(first!.assignment.id, "2026-09-24", actor(user))).toBe(false);
    expect(store.entriesBetween(user.id, "2026-09-21", "2026-09-21")).toHaveLength(1);
  });

  it("treats a move to the same day as a no-op, not a clash", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, user.id, "2026-09-21");
    const [entry] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
    expect(store.moveAssignment(entry!.assignment.id, "2026-09-21", actor(user))).toBe(true);
  });

  it("will not let one athlete move another's session", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, alex.id, "2026-09-21");
    const [entry] = store.entriesBetween(alex.id, "2026-09-21", "2026-09-21");

    expect(store.moveAssignment(entry!.assignment.id, "2026-09-24", actor(sam))).toBe(false);
    expect(store.entriesBetween(alex.id, "2026-09-21", "2026-09-21")).toHaveLength(1);
  });

  it("lets an owner rearrange an athlete's week", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const coach = store.createUser({
      email: "coach@example.com",
      name: "Coach",
      passwordHash: "x",
      role: "owner",
      unit: "kg",
      phase: "building",
      track: "long",
      mustChangePassword: false,
    });
    const workoutId = makeWorkout();
    store.assign(workoutId, alex.id, "2026-09-21");
    const [entry] = store.entriesBetween(alex.id, "2026-09-21", "2026-09-21");

    expect(store.moveAssignment(entry!.assignment.id, "2026-09-24", actor(coach))).toBe(true);
    // It moves on the athlete's own week, not onto the coach's.
    expect(store.entriesBetween(alex.id, "2026-09-24", "2026-09-24")).toHaveLength(1);
    expect(store.entriesBetween(coach.id, "2026-09-24", "2026-09-24")).toHaveLength(0);
  });

  it("checks a clash against the athlete, not the coach doing the moving", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const coach = store.createUser({
      email: "coach@example.com",
      name: "Coach",
      passwordHash: "x",
      role: "owner",
      unit: "kg",
      phase: "building",
      track: "long",
      mustChangePassword: false,
    });
    const workoutId = makeWorkout();
    store.assign(workoutId, alex.id, "2026-09-21");
    store.assign(workoutId, alex.id, "2026-09-24");
    // The coach holds nothing on the 24th, but Alex does — and it is Alex's
    // week the unique index protects.
    const [first] = store.entriesBetween(alex.id, "2026-09-21", "2026-09-21");
    expect(store.moveAssignment(first!.assignment.id, "2026-09-24", actor(coach))).toBe(false);
  });

  it("lets an owner drop a session from an athlete's week", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const coach = store.createUser({
      email: "coach@example.com",
      name: "Coach",
      passwordHash: "x",
      role: "owner",
      unit: "kg",
      phase: "building",
      track: "long",
      mustChangePassword: false,
    });
    const workoutId = makeWorkout();
    store.assign(workoutId, alex.id, "2026-09-21");
    const [entry] = store.entriesBetween(alex.id, "2026-09-21", "2026-09-21");

    // A coach who can rearrange a week should not have to ask somebody else to
    // drop a session from it.
    expect(store.deleteAssignment(entry!.assignment.id, actor(coach))).toBe(true);
    expect(store.entriesBetween(alex.id, "2026-09-21", "2026-09-21")).toHaveLength(0);
  });

  it("still will not let one athlete remove another's session", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    const workoutId = makeWorkout();
    store.assign(workoutId, alex.id, "2026-09-21");
    const [entry] = store.entriesBetween(alex.id, "2026-09-21", "2026-09-21");

    expect(store.deleteAssignment(entry!.assignment.id, actor(sam))).toBe(false);
    expect(store.entriesBetween(alex.id, "2026-09-21", "2026-09-21")).toHaveLength(1);
  });
});

describe("programming tracks", () => {
  it("starts an athlete on the track they were created with", () => {
    const user = makeUser("Alex", "alex@example.com");
    expect(user.track).toBe("long");
    expect(store.findUser(user.id)!.track).toBe("long");
  });

  it("moves an athlete between tracks", () => {
    const user = makeUser("Alex", "alex@example.com");
    store.setTrack(user.id, "short");
    expect(store.findUser(user.id)!.track).toBe("short");
  });

  it("leaves written sessions on the track they were written for", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = store.createWorkout({
      title: "Long piece",
      format: "amrap",
      description: "",
      capSeconds: 1200,
      source: "ai",
      phase: "building",
      track: "long",
      planId: null,
      createdBy: user.id,
      movements: [
        { name: "Row", reps: null, sets: null, loadG: null, distanceM: 500, seconds: null, notes: "" },
      ],
    });

    // A 40-minute session does not become a 12-minute one because its athlete
    // switched tracks.
    store.setTrack(user.id, "short");
    expect(store.getWorkout(workoutId)!.track).toBe("long");
    expect(store.findUser(user.id)!.track).toBe("short");
  });

  it("accepts a hand-written workout on no track at all", () => {
    expect(store.getWorkout(makeWorkout("One-off"))!.track).toBeNull();
  });

  it("reports the track alongside each logged result, for the prompt", () => {
    const user = makeUser("Alex", "alex@example.com");
    const workoutId = store.createWorkout({
      title: "Short piece",
      format: "amrap",
      description: "",
      capSeconds: 600,
      source: "ai",
      phase: "conditioning",
      track: "short",
      planId: null,
      createdBy: user.id,
      movements: [
        { name: "Burpee", reps: 10, sets: null, loadG: null, distanceM: null, seconds: null, notes: "" },
      ],
    });
    store.assign(workoutId, user.id, "2026-09-21");
    const [entry] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
    store.saveResult(
      {
        assignmentId: entry!.assignment.id,
        scoreValue: roundsValue(8, 0),
        scoreKind: "rounds",
        scaled: false,

        completed: true,
        rpe: 8,
        notes: "",
        movements: [],
      },
      user.id,
    );

    // An RPE 8 in a 12-minute piece is not the same effort as an RPE 8 in a
    // 40-minute one, so the history has to carry which it was.
    const [row] = store.resultsSince(user.id, "2026-01-01");
    expect(row!.track).toBe("short");
  });

  it("migrates an existing database onto the long track", () => {
    withLegacyDb(3, (raw) => {
      raw
        .prepare(
          `INSERT INTO users (email, name, password_hash, role, unit, phase)
           VALUES ('old@example.com', 'Old Hand', 'x', 'member', 'kg', 'building')`,
        )
        .run();
    }, (migrated) => {
      const user = migrated.findUserByEmail("old@example.com")!;
      expect(user.track).toBe("long");
      expect(user.phase).toBe("building");
      migrated.setTrack(user.id, "short");
      expect(migrated.findUser(user.id)!.track).toBe("short");
    });
  });
});

describe("removing a session from a week", () => {
  function assignTo(userId: number, workoutId: number, date = "2026-09-21") {
    store.assign(workoutId, userId, date);
    const [entry] = store.entriesBetween(userId, date, date);
    return entry!.assignment.id;
  }

  it("takes the session off the week", () => {
    const user = makeUser("Alex", "alex@example.com");
    const id = assignTo(user.id, makeWorkout());
    expect(store.deleteAssignment(id, actor(user))).toBe(true);
    expect(store.entriesBetween(user.id, "2026-09-21", "2026-09-21")).toHaveLength(0);
  });

  it("leaves the workout itself alone, because others may be doing it", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    const workoutId = makeWorkout();
    const alexId = assignTo(alex.id, workoutId);
    assignTo(sam.id, workoutId);

    store.deleteAssignment(alexId, actor(alex));

    expect(store.getWorkout(workoutId)).toBeDefined();
    expect(store.entriesBetween(sam.id, "2026-09-21", "2026-09-21")).toHaveLength(1);
  });

  it("destroys the logged result with it", () => {
    const user = makeUser("Alex", "alex@example.com");
    const id = assignTo(user.id, makeWorkout());
    store.saveResult(
      {
        assignmentId: id,
        scoreValue: roundsValue(18, 7),
        scoreKind: "rounds",
        scaled: false,

        completed: true,
        rpe: 8,
        notes: "",
        movements: [],
      },
      user.id,
    );
    expect(store.resultsSince(user.id, "2026-01-01")).toHaveLength(1);

    // results cascade from the assignment, so this is the one action in the
    // app that destroys training history. The UI asks twice for that reason.
    store.deleteAssignment(id, actor(user));
    expect(store.resultsSince(user.id, "2026-01-01")).toHaveLength(0);
  });

  it("refuses to remove somebody else's session", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    const id = assignTo(alex.id, makeWorkout());

    expect(store.deleteAssignment(id, actor(sam))).toBe(false);
    expect(store.entriesBetween(alex.id, "2026-09-21", "2026-09-21")).toHaveLength(1);
  });

  it("reports honestly when the session is already gone", () => {
    const user = makeUser("Alex", "alex@example.com");
    const id = assignTo(user.id, makeWorkout());
    expect(store.deleteAssignment(id, actor(user))).toBe(true);
    // A stale link posted twice should say so rather than silently succeed.
    expect(store.deleteAssignment(id, actor(user))).toBe(false);
  });
});

describe("weeks written in one go", () => {
  function planned(userId: number, summary = "Build the engine back up.") {
    const planId = store.createPlan({
      userId,
      startDate: "2026-09-21",
      phase: "building",
      track: "long",
      summary,
    });
    const ids = [0, 2, 4].map((day) => {
      const workoutId = store.createWorkout({
        title: `Day ${day}`,
        format: "amrap",
        description: "",
        capSeconds: 1200,
        source: "ai",
        phase: "building",
        track: "long",
        planId,
        createdBy: userId,
        movements: [
          { name: "Row", reps: null, sets: null, loadG: null, distanceM: 500, seconds: null, notes: "" },
        ],
      });
      store.assign(workoutId, userId, `2026-09-2${1 + day}`);
      return workoutId;
    });
    return { planId, ids };
  }

  it("ties the sessions to the plan that produced them", () => {
    const user = makeUser("Alex", "alex@example.com");
    const { planId, ids } = planned(user.id);
    for (const id of ids) expect(store.getWorkout(id)!.planId).toBe(planId);
  });

  it("keeps the model's account of the week", () => {
    const user = makeUser("Alex", "alex@example.com");
    const { planId } = planned(user.id, "Three broad sessions, engine first.");
    expect(store.findPlan(planId)!.summary).toBe("Three broad sessions, engine first.");
  });

  it("counts the sessions actually in the plan, not the ones generated", () => {
    const user = makeUser("Alex", "alex@example.com");
    const { planId } = planned(user.id);
    expect(store.findPlan(planId)!.sessions).toBe(3);

    // Remove one from the week: the group must stop claiming a session that
    // is no longer there.
    const [entry] = store.entriesBetween(user.id, "2026-09-21", "2026-09-21");
    store.deleteAssignment(entry!.assignment.id, actor(user));
    store.deleteWorkout(entry!.workout.id);
    expect(store.findPlan(planId)!.sessions).toBe(2);
  });

  it("a workout written on its own belongs to no plan", () => {
    expect(store.getWorkout(makeWorkout("One-off"))!.planId).toBeNull();
  });

  it("losing the plan does not take the sessions with it", () => {
    const user = makeUser("Alex", "alex@example.com");
    const { planId, ids } = planned(user.id);

    // Deleting a plan is not something the app offers, so there is no Store
    // method for it. The schema's behaviour is still worth pinning: open the
    // same file directly and delete the row out from under it.
    const side = new DatabaseSync(join(dir, "test.db"));
    side.exec("PRAGMA foreign_keys = ON");
    side.prepare("DELETE FROM plans WHERE id = ?").run(planId);
    side.close();
    // ON DELETE SET NULL: a workout somebody has already done outlives the
    // week it was planned in.
    for (const id of ids) {
      expect(store.getWorkout(id)).toBeDefined();
      expect(store.getWorkout(id)!.planId).toBeNull();
    }
  });
});

describe("logging as you go", () => {
  function start(userId: number, workoutId: number) {
    store.assign(workoutId, userId, "2026-09-21");
    const [entry] = store.entriesBetween(userId, "2026-09-21", "2026-09-21");
    return entry!;
  }

  const draft = (assignmentId: number, value: number, completed: boolean) => ({
    assignmentId,
    scoreValue: value,
    scoreKind: "rounds" as const,
    scaled: false,
    completed,
    rpe: null,
    notes: "",
    movements: [],
  });

  it("keeps a part-logged session without marking it done", () => {
    const user = makeUser("Alex", "alex@example.com");
    const entry = start(user.id, makeWorkout());
    store.saveResult(draft(entry.assignment.id, roundsValue(4, 0), false), user.id);

    const saved = store.resultFor(entry.assignment.id)!;
    expect(saved.completed).toBe(false);
    expect(saved.scoreValue).toBe(roundsValue(4, 0));
  });

  it("keeps a draft off the leaderboard", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    const workoutId = makeWorkout();

    const a = start(alex.id, workoutId);
    store.saveResult(draft(a.assignment.id, roundsValue(4, 0), false), alex.id);
    const s = start(sam.id, workoutId);
    store.saveResult(draft(s.assignment.id, roundsValue(20, 2), true), sam.id);

    // Ranking somebody on the two movements they have got through so far is
    // not a leaderboard, it is a distraction.
    const board = store.leaderboard(workoutId);
    expect(board.map((r) => r.name)).toEqual(["Sam"]);
  });

  it("keeps a draft out of the analytics and the prompt", () => {
    const user = makeUser("Alex", "alex@example.com");
    const entry = start(user.id, makeWorkout());
    store.saveResult(draft(entry.assignment.id, roundsValue(4, 0), false), user.id);

    expect(store.resultsSince(user.id, "2026-01-01")).toHaveLength(0);
    expect(store.sessionsByWeek(user.id, "2026-01-01")).toHaveLength(0);
    expect(store.formatMix(user.id, "2026-01-01")).toHaveLength(0);
  });

  it("counts it everywhere once it is finished", () => {
    const user = makeUser("Alex", "alex@example.com");
    const entry = start(user.id, makeWorkout());
    store.saveResult(draft(entry.assignment.id, roundsValue(4, 0), false), user.id);
    store.saveResult(draft(entry.assignment.id, roundsValue(18, 7), true), user.id);

    const saved = store.resultFor(entry.assignment.id)!;
    expect(saved.completed).toBe(true);
    expect(saved.scoreValue).toBe(roundsValue(18, 7));
    expect(store.resultsSince(user.id, "2026-01-01")).toHaveLength(1);
  });

  it("will not let a late autosave reopen a finished session", () => {
    const user = makeUser("Alex", "alex@example.com");
    const entry = start(user.id, makeWorkout());
    store.saveResult(draft(entry.assignment.id, roundsValue(18, 7), true), user.id);

    // A debounced save can land after the finish; it must not undo it.
    store.saveResult(draft(entry.assignment.id, roundsValue(18, 7), false), user.id);
    expect(store.resultFor(entry.assignment.id)!.completed).toBe(true);
  });

  it("migrates existing results as finished", () => {
    withLegacyDb(5, (raw) => {
      raw.prepare(
        `INSERT INTO users (email, name, password_hash, role, unit, phase, track)
         VALUES ('old@example.com','Old Hand','x','member','kg','building','long')`,
      ).run();
      raw.prepare(
        `INSERT INTO workouts (title, format, description, source)
         VALUES ('Cindy','amrap','','manual')`,
      ).run();
      raw.prepare(
        `INSERT INTO assignments (workout_id, user_id, date) VALUES (1, 1, '2026-09-21')`,
      ).run();
      raw.prepare(
        `INSERT INTO results (assignment_id, user_id, workout_id, date, score_value, score_kind)
         VALUES (1, 1, 1, '2026-09-21', 18007, 'rounds')`,
      ).run();
    }, (migrated) => {
      // Everything written before this was entered in one go at the end,
      // which is the definition of finished. A default of 0 would have wiped
      // every existing result off the leaderboard.
      const [row] = migrated.leaderboard(1);
      expect(row).toBeDefined();
      expect(migrated.resultFor(1)!.completed).toBe(true);
    });
  });
});

describe("the first open week", () => {
  // 2026-10-04 is a Sunday.
  it("offers this week when nothing is on it", () => {
    const user = makeUser("Alex", "alex@example.com");
    expect(store.firstOpenWeek(user.id, "2026-10-04")).toBe("2026-10-04");
  });

  it("skips weeks that already have anything on them, even one session", () => {
    const user = makeUser("Alex", "alex@example.com");
    const w = makeWorkout();
    store.assign(w, user.id, "2026-10-06"); // this week, Tuesday
    store.assign(w, user.id, "2026-10-17"); // next week, Saturday
    expect(store.firstOpenWeek(user.id, "2026-10-04")).toBe("2026-10-18");
  });

  it("finds a gap between programmed weeks", () => {
    const user = makeUser("Alex", "alex@example.com");
    const w = makeWorkout();
    store.assign(w, user.id, "2026-10-05");
    store.assign(w, user.id, "2026-10-19"); // the week after next
    expect(store.firstOpenWeek(user.id, "2026-10-04")).toBe("2026-10-11");
  });

  it("only looks at that athlete's weeks", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    store.assign(makeWorkout(), sam.id, "2026-10-05");
    expect(store.firstOpenWeek(alex.id, "2026-10-04")).toBe("2026-10-04");
  });
});

describe("moving a whole week", () => {
  const owner = { id: 999, role: "owner" as Role };

  function weekOf(userId: number, start: string) {
    return store
      .entriesBetween(userId, start, start.replace(/\d\d$/, (d) => String(Number(d) + 6).padStart(2, "0")))
      .map((e) => [e.assignment.date, e.workout.title]);
  }

  it("shifts every session, keeping each on its weekday", () => {
    const user = makeUser("Alex", "alex@example.com");
    store.assign(makeWorkout("Mon"), user.id, "2026-10-05");
    store.assign(makeWorkout("Wed"), user.id, "2026-10-07");
    store.assign(makeWorkout("Sat"), user.id, "2026-10-10");

    expect(store.moveWeek(user.id, "2026-10-04", "2026-10-18", owner)).toEqual({ moved: 3, joined: 0 });
    expect(weekOf(user.id, "2026-10-04")).toEqual([]);
    expect(weekOf(user.id, "2026-10-18")).toEqual([
      ["2026-10-19", "Mon"],
      ["2026-10-21", "Wed"],
      ["2026-10-24", "Sat"],
    ]);
  });

  it("moves backwards as well as forwards", () => {
    const user = makeUser("Alex", "alex@example.com");
    store.assign(makeWorkout("Thu"), user.id, "2026-10-22");
    expect(store.moveWeek(user.id, "2026-10-18", "2026-10-04", owner)).toEqual({ moved: 1, joined: 0 });
    expect(weekOf(user.id, "2026-10-04")).toEqual([["2026-10-08", "Thu"]]);
  });

  it("takes results with their sessions", () => {
    const user = makeUser("Alex", "alex@example.com");
    store.assign(makeWorkout(), user.id, "2026-10-05");
    const [entry] = store.entriesBetween(user.id, "2026-10-05", "2026-10-05");
    store.saveResult(
      {
        assignmentId: entry!.assignment.id,
        scoreValue: null,
        scoreKind: "rounds",
        scaled: false,
        completed: false,
        rpe: null,
        notes: "",
        movements: [],
      },
      user.id,
    );
    store.moveWeek(user.id, "2026-10-04", "2026-10-11", { id: user.id, role: "member" });
    expect(store.resultFor(entry!.assignment.id)!.date).toBe("2026-10-12");
  });

  it("moves the plan's start with the week it was written for", () => {
    const user = makeUser("Alex", "alex@example.com");
    const planId = store.createPlan({ userId: user.id, startDate: "2026-10-04", phase: null, track: null, summary: "" });
    store.assign(makeWorkout(), user.id, "2026-10-05");
    store.moveWeek(user.id, "2026-10-04", "2026-10-25", owner);
    expect(store.findPlan(planId)!.startDate).toBe("2026-10-25");
  });

  it("leaves sessions already in the target week where they are, and says how many", () => {
    const user = makeUser("Alex", "alex@example.com");
    store.assign(makeWorkout("Moving"), user.id, "2026-10-05");
    store.assign(makeWorkout("Staying"), user.id, "2026-10-14");
    expect(store.moveWeek(user.id, "2026-10-04", "2026-10-11", owner)).toEqual({ moved: 1, joined: 1 });
    expect(weekOf(user.id, "2026-10-11")).toEqual([
      ["2026-10-12", "Moving"],
      ["2026-10-14", "Staying"],
    ]);
  });

  it("moves nothing if any session would land on a day that already holds it", () => {
    const user = makeUser("Alex", "alex@example.com");
    const shared = makeWorkout("Shared");
    store.assign(makeWorkout("Other"), user.id, "2026-10-06");
    store.assign(shared, user.id, "2026-10-05");
    store.assign(shared, user.id, "2026-10-12");
    const result = store.moveWeek(user.id, "2026-10-04", "2026-10-11", owner);
    expect(result).toEqual({ error: expect.stringMatching(/Nothing was moved/) });
    // All or nothing: Tuesday's session did not move either.
    expect(weekOf(user.id, "2026-10-04")).toHaveLength(2);
  });

  it("will not let one athlete move another's week", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    store.assign(makeWorkout(), alex.id, "2026-10-05");
    expect(store.moveWeek(alex.id, "2026-10-04", "2026-10-11", { id: sam.id, role: "member" })).toEqual({
      error: expect.stringMatching(/not yours/),
    });
  });

  it("refuses weeks that do not start on a Sunday, and empty weeks", () => {
    const user = makeUser("Alex", "alex@example.com");
    expect(store.moveWeek(user.id, "2026-10-05", "2026-10-11", owner)).toEqual({ error: expect.stringMatching(/Sunday/) });
    expect(store.moveWeek(user.id, "2026-10-04", "2026-10-11", owner)).toEqual({ error: expect.stringMatching(/nothing/) });
  });

  it("only moves that athlete's sessions", () => {
    const alex = makeUser("Alex", "alex@example.com");
    const sam = makeUser("Sam", "sam@example.com");
    const w = makeWorkout();
    store.assign(w, alex.id, "2026-10-05");
    store.assign(w, sam.id, "2026-10-05");
    store.moveWeek(alex.id, "2026-10-04", "2026-10-11", owner);
    expect(weekOf(sam.id, "2026-10-04")).toEqual([["2026-10-05", "Cindy"]]);
  });
});
