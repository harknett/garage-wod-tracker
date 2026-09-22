import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { equipmentContext } from "@/lib/ai/context";
import { getStore } from "@/lib/db";

let dir: string;

/**
 * `getStore` caches one connection on `globalThis` so Next's hot reload does
 * not open a second. Tests have to clear that cache themselves, or every case
 * after the first quietly reads the first case's database.
 */
function resetStore(): void {
  const g = globalThis as { __store?: { close(): void }; __storeClass?: unknown };
  try {
    g.__store?.close();
  } catch {
    // Already closed; nothing useful to do.
  }
  delete g.__store;
  delete g.__storeClass;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gwt-ai-"));
  process.env.DATA_DIR = dir;
  resetStore();
});

afterEach(() => {
  resetStore();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

describe("equipmentContext", () => {
  it("says the inventory is unknown rather than empty", () => {
    const text = equipmentContext("kg");
    // Told the gym owns nothing, the model writes a week of burpees. Told the
    // list is simply unrecorded, it programs conservatively instead.
    expect(text).toMatch(/No equipment inventory has been recorded/);
    expect(text).toMatch(/bodyweight substitution/);
  });

  it("lists available kit with its ceiling in the athlete's unit", () => {
    getStore().saveEquipment({
      name: "Barbell",
      detail: "20 kg bar",
      maxLoadG: 140_000,
      available: true,
    });

    expect(equipmentContext("kg")).toMatch(/- Barbell \(20 kg bar\) — loads to 140 kg/);
    expect(equipmentContext("lb")).toMatch(/loads to 308\.6 lb/);
  });

  it("never names kit that is out of action", () => {
    const store = getStore();
    store.saveEquipment({ name: "Barbell", detail: "", maxLoadG: 140_000, available: true });
    store.saveEquipment({
      name: "Rower",
      detail: "chain snapped",
      maxLoadG: null,
      available: false,
    });

    const text = equipmentContext("kg");
    // A rower named in the prompt is a rower in the workout, whatever the
    // sentence around it says.
    expect(text).toContain("Barbell");
    expect(text).not.toContain("Rower");
  });

  it("starts each case with an empty gym", () => {
    // Guards the reset above: without it this case inherits the barbell from
    // the one before and the assertion below passes for the wrong reason.
    expect(getStore().listEquipment()).toEqual([]);
  });

  it("tells the model to substitute rather than invent kit", () => {
    getStore().saveEquipment({
      name: "Kettlebell",
      detail: "24 kg",
      maxLoadG: 24_000,
      available: true,
    });
    expect(equipmentContext("kg")).toMatch(/substitute something that is/);
  });
});
