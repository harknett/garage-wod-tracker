import { DatabaseSync } from "node:sqlite";

import { addDays, daysBetween, weekStart } from "@/lib/dates";
import { DEFAULT_TIME_ZONE } from "@/lib/timezones";
import type { Unit } from "@/lib/units";
import type { Format, ScoreKind } from "@/lib/workout/formats";
import type { Phase } from "@/lib/workout/phases";
import type { Track } from "@/lib/workout/tracks";

import { MIGRATIONS } from "./migrations";
import type {
  Assignment,
  DayEntry,
  Equipment,
  FullWorkout,
  LeaderboardRow,
  Movement,
  MovementResult,
  Plan,
  NewEquipment,
  NewPlan,
  NewResult,
  NewWorkout,
  Result,
  Role,
  Source,
  User,
  Workout,
} from "./types";

type Row = Record<string, unknown>;

const str = (v: unknown): string => String(v);
const num = (v: unknown): number => Number(v);
const nnum = (v: unknown): number | null => (v == null ? null : Number(v));
const bool = (v: unknown): boolean => Number(v) === 1;

function mapUser(r: Row): User {
  return {
    id: num(r.id),
    email: str(r.email),
    name: str(r.name),
    role: str(r.role) as Role,
    unit: str(r.unit) as Unit,
    phase: str(r.phase) as Phase,
    track: str(r.track) as Track,
    timeZone: str(r.time_zone),
    mustChangePassword: bool(r.must_change_password),
    createdAt: str(r.created_at),
  };
}

function mapWorkout(r: Row): Workout {
  return {
    id: num(r.id),
    title: str(r.title),
    format: str(r.format) as Format,
    description: str(r.description),
    capSeconds: nnum(r.cap_seconds),
    source: str(r.source) as Source,
    phase: r.phase == null ? null : (str(r.phase) as Phase),
    track: r.track == null ? null : (str(r.track) as Track),
    planId: nnum(r.plan_id),
    createdBy: nnum(r.created_by),
    createdAt: str(r.created_at),
  };
}

function mapMovement(r: Row): Movement {
  return {
    id: num(r.id),
    workoutId: num(r.workout_id),
    position: num(r.position),
    name: str(r.name),
    reps: nnum(r.reps),
    sets: nnum(r.sets),
    loadG: nnum(r.load_g),
    distanceM: nnum(r.distance_m),
    seconds: nnum(r.seconds),
    notes: str(r.notes),
  };
}

function mapResult(r: Row): Result {
  return {
    id: num(r.id),
    assignmentId: num(r.assignment_id),
    userId: num(r.user_id),
    workoutId: num(r.workout_id),
    date: str(r.date),
    scoreValue: nnum(r.score_value),
    scoreKind: str(r.score_kind) as ScoreKind,
    scaled: bool(r.scaled),
    completed: bool(r.completed),
    rpe: nnum(r.rpe),
    notes: str(r.notes),
    createdAt: str(r.created_at),
  };
}

function mapMovementResult(r: Row): MovementResult {
  return {
    movementId: num(r.movement_id),
    reps: nnum(r.reps),
    loadG: nnum(r.load_g),
    seconds: nnum(r.seconds),
    distanceM: nnum(r.distance_m),
    notes: str(r.notes),
  };
}

function mapEquipment(r: Row): Equipment {
  return {
    id: num(r.id),
    name: str(r.name),
    detail: str(r.detail),
    maxLoadG: nnum(r.max_load_g),
    available: bool(r.available),
    createdAt: str(r.created_at),
  };
}

function mapPlan(r: Row): Plan {
  return {
    id: num(r.id),
    userId: num(r.user_id),
    startDate: str(r.start_date),
    phase: r.phase == null ? null : (str(r.phase) as Phase),
    track: r.track == null ? null : (str(r.track) as Track),
    summary: str(r.summary),
    createdAt: str(r.created_at),
  };
}

function mapAssignment(r: Row): Assignment {
  return {
    id: num(r.id),
    workoutId: num(r.workout_id),
    userId: num(r.user_id),
    date: str(r.date),
    position: num(r.position),
  };
}

export class Store {
  private readonly db: DatabaseSync;
  /** Nesting depth, so an inner `transaction` becomes a savepoint. */
  private depth = 0;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    const row = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
    for (let version = row.user_version; version < MIGRATIONS.length; version++) {
      this.db.exec(MIGRATIONS[version]!);
    }
    // user_version cannot be parameterised; the value is an integer we control.
    this.db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Run work as one unit, re-entrantly.
   *
   * SQLite has no nested `BEGIN`, but the methods here legitimately nest:
   * `importWeek` wraps a whole generated week, and each `createWorkout` inside
   * it wraps its own rows. Without savepoints that combination throws
   * "cannot start a transaction within a transaction" and no week ever
   * imports.
   *
   * The outermost call owns the real transaction; inner ones become
   * savepoints, so a failure deep inside still unwinds to the outermost
   * boundary rather than committing half a week.
   */
  transaction<T>(work: () => T): T {
    const nested = this.depth > 0;
    const name = `sp_${this.depth}`;

    this.db.exec(nested ? `SAVEPOINT ${name}` : "BEGIN");
    this.depth++;
    try {
      const result = work();
      this.db.exec(nested ? `RELEASE ${name}` : "COMMIT");
      return result;
    } catch (err) {
      if (nested) {
        // ROLLBACK TO rewinds to the savepoint but leaves it on the stack;
        // RELEASE pops it, so the outer transaction is not left holding one.
        this.db.exec(`ROLLBACK TO ${name}`);
        this.db.exec(`RELEASE ${name}`);
      } else {
        this.db.exec("ROLLBACK");
      }
      throw err;
    } finally {
      this.depth--;
    }
  }

  // --- accounts ------------------------------------------------------------

  countUsers(): number {
    return num((this.db.prepare("SELECT COUNT(*) AS n FROM users").get() as Row).n);
  }

  createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role: Role;
    unit: Unit;
    phase: Phase;
    track: Track;
    /** Defaults to US Eastern, where the gym is. */
    timeZone?: string;
    mustChangePassword: boolean;
  }): User {
    const row = this.db
      .prepare(
        `INSERT INTO users
           (email, name, password_hash, role, unit, phase, track, time_zone, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(
        input.email.trim().toLowerCase(),
        input.name.trim(),
        input.passwordHash,
        input.role,
        input.unit,
        input.phase,
        input.track,
        input.timeZone ?? DEFAULT_TIME_ZONE,
        input.mustChangePassword ? 1 : 0,
      ) as Row;
    return mapUser(row);
  }

  findUserByEmail(email: string): (User & { passwordHash: string }) | undefined {
    const row = this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.trim().toLowerCase()) as Row | undefined;
    return row ? { ...mapUser(row), passwordHash: str(row.password_hash) } : undefined;
  }

  findUser(id: number): User | undefined {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
    return row ? mapUser(row) : undefined;
  }

  listUsers(): User[] {
    return (this.db.prepare("SELECT * FROM users ORDER BY name").all() as Row[]).map(mapUser);
  }

  setPassword(userId: number, passwordHash: string, mustChange: boolean): void {
    this.db
      .prepare("UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?")
      .run(passwordHash, mustChange ? 1 : 0, userId);
  }

  setUnit(userId: number, unit: Unit): void {
    this.db.prepare("UPDATE users SET unit = ? WHERE id = ?").run(unit, userId);
  }

  /**
   * Move an athlete into a phase.
   *
   * Nothing already written changes: a workout carries the phase it was
   * written under, so the record still shows what was programmed and why.
   */
  setPhase(userId: number, phase: Phase): void {
    this.db.prepare("UPDATE users SET phase = ? WHERE id = ?").run(phase, userId);
  }

  /**
   * Put an athlete on a different track.
   *
   * Takes effect on the next week written. Sessions already on the board keep
   * the track they were written for — a 12-minute session does not become a
   * 40-minute one because its athlete changed their mind.
   */
  setTrack(userId: number, track: Track): void {
    this.db.prepare("UPDATE users SET track = ? WHERE id = ?").run(track, userId);
  }

  /**
   * Change the zone an athlete's days are counted in.
   *
   * Nothing stored moves: sessions and results carry calendar dates, not
   * instants, so a Tuesday session stays on Tuesday. Only which day "today"
   * is changes.
   */
  setTimeZone(userId: number, timeZone: string): void {
    this.db.prepare("UPDATE users SET time_zone = ? WHERE id = ?").run(timeZone, userId);
  }

  setName(userId: number, name: string): void {
    this.db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), userId);
  }

  deleteUser(userId: number): void {
    this.db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  }

  // --- sessions ------------------------------------------------------------

  createSession(tokenHash: string, userId: number, expiresAt: string): void {
    this.db
      .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash, userId, expiresAt);
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  deleteExpiredSessions(): void {
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  }

  /** Sessions for one account, dropped when its password changes. */
  deleteUserSessions(userId: number): void {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }

  findSessionUser(tokenHash: string): User | undefined {
    const row = this.db
      .prepare(
        `SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
      )
      .get(tokenHash) as Row | undefined;
    return row ? mapUser(row) : undefined;
  }

  // --- throttling ----------------------------------------------------------

  pruneAttempts(): void {
    this.db
      .prepare("DELETE FROM login_attempts WHERE created_at < datetime('now', '-1 day')")
      .run();
  }

  loginFailuresByIp(ip: string, windowMinutes: number): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM login_attempts
         WHERE ip = ? AND created_at > datetime('now', ?)`,
      )
      .get(ip, `-${windowMinutes} minutes`) as Row;
    return num(row.n);
  }

  loginFailuresByEmail(email: string, windowMinutes: number): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM login_attempts
         WHERE email = ? AND created_at > datetime('now', ?)`,
      )
      .get(email.trim().toLowerCase(), `-${windowMinutes} minutes`) as Row;
    return num(row.n);
  }

  recordLoginFailure(ip: string, email: string): void {
    this.db
      .prepare("INSERT INTO login_attempts (ip, email) VALUES (?, ?)")
      .run(ip, email.trim().toLowerCase());
  }

  clearLoginFailures(ip: string, email: string): void {
    this.db
      .prepare("DELETE FROM login_attempts WHERE ip = ? OR email = ?")
      .run(ip, email.trim().toLowerCase());
  }

  // --- workouts ------------------------------------------------------------

  createWorkout(input: NewWorkout): number {
    return this.transaction(() => {
      const row = this.db
        .prepare(
          `INSERT INTO workouts
             (title, format, description, cap_seconds, source, phase, track, plan_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        )
        .get(
          input.title.trim(),
          input.format,
          input.description,
          input.capSeconds,
          input.source,
          input.phase,
          input.track,
          input.planId,
          input.createdBy,
        ) as Row;
      const workoutId = num(row.id);

      const insert = this.db.prepare(
        `INSERT INTO movements (workout_id, position, name, reps, sets, load_g, distance_m, seconds, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      input.movements.forEach((m, index) => {
        insert.run(
          workoutId,
          index,
          m.name.trim(),
          m.reps,
          m.sets,
          m.loadG,
          m.distanceM,
          m.seconds,
          m.notes,
        );
      });
      return workoutId;
    });
  }

  getWorkout(id: number): FullWorkout | undefined {
    const row = this.db.prepare("SELECT * FROM workouts WHERE id = ?").get(id) as Row | undefined;
    if (!row) return undefined;
    return { ...mapWorkout(row), movements: this.movementsFor(id) };
  }

  private movementsFor(workoutId: number): Movement[] {
    return (
      this.db
        .prepare("SELECT * FROM movements WHERE workout_id = ? ORDER BY position")
        .all(workoutId) as Row[]
    ).map(mapMovement);
  }

  listWorkouts(limit = 100): Workout[] {
    return (
      this.db
        .prepare("SELECT * FROM workouts ORDER BY created_at DESC, id DESC LIMIT ?")
        .all(limit) as Row[]
    ).map(mapWorkout);
  }

  deleteWorkout(id: number): void {
    this.db.prepare("DELETE FROM workouts WHERE id = ?").run(id);
  }

  // --- plans ---------------------------------------------------------------

  createPlan(input: NewPlan): number {
    const row = this.db
      .prepare(
        `INSERT INTO plans (user_id, start_date, phase, track, summary)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(input.userId, input.startDate, input.phase, input.track, input.summary) as Row;
    return num(row.id);
  }

  /**
   * A plan, with how many sessions it holds.
   *
   * The count comes from the workouts rather than from what was generated, so
   * removing a session from the week is reflected rather than leaving the
   * group claiming a session that is no longer there.
   */
  findPlan(id: number): (Plan & { sessions: number }) | undefined {
    const row = this.db
      .prepare(
        `SELECT p.*, (SELECT COUNT(*) FROM workouts w WHERE w.plan_id = p.id) AS sessions
         FROM plans p WHERE p.id = ?`,
      )
      .get(id) as Row | undefined;
    return row ? { ...mapPlan(row), sessions: num(row.sessions) } : undefined;
  }

  // --- assignments ---------------------------------------------------------

  /** Put a workout in front of an athlete on a day. Assigning twice is a no-op. */
  assign(workoutId: number, userId: number, date: string, position = 0): void {
    this.db
      .prepare(
        `INSERT INTO assignments (workout_id, user_id, date, position)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, date, workout_id) DO UPDATE SET position = excluded.position`,
      )
      .run(workoutId, userId, date, position);
  }

  /**
   * Move an assignment to another day.
   *
   * Any result moves with it. `results.date` is a copy of the assignment's
   * date — denormalised so the weekly and per-week analytics queries do not
   * have to join — which means leaving it behind would quietly put a session
   * in two places at once: on the new day in the planner and the old one in
   * the record.
   *
   * The actor is either the athlete whose week it is, or an owner: rearranging
   * somebody's week is coaching, and a coach looking at an athlete's week is
   * the person most likely to notice that two hard days have ended up back to
   * back. Taking a session away is a different matter and stays with the
   * athlete — see `deleteAssignment`.
   *
   * Returns false when the athlete already has that workout on the target
   * day, which the unique index would otherwise reject with a raw SQL error.
   */
  moveAssignment(id: number, date: string, actor: { id: number; role: Role }): boolean {
    return this.transaction(() => {
      const assignment = this.findAssignment(id);
      if (!assignment) return false;
      if (assignment.userId !== actor.id && actor.role !== "owner") return false;
      if (assignment.date === date) return true;

      const clash = this.db
        .prepare(
          `SELECT 1 FROM assignments
           WHERE user_id = ? AND date = ? AND workout_id = ? AND id != ?`,
        )
        .get(assignment.userId, date, assignment.workoutId, id);
      if (clash) return false;

      this.db.prepare("UPDATE assignments SET date = ? WHERE id = ?").run(date, id);
      this.db.prepare("UPDATE results SET date = ? WHERE assignment_id = ?").run(date, id);
      return true;
    });
  }

  /**
   * The first week, from `fromWeek` on, with nothing on it for this athlete.
   *
   * What the Build screen offers by default: a coach writing the next block
   * almost always means the next empty week, and defaulting to the current
   * one invited writing a second week on top of the first. `fromWeek` is
   * itself a candidate, so a week nobody has programmed yet is offered first.
   * Gives up after a year and returns the week after the last programmed one
   * rather than looping forever on a long-booked athlete.
   */
  firstOpenWeek(userId: number, fromWeek: string): string {
    const dates = (
      this.db
        .prepare("SELECT DISTINCT date FROM assignments WHERE user_id = ? AND date >= ? ORDER BY date")
        .all(userId, fromWeek) as Row[]
    ).map((r) => str(r.date));
    const booked = new Set(dates.map(weekStart));
    let week = fromWeek;
    for (let i = 0; i < 53 && booked.has(week); i++) week = addDays(week, 7);
    return week;
  }

  /**
   * Move every session in one week to another week, each keeping its weekday.
   *
   * For a week written into the wrong slot: the whole block shifts together
   * rather than being dragged across one session at a time. Results move with
   * their sessions (`results.date` is a copy, as in `moveAssignment`), and a
   * plan that started in the old week now starts in the new one, so the week
   * still reads as written together.
   *
   * Sessions already in the target week stay where they are. The move is all
   * or nothing: if any session would land on a day that already holds the
   * same workout, nothing moves and the clash is reported.
   *
   * Same actor rule as `moveAssignment`: the athlete, or any owner.
   */
  moveWeek(
    userId: number,
    fromWeek: string,
    toWeek: string,
    actor: { id: number; role: Role },
  ): { moved: number; joined: number } | { error: string } {
    if (userId !== actor.id && actor.role !== "owner") return { error: "That week is not yours to move." };
    if (weekStart(fromWeek) !== fromWeek || weekStart(toWeek) !== toWeek) {
      return { error: "Weeks start on a Sunday." };
    }
    if (fromWeek === toWeek) return { error: "That is the week it is already in." };

    return this.transaction(() => {
      const inWeek = (start: string) =>
        (
          this.db
            .prepare("SELECT * FROM assignments WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, position")
            .all(userId, start, addDays(start, 6)) as Row[]
        ).map(mapAssignment);

      const moving = inWeek(fromWeek);
      if (moving.length === 0) return { error: "There is nothing in that week to move." };
      const already = inWeek(toWeek);

      const shift = daysBetween(fromWeek, toWeek);
      const taken = new Set(already.map((a) => `${a.date}/${a.workoutId}`));
      const clash = moving.find((a) => taken.has(`${addDays(a.date, shift)}/${a.workoutId}`));
      if (clash) {
        return { error: "The target week already has one of these workouts on the same day. Nothing was moved." };
      }

      const moveOne = this.db.prepare("UPDATE assignments SET date = ? WHERE id = ?");
      const moveResult = this.db.prepare("UPDATE results SET date = ? WHERE assignment_id = ?");
      for (const a of moving) {
        const date = addDays(a.date, shift);
        moveOne.run(date, a.id);
        moveResult.run(date, a.id);
      }
      this.db
        .prepare("UPDATE plans SET start_date = date(start_date, ?) WHERE user_id = ? AND start_date BETWEEN ? AND ?")
        .run(`${shift >= 0 ? "+" : ""}${shift} days`, userId, fromWeek, addDays(fromWeek, 6));

      return { moved: moving.length, joined: already.length };
    });
  }

  /**
   * Take a session out of a week.
   *
   * The actor is either the athlete whose week it is, or an owner — the same
   * rule as `moveAssignment`, because a coach who can rearrange a week should
   * not have to ask somebody else to drop a session from it.
   *
   * The workout itself survives: it may be on other athletes' weeks, and the
   * assignment is only the link. The logged result does not — `results` is
   * keyed on the assignment and cascades — so this is the one action in the
   * app that destroys training history, and every screen that calls it asks
   * twice and names what goes with it.
   *
   * Returns whether anything was removed, so a stale link posted twice reports
   * honestly instead of silently doing nothing.
   */
  deleteAssignment(id: number, actor: { id: number; role: Role }): boolean {
    const assignment = this.findAssignment(id);
    if (!assignment) return false;
    if (assignment.userId !== actor.id && actor.role !== "owner") return false;
    this.db.prepare("DELETE FROM assignments WHERE id = ?").run(id);
    return true;
  }

  findAssignment(id: number): Assignment | undefined {
    const row = this.db.prepare("SELECT * FROM assignments WHERE id = ?").get(id) as Row | undefined;
    return row ? mapAssignment(row) : undefined;
  }

  /**
   * Everything an athlete is due between two dates, with any result attached.
   *
   * Inclusive at both ends. Used for one day on the phone and for a whole week
   * on the planner, so the range is a parameter rather than two methods.
   */
  entriesBetween(userId: number, from: string, to: string): DayEntry[] {
    const rows = this.db
      .prepare(
        `SELECT a.* FROM assignments a
         WHERE a.user_id = ? AND a.date BETWEEN ? AND ?
         ORDER BY a.date, a.position, a.id`,
      )
      .all(userId, from, to) as Row[];

    return rows.map((row) => {
      const assignment = mapAssignment(row);
      const workout = this.getWorkout(assignment.workoutId)!;
      return { assignment, workout, result: this.resultFor(assignment.id) };
    });
  }

  // --- results -------------------------------------------------------------

  resultFor(assignmentId: number): (Result & { movements: MovementResult[] }) | null {
    const row = this.db
      .prepare("SELECT * FROM results WHERE assignment_id = ?")
      .get(assignmentId) as Row | undefined;
    if (!row) return null;
    const result = mapResult(row);
    const movements = (
      this.db
        .prepare("SELECT * FROM movement_results WHERE result_id = ?")
        .all(result.id) as Row[]
    ).map(mapMovementResult);
    return { ...result, movements };
  }

  /**
   * Record a result, replacing any earlier one for the same assignment.
   *
   * Logging is done on a phone, mid-session, and gets corrected a minute later
   * when the athlete realises they miscounted. An upsert is the honest shape
   * for that; an insert-only table would collect three rows for one workout.
   */
  saveResult(input: NewResult, userId: number): number {
    return this.transaction(() => {
      const assignment = this.findAssignment(input.assignmentId);
      if (!assignment || assignment.userId !== userId) {
        throw new Error("That workout is not yours to log.");
      }

      const row = this.db
        .prepare(
          `INSERT INTO results
             (assignment_id, user_id, workout_id, date, score_value, score_kind, scaled,
              completed, rpe, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(assignment_id) DO UPDATE SET
             score_value = excluded.score_value,
             score_kind  = excluded.score_kind,
             scaled      = excluded.scaled,
             -- Finishing sticks. An autosave that lands after the athlete has
             -- already pressed done must not quietly reopen the session.
             completed   = MAX(results.completed, excluded.completed),
             rpe         = excluded.rpe,
             notes       = excluded.notes
           RETURNING id`,
        )
        .get(
          input.assignmentId,
          userId,
          assignment.workoutId,
          assignment.date,
          input.scoreValue,
          input.scoreKind,
          input.scaled ? 1 : 0,
          input.completed ? 1 : 0,
          input.rpe,
          input.notes,
        ) as Row;
      const resultId = num(row.id);

      this.db.prepare("DELETE FROM movement_results WHERE result_id = ?").run(resultId);
      const insert = this.db.prepare(
        `INSERT INTO movement_results (result_id, movement_id, reps, load_g, seconds, distance_m, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const m of input.movements) {
        insert.run(resultId, m.movementId, m.reps, m.loadG, m.seconds, m.distanceM, m.notes);
      }
      return resultId;
    });
  }

  // --- equipment -----------------------------------------------------------

  /** Everything the gym owns, kit that is out of action included. */
  listEquipment(): Equipment[] {
    return (
      this.db
        .prepare("SELECT * FROM equipment ORDER BY available DESC, name")
        .all() as Row[]
    ).map(mapEquipment);
  }

  /** Only what can actually be used today - what programming is allowed to assume. */
  availableEquipment(): Equipment[] {
    return (
      this.db
        .prepare("SELECT * FROM equipment WHERE available = 1 ORDER BY name")
        .all() as Row[]
    ).map(mapEquipment);
  }

  /**
   * Add a piece of kit, or update it if the name is already on the list.
   *
   * Upserting on the name means re-adding "Rower" after someone typed it twice
   * corrects the entry instead of failing on the unique index.
   */
  saveEquipment(input: NewEquipment): void {
    this.db
      .prepare(
        `INSERT INTO equipment (name, detail, max_load_g, available)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           detail     = excluded.detail,
           max_load_g = excluded.max_load_g,
           available  = excluded.available`,
      )
      .run(input.name.trim(), input.detail.trim(), input.maxLoadG, input.available ? 1 : 0);
  }

  setEquipmentAvailable(id: number, available: boolean): void {
    this.db
      .prepare("UPDATE equipment SET available = ? WHERE id = ?")
      .run(available ? 1 : 0, id);
  }

  deleteEquipment(id: number): void {
    this.db.prepare("DELETE FROM equipment WHERE id = ?").run(id);
  }

  // --- leaderboard and analytics -------------------------------------------

  /**
   * Everyone who has finished this workout.
   *
   * Drafts are excluded. A session still being logged has a real score — just
   * not a final one — and putting it on the board would rank somebody on the
   * two movements they have got through so far.
   *
   * Ordering is left to the caller: only the format knows whether a smaller
   * number is a better one, and the format is not a column on this join.
   */
  leaderboard(workoutId: number): LeaderboardRow[] {
    return (
      this.db
        .prepare(
          `SELECT r.user_id, u.name, r.score_value, r.scaled, r.date
           FROM results r JOIN users u ON u.id = r.user_id
           WHERE r.workout_id = ? AND r.completed = 1`,
        )
        .all(workoutId) as Row[]
    ).map((r) => ({
      userId: num(r.user_id),
      name: str(r.name),
      scoreValue: nnum(r.score_value),
      scaled: bool(r.scaled),
      date: str(r.date),
    }));
  }

  /** Workouts more than one person has logged - the only comparable ones. */
  contestedWorkouts(limit = 25): Array<Workout & { entries: number }> {
    return (
      this.db
        .prepare(
          `SELECT w.*, COUNT(r.id) AS entries
           FROM workouts w JOIN results r ON r.workout_id = w.id AND r.completed = 1
           GROUP BY w.id HAVING COUNT(DISTINCT r.user_id) > 1
           ORDER BY MAX(r.date) DESC LIMIT ?`,
        )
        .all(limit) as Row[]
    ).map((r) => ({ ...mapWorkout(r), entries: num(r.entries) }));
  }

  /** Every result an athlete has logged since a date, newest first. */
  resultsSince(
    userId: number,
    since: string,
  ): Array<Result & { title: string; format: Format; track: Track | null }> {
    return (
      this.db
        .prepare(
          `SELECT r.*, w.title, w.format, w.track
           FROM results r JOIN workouts w ON w.id = r.workout_id
           WHERE r.user_id = ? AND r.date >= ? AND r.completed = 1
           ORDER BY r.date DESC, r.id DESC`,
        )
        .all(userId, since) as Row[]
    ).map((r) => ({
      ...mapResult(r),
      title: str(r.title),
      format: str(r.format) as Format,
      track: r.track == null ? null : (str(r.track) as Track),
    }));
  }

  /** Sessions logged per ISO week, for the training-consistency chart. */
  sessionsByWeek(userId: number, since: string): Array<{ week: string; sessions: number; avgRpe: number | null }> {
    return (
      this.db
        .prepare(
          `SELECT strftime('%Y-W%W', date) AS week,
                  COUNT(*) AS sessions,
                  AVG(rpe) AS avg_rpe
           FROM results WHERE user_id = ? AND date >= ? AND completed = 1
           GROUP BY week ORDER BY week`,
        )
        .all(userId, since) as Row[]
    ).map((r) => ({
      week: str(r.week),
      sessions: num(r.sessions),
      avgRpe: r.avg_rpe == null ? null : Math.round(Number(r.avg_rpe) * 10) / 10,
    }));
  }

  /** The heaviest load recorded per movement name, an athlete's lifting PRs. */
  bestLoads(userId: number, limit = 12): Array<{ name: string; loadG: number; date: string }> {
    return (
      this.db
        .prepare(
          `SELECT m.name, MAX(mr.load_g) AS load_g, r.date
           FROM movement_results mr
           JOIN movements m ON m.id = mr.movement_id
           JOIN results r ON r.id = mr.result_id
           WHERE r.user_id = ? AND r.completed = 1 AND mr.load_g IS NOT NULL AND mr.load_g > 0
           GROUP BY m.name ORDER BY load_g DESC LIMIT ?`,
        )
        .all(userId, limit) as Row[]
    ).map((r) => ({ name: str(r.name), loadG: num(r.load_g), date: str(r.date) }));
  }

  /** How often each format has come up, for spotting a one-note programme. */
  formatMix(userId: number, since: string): Array<{ format: Format; sessions: number }> {
    return (
      this.db
        .prepare(
          `SELECT w.format, COUNT(*) AS sessions
           FROM results r JOIN workouts w ON w.id = r.workout_id
           WHERE r.user_id = ? AND r.date >= ? AND r.completed = 1
           GROUP BY w.format ORDER BY sessions DESC`,
        )
        .all(userId, since) as Row[]
    ).map((r) => ({ format: str(r.format) as Format, sessions: num(r.sessions) }));
  }
}
