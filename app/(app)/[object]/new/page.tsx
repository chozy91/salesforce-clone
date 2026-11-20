import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { editableFields, getObject, type Rec } from "@/lib/objects";
import { loadLookups } from "@/lib/lookups";
import { saveRecord } from "@/app/(app)/actions";
import RecordForm from "@/components/RecordForm";

export default async function NewRecord({ params, searchParams }: {
  params: Promise<{ object: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { object } = await params;
  const sp = await searchParams;
  const obj = getObject(object);
  if (!obj) notFound();

  const fields = editableFields(obj);
  const supabase = await createClient();
  const lookups = await loadLookups(supabase, fields);

  // Prefill from query string (e.g. "New Contact" from an Account's related list)
  const record: Rec = {};
  for (const f of fields) if (sp[f.name]) record[f.name] = sp[f.name];
  if (obj.key === "opportunities") record.stage ??= "prospecting";
  if (obj.key === "leads") record.status ??= "new";
  if (obj.key === "cases") { record.status ??= "new"; record.priority ??= "medium"; }
  if (obj.key === "tasks") { record.status ??= "not_started"; record.priority ??= "normal"; record.type ??= "task"; }
  if (obj.key === "accounts") record.type ??= "prospect";
  if (obj.key === "opportunities" && !record.close_date) {
    const d = new Date(); d.setDate(d.getDate() + 30);
    record.close_date = d.toISOString().slice(0, 10);
  }

  const returnTo = sp.return && sp.return.startsWith("/") ? sp.return : undefined;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-3 text-xl font-semibold">New {obj.label}</h1>
      <RecordForm fields={fields} record={record} lookups={lookups}
        action={saveRecord.bind(null, obj.key, null)} cancelHref={returnTo ?? `/${obj.key}`} returnTo={returnTo} />
    </div>
  );
}
