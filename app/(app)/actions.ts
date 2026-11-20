"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { editableFields, ENUMS, getObject, type Field, type Rec } from "@/lib/objects";

export type FormState = { error?: string } | undefined;

function parseField(field: Field, raw: FormDataEntryValue | null): unknown {
  if (field.type === "boolean") return raw === "on" || raw === "true";
  const s = raw === null ? "" : String(raw).trim();
  if (s === "") return null;
  switch (field.type) {
    case "number":
    case "currency":
    case "percent": {
      const n = Number(s.replace(/[,$%\s]/g, ""));
      if (Number.isNaN(n)) throw new Error(`${field.label} must be a number`);
      return n;
    }
    case "picklist":
      if (field.options && !field.options.includes(s)) throw new Error(`Invalid value for ${field.label}`);
      return s;
    default:
      return s;
  }
}

function collect(objectKey: string, formData: FormData): Rec {
  const obj = getObject(objectKey);
  if (!obj) throw new Error("Unknown object");
  const values: Rec = {};
  for (const f of editableFields(obj)) {
    // Only write fields that are present on the form (booleans are absent when unchecked)
    if (!formData.has(f.name) && f.type !== "boolean") continue;
    const v = parseField(f, formData.get(f.name));
    if (f.required && (v === null || v === "")) throw new Error(`${f.label} is required`);
    values[f.name] = v;
  }
  return values;
}

export async function saveRecord(objectKey: string, id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const obj = getObject(objectKey);
  if (!obj) return { error: "Unknown object" };
  let values: Rec;
  try {
    values = collect(objectKey, formData);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = await createClient();
  let newId = id;
  if (id) {
    const { data, error } = await supabase.from(obj.table).update(values).eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "You don't have permission to edit this record (only the owner or an admin can)." };
  } else {
    const { data, error } = await supabase.from(obj.table).insert(values).select("id").single();
    if (error) return { error: error.message };
    newId = data.id;
  }
  revalidatePath(`/${objectKey}`);
  const back = formData.get("__return");
  redirect(typeof back === "string" && back.startsWith("/") ? back : `/${objectKey}/${newId}`);
}

// Returns an error message instead of throwing: production builds redact thrown messages.
export async function deleteRecord(objectKey: string, id: string): Promise<string | void> {
  const obj = getObject(objectKey);
  if (!obj) return "Unknown object";
  const supabase = await createClient();
  const { data, error } = await supabase.from(obj.table).delete().eq("id", id).select("id");
  if (error) return error.message;
  if (!data?.length) return "Only the owner or an admin can delete this record.";
  revalidatePath(`/${objectKey}`);
  redirect(`/${objectKey}`);
}

export async function setOpportunityStage(id: string, stage: string): Promise<string | void> {
  if (!(ENUMS.opportunity_stage as readonly string[]).includes(stage)) return "Invalid stage";
  const supabase = await createClient();
  const { data, error } = await supabase.from("opportunities").update({ stage }).eq("id", id).select("id");
  if (error) return error.message;
  if (!data?.length) return "Only the owner or an admin can change this opportunity.";
  revalidatePath("/pipeline");
  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/");
}

export async function addNote(parentKey: string, parentId: string, formData: FormData) {
  const obj = getObject(parentKey);
  const body = String(formData.get("body") ?? "").trim();
  if (!obj?.activityKey || !body) return;
  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({ body, [obj.activityKey]: parentId });
  if (error) throw new Error(error.message);
  revalidatePath(`/${parentKey}/${parentId}`);
}

export async function deleteNote(parentKey: string, parentId: string, noteId: string) {
  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", noteId);
  revalidatePath(`/${parentKey}/${parentId}`);
}

export async function quickTask(parentKey: string, parentId: string, formData: FormData) {
  const obj = getObject(parentKey);
  const subject = String(formData.get("subject") ?? "").trim();
  if (!obj?.activityKey || !subject) return;
  const due = String(formData.get("due_date") ?? "") || null;
  const type = String(formData.get("type") ?? "task");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    subject,
    due_date: due,
    type: (ENUMS.task_type as readonly string[]).includes(type) ? type : "task",
    [obj.activityKey]: parentId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/${parentKey}/${parentId}`);
}

export async function completeTask(taskId: string, path: string) {
  const supabase = await createClient();
  await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
  revalidatePath(path);
}

export async function addLineItem(opportunityId: string, formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const discount = Number(formData.get("discount_pct") ?? 0);
  if (!productId || !(quantity > 0)) return;
  const supabase = await createClient();
  const { data: product, error: pErr } = await supabase.from("products").select("unit_price").eq("id", productId).single();
  if (pErr) throw new Error(pErr.message);
  const priceRaw = String(formData.get("unit_price") ?? "").trim();
  const { error } = await supabase.from("opportunity_line_items").insert({
    opportunity_id: opportunityId,
    product_id: productId,
    quantity,
    unit_price: priceRaw ? Number(priceRaw) : product.unit_price,
    discount_pct: Number.isFinite(discount) ? discount : 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/opportunities/${opportunityId}`);
}

export async function deleteLineItem(opportunityId: string, lineItemId: string) {
  const supabase = await createClient();
  await supabase.from("opportunity_line_items").delete().eq("id", lineItemId);
  revalidatePath(`/opportunities/${opportunityId}`);
}

export async function convertLead(leadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const existing = String(formData.get("existing_account_id") ?? "") || null;
  const { data, error } = await supabase.rpc("convert_lead", {
    p_lead_id: leadId,
    p_create_opportunity: formData.get("create_opportunity") === "on",
    p_opportunity_name: String(formData.get("opportunity_name") ?? ""),
    p_existing_account_id: existing,
  });
  if (error) return { error: error.message };
  revalidatePath("/leads");
  const result = data as { account_id: string; opportunity_id: string | null };
  redirect(result.opportunity_id ? `/opportunities/${result.opportunity_id}` : `/accounts/${result.account_id}`);
}
