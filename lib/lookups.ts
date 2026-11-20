import type { SupabaseClient } from "@supabase/supabase-js";
import { OBJECTS, type Field } from "./objects";
import type { LookupOptions } from "@/components/RecordForm";

/** Loads picklist options for every lookup field on a form (capped at 1000 per object). */
export async function loadLookups(supabase: SupabaseClient, fields: Field[]): Promise<LookupOptions> {
  const out: LookupOptions = {};
  await Promise.all(
    fields.filter((f) => f.type === "lookup" && f.lookup).map(async (f) => {
      const t = OBJECTS[f.lookup!];
      const { data } = await supabase.from(t.table).select(["id", ...t.titleColumns].join(",")).order(t.titleColumns.at(-1)!).limit(1000);
      out[f.name] = ((data ?? []) as unknown as Record<string, string>[]).map((r) => ({ id: r.id, label: t.title(r) }));
    })
  );
  return out;
}
