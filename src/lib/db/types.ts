import type { Unit } from "@/lib/units";
import type { Format, ScoreKind } from "@/lib/workout/formats";
import type { Phase } from "@/lib/workout/phases";

export type Role = "owner" | "member";
export type Source = "manual" | "ai";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  unit: Unit;
  /** Where this athlete is in their training. Steers every generated week. */
  phase: Phase;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface Movement {
  id: number;
  workoutId: number;
  position: number;
  name: string;
  reps: number | null;
  sets: number | null;
  loadG: number | null;
  distanceM: number | null;
  seconds: number | null;
  notes: string;
}

export interface Workout {
  id: number;
  title: string;
  format: Format;
  description: string;
  capSeconds: number | null;
  source: Source;
  /** The phase this was written under. Null for anything predating phases. */
  phase: Phase | null;
  createdBy: number | null;
  createdAt: string;
}

/** A workout with its movements, which is how every screen wants it. */
export interface FullWorkout extends Workout {
  movements: Movement[];
}

export interface Assignment {
  id: number;
  workoutId: number;
  userId: number;
  date: string;
  position: number;
}

export interface MovementResult {
  movementId: number;
  reps: number | null;
  loadG: number | null;
  seconds: number | null;
  distanceM: number | null;
  notes: string;
}

export interface Result {
  id: number;
  assignmentId: number;
  userId: number;
  workoutId: number;
  date: string;
  scoreValue: number | null;
  scoreKind: ScoreKind;
  scaled: boolean;
  rpe: number | null;
  notes: string;
  createdAt: string;
}

/** An assignment joined to its workout and, if logged, its result. */
export interface DayEntry {
  assignment: Assignment;
  workout: FullWorkout;
  result: (Result & { movements: MovementResult[] }) | null;
}

export interface LeaderboardRow {
  userId: number;
  name: string;
  scoreValue: number | null;
  scaled: boolean;
  date: string;
}

export interface NewResult {
  assignmentId: number;
  scoreValue: number | null;
  scoreKind: ScoreKind;
  scaled: boolean;
  rpe: number | null;
  notes: string;
  movements: MovementResult[];
}

export interface NewMovement {
  name: string;
  reps: number | null;
  sets: number | null;
  loadG: number | null;
  distanceM: number | null;
  seconds: number | null;
  notes: string;
}

export interface NewWorkout {
  title: string;
  format: Format;
  description: string;
  capSeconds: number | null;
  source: Source;
  phase: Phase | null;
  createdBy: number | null;
  movements: NewMovement[];
}

export interface Equipment {
  id: number;
  name: string;
  detail: string;
  maxLoadG: number | null;
  available: boolean;
  createdAt: string;
}

export interface NewEquipment {
  name: string;
  detail: string;
  maxLoadG: number | null;
  available: boolean;
}
