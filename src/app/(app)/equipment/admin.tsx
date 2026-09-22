"use client";

import { useActionState } from "react";

import { Button, Card, Empty, Field, Notice, inputClass } from "@/components/ui";
import type { Equipment } from "@/lib/db/types";
import type { Unit } from "@/lib/units";
import { formatLoad } from "@/lib/units";

import {
  addEquipment,
  removeEquipment,
  toggleEquipment,
  type EquipmentState,
} from "./actions";

export function EquipmentAdmin({ unit, equipment }: { unit: Unit; equipment: Equipment[] }) {
  const [addState, add, adding] = useActionState<EquipmentState, FormData>(addEquipment, {});
  const [toggleState, toggle] = useActionState<EquipmentState, FormData>(toggleEquipment, {});
  const [removeState, remove] = useActionState<EquipmentState, FormData>(removeEquipment, {});

  const usable = equipment.filter((e) => e.available);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 font-semibold">Add kit</h2>
        <p className="mb-4 text-xs opacity-60">
          Be honest about the list. The model programs to it exactly — what you leave off will
          never be written, and what you put on will.
        </p>
        <form action={add} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What is it">
              <input name="name" required placeholder="Barbell" className={inputClass} />
            </Field>
            <Field label={`Loads to (${unit})`} hint="Leave blank if weight means nothing here.">
              <input name="maxLoad" inputMode="decimal" placeholder="140" className={inputClass} />
            </Field>
          </div>
          <Field label="Detail" hint="Sizes, counts, condition. The things a name cannot carry.">
            <input
              name="detail"
              placeholder="20 kg bar, 2x25 kg + 4x10 kg bumpers"
              className={inputClass}
            />
          </Field>
          <Notice kind="error">{addState.error}</Notice>
          <Notice kind="ok">{addState.ok}</Notice>
          <Button type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add it"}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">The inventory</h2>
          <span className="text-xs opacity-60">
            {usable.length} in service · {equipment.length - usable.length} down
          </span>
        </div>

        <Notice kind="error">{toggleState.error ?? removeState.error}</Notice>
        <Notice kind="ok">{toggleState.ok ?? removeState.ok}</Notice>

        {equipment.length === 0 ? (
          <Empty>
            Nothing logged. With an empty list the model assumes bodyweight and one barbell, and
            scales everything down to match. Fix that.
          </Empty>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {equipment.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${item.available ? "" : "line-through opacity-50"}`}>
                    {item.name}
                    {item.maxLoadG !== null ? (
                      <span className="ml-2 text-sm font-normal opacity-70">
                        to {formatLoad(item.maxLoadG, unit)}
                      </span>
                    ) : null}
                    {!item.available ? (
                      <span className="ml-2 rounded bg-rust/15 px-1.5 py-0.5 text-xs font-normal text-rust no-underline dark:text-orange-300">
                        out of action
                      </span>
                    ) : null}
                  </p>
                  {item.detail ? (
                    <p className="truncate text-xs opacity-60">{item.detail}</p>
                  ) : null}
                </div>

                <form action={toggle}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="available" value={item.available ? "0" : "1"} />
                  <Button variant="quiet" type="submit" className="text-sm">
                    {item.available ? "Mark down" : "Back in"}
                  </Button>
                </form>

                <form action={remove}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button variant="danger" type="submit" className="text-sm">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
