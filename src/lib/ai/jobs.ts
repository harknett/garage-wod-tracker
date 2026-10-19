/**
 * Long-running work that outlives the request that started it.
 *
 * Writing a week is one non-streaming call to the model that routinely runs
 * past a minute. Held open as a single request, that ran into the reverse
 * proxy's read timeout: nginx answered 504, the page fell over, and the week
 * had been written and saved all along. So the request now only starts the
 * work and hands back an id, and the page asks after it until it finishes.
 *
 * The registry is in memory, which is enough for one Node process: a restart
 * mid-job loses the job and the work with it, and `jobStatus` says "gone"
 * rather than pretending it is still running. It hangs off `globalThis` so a
 * hot reload, or a second module instance, sees the same jobs.
 */

export type JobStatus<T> =
  | { state: "running" }
  | { state: "done"; result: T }
  | { state: "gone" };

interface Job<T> {
  ownerId: number;
  key: string;
  result?: T;
  finishedAt?: number;
}

/** How long a finished job's result waits to be collected. */
const KEEP_MS = 60 * 60 * 1000;

const globalForJobs = globalThis as unknown as { __jobs?: Map<string, Job<unknown>> };

function jobs(): Map<string, Job<unknown>> {
  return (globalForJobs.__jobs ??= new Map());
}

function prune(now: number): void {
  for (const [id, job] of jobs()) {
    if (job.finishedAt !== undefined && now - job.finishedAt > KEEP_MS) jobs().delete(id);
  }
}

/**
 * Start `work` unless the same owner already has it running under `key`.
 *
 * The key is what makes a second submit harmless: pressing the button again
 * while a week is being written reattaches to that job instead of writing the
 * week twice. `work` must not throw — it turns its own failures into a result
 * — but if it does, the job finishes with `onThrow`'s result rather than
 * running forever.
 */
export function startJob<T>(
  ownerId: number,
  key: string,
  work: () => Promise<T>,
  onThrow: (err: unknown) => T,
): { id: string; done: Promise<void> } {
  prune(Date.now());
  for (const [id, job] of jobs()) {
    if (job.ownerId === ownerId && job.key === key && job.finishedAt === undefined) {
      return { id, done: Promise.resolve() };
    }
  }

  const id = crypto.randomUUID();
  const job: Job<T> = { ownerId, key };
  jobs().set(id, job);

  const done = work()
    .catch(onThrow)
    .then((result) => {
      job.result = result;
      job.finishedAt = Date.now();
    });
  return { id, done };
}

/**
 * Where a job has got to. Only the owner who started it can see it; to anyone
 * else it is "gone", the same as a job that never existed.
 */
export function jobStatus<T>(ownerId: number, id: string): JobStatus<T> {
  prune(Date.now());
  const job = jobs().get(id) as Job<T> | undefined;
  if (!job || job.ownerId !== ownerId) return { state: "gone" };
  if (job.finishedAt === undefined) return { state: "running" };
  return { state: "done", result: job.result as T };
}
