import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MIGRATIONS } from "@/lib/db/migrations";
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
    phase: "building",
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
