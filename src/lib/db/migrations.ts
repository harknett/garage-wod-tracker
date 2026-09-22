/**
 * Ordered schema migrations, tracked by SQLite's `user_version` pragma.
 * Never edit a migration that has shipped - append a new one instead.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
    -- Which unit this athlete types and reads loads in. Storage is always
    -- grams; this only decides rendering and how typed input is read.
    unit          TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg','lb')),
    -- Set while the account still holds a password somebody else chose.
    must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1)),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    -- SHA-256 of the cookie token; the raw token never touches disk.
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  -- Failed sign-ins, for throttling. Pruned on every check.
  CREATE TABLE login_attempts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip         TEXT NOT NULL,
    email      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_attempts_ip ON login_attempts(ip, created_at);
  CREATE INDEX idx_attempts_email ON login_attempts(email, created_at);

  -- A workout as written, independent of who does it or when.
  CREATE TABLE workouts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    format      TEXT NOT NULL,
    -- The prescription in the athlete's own words: the part a movement list
    -- cannot carry, like "rest as needed" or "scale to a band".
    description TEXT NOT NULL DEFAULT '',
    -- The clock a capped format works against, in seconds. Null when the
    -- format carries no cap.
    cap_seconds INTEGER CHECK (cap_seconds IS NULL OR cap_seconds > 0),
    -- 'manual' or 'ai', so a generated week can be told apart later.
    source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai')),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- The movements inside a workout, in the order they are performed.
  CREATE TABLE movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id  INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    name        TEXT NOT NULL,
    -- Prescribed work. All optional: "max effort" and "as needed" are real
    -- prescriptions, and a movement with none of these is still a movement.
    reps        INTEGER CHECK (reps IS NULL OR reps > 0),
    sets        INTEGER CHECK (sets IS NULL OR sets > 0),
    -- Prescribed load in grams, matching how results are stored.
    load_g      INTEGER CHECK (load_g IS NULL OR load_g >= 0),
    distance_m  INTEGER CHECK (distance_m IS NULL OR distance_m > 0),
    seconds     INTEGER CHECK (seconds IS NULL OR seconds > 0),
    notes       TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX idx_movements_order ON movements(workout_id, position);

  -- A workout put in front of one athlete on one day. The same workout can be
  -- assigned to several people, which is what makes a leaderboard comparable.
  CREATE TABLE assignments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX idx_assignment_unique ON assignments(user_id, date, workout_id);
  CREATE INDEX idx_assignments_user_date ON assignments(user_id, date);

  -- What actually happened. One row per athlete per assignment.
  CREATE TABLE results (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL UNIQUE REFERENCES assignments(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_id    INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    date          TEXT NOT NULL,
    -- The sortable canonical for the workout's format: seconds, grams, reps,
    -- metres, or rounds-and-reps collapsed. Null means started, not finished.
    score_value   REAL,
    score_kind    TEXT NOT NULL,
    -- Whether the athlete did the prescribed weights and movements. A scaled
    -- result is still a result, but it is not the same leaderboard.
    scaled        INTEGER NOT NULL DEFAULT 0 CHECK (scaled IN (0,1)),
    -- Rate of perceived exertion, 1-10. The cheapest signal there is for
    -- whether a week is landing, and the one the AI leans on hardest.
    rpe           INTEGER CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10)),
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_results_user_date ON results(user_id, date);
  CREATE INDEX idx_results_workout ON results(workout_id, score_value);

  -- Per-movement detail: the weight actually used, the reps actually done.
  CREATE TABLE movement_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    result_id   INTEGER NOT NULL REFERENCES results(id) ON DELETE CASCADE,
    movement_id INTEGER NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
    reps        INTEGER CHECK (reps IS NULL OR reps >= 0),
    load_g      INTEGER CHECK (load_g IS NULL OR load_g >= 0),
    seconds     REAL CHECK (seconds IS NULL OR seconds >= 0),
    distance_m  INTEGER CHECK (distance_m IS NULL OR distance_m >= 0),
    notes       TEXT NOT NULL DEFAULT ''
  );
  -- What the gym actually owns. Shared across everyone who trains here:
  -- there is one rack and one set of bumpers, whoever is using them.
  CREATE TABLE equipment (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    -- Free text for the part a name cannot carry: "15 kg bar, bent", or
    -- "25 kg bumpers x2, 10 kg x4".
    detail     TEXT NOT NULL DEFAULT '',
    -- The heaviest this piece goes, in grams. Null when weight is meaningless
    -- (a rower, a wall) or simply unrecorded. The model leans on this hard:
    -- it is the difference between prescribing a 100 kg squat and prescribing
    -- one the athlete cannot load.
    max_load_g INTEGER CHECK (max_load_g IS NULL OR max_load_g > 0),
    -- Out of action rather than deleted, so a broken rower stops appearing in
    -- programming without losing the note about why.
    available  INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_equipment_available ON equipment(available, name);

  CREATE UNIQUE INDEX idx_movement_result_unique ON movement_results(result_id, movement_id);
  CREATE INDEX idx_movement_results_movement ON movement_results(movement_id);
  `,
];
