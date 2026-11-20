import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { editableFields, getObject, type Rec } from "@/lib/objects";
import { loadLookups } from "@/lib/lookups";
import { saveRecord } from "@/app/(app)/actions";
import RecordForm from "@/components/RecordForm";

export default async function EditRecord({ params }: { params: Promise<{ object: string; id: string }> }) {
  const { object, id } = await params;
  const obj = getObject(object);
  if (!obj) notFound();

  const fields = editableFields(obj);
  const supabase = await createClient();
  const [{ data }, lookups] = await Promise.all([
    supabase.from(obj.table).select("*").eq("id", id).maybeSingle(),
    loadLookups(supabase, fields),
  ]);
  if (!data) notFound();
  const record = data as Rec;
  // a record cannot be its own parent
  if (obj.key === "accounts" && lookups.parent_account_id) {
    lookups.parent_account_id = lookups.parent_account_id.filter((o) => o.id !== id);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-3 text-xl font-semibold">Edit {obj.title(record)}</h1>
      <RecordForm fields={fields} record={record} lookups={lookups}
        action={saveRecord.bind(null, obj.key, id)} cancelHref={`/${obj.key}/${id}`} />
    </div>
  );
}
