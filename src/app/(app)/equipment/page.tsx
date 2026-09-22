import { PageTitle } from "@/components/ui";
import { requireOwner } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";

import { EquipmentAdmin } from "./admin";

export const metadata = { title: "Equipment - Garage WOD Tracker" };
export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const owner = await requireOwner();
  const kit = getStore().listEquipment();

  return (
    <>
      <PageTitle sub="What you own. The programming works with this and nothing else.">
        Equipment
      </PageTitle>
      <EquipmentAdmin unit={owner.unit} equipment={kit} />
    </>
  );
}
