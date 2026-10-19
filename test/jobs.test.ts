import { describe, expect, it } from "vitest";

import { jobStatus, startJob } from "@/lib/ai/jobs";

/** A promise the test settles by hand, standing in for the model call. */
function gate<T>() {
  let release!: (value: T) => void;
  let fail!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    release = res;
    fail = rej;
  });
  return { promise, release, fail };
}

const onThrow = (err: unknown) => `threw: ${(err as Error).message}`;

describe("background jobs", () => {
  it("runs until the work settles, then hands back its result", async () => {
    const work = gate<string>();
    const job = startJob(1, "a:2026-10-18", () => work.promise, onThrow);

    expect(jobStatus(1, job.id)).toEqual({ state: "running" });
    work.release("written");
    await job.done;
    expect(jobStatus(1, job.id)).toEqual({ state: "done", result: "written" });
  });

  it("reattaches a second start for the same key instead of running it twice", async () => {
    const work = gate<string>();
    let runs = 0;
    const first = startJob(1, "b:2026-10-18", () => (runs++, work.promise), onThrow);
    const second = startJob(1, "b:2026-10-18", () => (runs++, work.promise), onThrow);

    expect(second.id).toBe(first.id);
    expect(runs).toBe(1);
    work.release("once");
    await first.done;
  });

  it("starts fresh once the earlier job for that key has finished", async () => {
    const first = startJob(1, "c:2026-10-18", async () => "first", onThrow);
    await first.done;
    const second = startJob(1, "c:2026-10-18", async () => "second", onThrow);
    await second.done;

    expect(second.id).not.toBe(first.id);
    expect(jobStatus(1, second.id)).toEqual({ state: "done", result: "second" });
  });

  it("finishes rather than hanging when the work throws", async () => {
    const work = gate<string>();
    const job = startJob(1, "d:2026-10-18", () => work.promise, onThrow);
    work.fail(new Error("boom"));
    await job.done;

    expect(jobStatus(1, job.id)).toEqual({ state: "done", result: "threw: boom" });
  });

  it("is invisible to anyone but the owner who started it", async () => {
    const job = startJob(1, "e:2026-10-18", async () => "mine", onThrow);
    await job.done;

    expect(jobStatus(2, job.id)).toEqual({ state: "gone" });
    expect(jobStatus(1, "no-such-job")).toEqual({ state: "gone" });
  });
});
