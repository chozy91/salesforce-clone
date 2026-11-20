import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldOf, getObject, OBJECTS, selectFor, type Rec } from "@/lib/objects";
import { fmtCurrency, fmtDate } from "@/lib/format";
import FieldValue from "@/components/FieldValue";
import ConfirmButton from "@/components/ConfirmButton";
import StagePath from "@/components/StagePath";
import {
  addLineItem, addNote, completeTask, deleteLineItem, deleteNote, deleteRecord, quickTask,
} from "@/app/(app)/actions";

export default async function RecordDetail({ params }: { params: Promise<{ object: string; id: string }> }) {
  const { object, id } = await params;
  const obj = getObject(object);
  if (!obj) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from(obj.table).select(selectFor(obj)).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const rec = data as unknown as Rec;
  const path = `/${obj.key}/${id}`;

  // Related lists, activities and notes in parallel
  const relatedQ = obj.related.map((rl) => {
    const t = OBJECTS[rl.object];
    return supabase.from(t.table).select(selectFor(t, rl.columns)).eq(rl.foreignKey, id).order("created_at", { ascending: false }).limit(10);
  });
  const tasksQ = obj.activityKey
    ? supabase.from("tasks").select("id,subject,type,status,due_date,priority").eq(obj.activityKey, id).order("due_date", { ascending: true, nullsFirst: false }).limit(50)
    : null;
  const notesQ = obj.activityKey
    ? supabase.from("notes").select("id,body,created_at,owner:profiles!notes_owner_id_fkey(full_name,email)").eq(obj.activityKey, id).order("created_at", { ascending: false }).limit(50)
    : null;
  const lineItemsQ = obj.key === "opportunities"
    ? supabase.from("opportunity_line_items").select("id,quantity,unit_price,discount_pct,total_price,product:products(id,name,product_code)").eq("opportunity_id", id).order("created_at")
    : null;
  const productsQ = obj.key === "opportunities"
    ? supabase.from("products").select("id,name,unit_price").eq("is_active", true).order("name").limit(500)
    : null;

  const [relatedRes, tasksRes, notesRes, lineRes, productsRes] = await Promise.all([
    Promise.all(relatedQ), tasksQ, notesQ, lineItemsQ, productsQ,
  ]);
  const tasks = (tasksRes?.data ?? []) as Rec[];
  const notes = (notesRes?.data ?? []) as Rec[];
  const lineItems = (lineRes?.data ?? []) as Rec[];
  const products = (productsRes?.data ?? []) as Rec[];

  const sections = [...new Set(obj.fields.map((f) => f.section ?? "Details"))];
  const highlights = obj.listColumns.slice(1, 5).map((c) => fieldOf(obj, c)!).filter(Boolean);
  const converted = obj.key === "leads" && rec.status === "converted";

  return (
    <div className="space-y-4">
      {/* Highlights panel */}
      <div className="card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded text-xl" style={{ background: obj.color }}>{obj.icon}</span>
          <div className="mr-auto">
            <div className="text-xs text-muted">{obj.label}</div>
            <h1 className="text-xl font-semibold">{obj.title(rec)}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {obj.key === "leads" && !converted && <Link className="btn-primary" href={`${path}/convert`}>Convert</Link>}
            {(obj.key === "accounts" || obj.key === "contacts") && (
              <Link className="btn" href={`/opportunities/new?${obj.key === "accounts" ? "account_id" : "contact_id"}=${id}&return=${path}`}>New Opportunity</Link>
            )}
            <Link className="btn" href={`${path}/edit`}>Edit</Link>
            <ConfirmButton action={deleteRecord.bind(null, obj.key, id)} label="Delete"
              confirmText={`Delete this ${obj.label.toLowerCase()}? This cannot be undone.`} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {highlights.map((f) => (
            <div key={f.name}>
              <div className="text-xs text-muted">{f.label}</div>
              <div className="text-sm"><FieldValue obj={obj} field={f} rec={rec} /></div>
            </div>
          ))}
        </div>
      </div>

      {obj.key === "opportunities" && <StagePath id={id} stage={rec.stage} />}
      {converted && (
        <div className="card border-green-300 bg-green-50 p-3 text-sm text-green-800">
          This lead was converted on {fmtDate(rec.converted_at)}.{" "}
          {rec.converted_account_id && <Link className="link" href={`/accounts/${rec.converted_account_id}`}>View account</Link>}
          {rec.converted_opportunity_id && <> · <Link className="link" href={`/opportunities/${rec.converted_opportunity_id}`}>View opportunity</Link></>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Details */}
          <div className="card">
            {sections.map((s) => {
              const fs = obj.fields.filter((f) => (f.section ?? "Details") === s);
              if (s === "Conversion" && !converted) return null;
              return (
                <section key={s} className="border-b border-line p-4 last:border-0">
                  <h3 className="mb-3 text-sm font-semibold">{s}</h3>
                  <dl className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                    {fs.map((f) => (
                      <div key={f.name} className={`border-b border-dotted border-line pb-1 ${f.type === "textarea" ? "md:col-span-2" : ""}`}>
                        <dt className="text-xs text-muted">{f.label}</dt>
                        <dd className="min-h-5 text-sm"><FieldValue obj={obj} field={f} rec={rec} /></dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>

          {/* Products (opportunity line items) */}
          {obj.key === "opportunities" && (
            <div className="card">
              <div className="flex items-center justify-between border-b border-line p-3">
                <h3 className="font-semibold">Products ({lineItems.length})</h3>
                <span className="text-sm text-muted">Total {fmtCurrency(lineItems.reduce((a, l) => a + Number(l.total_price), 0))}</span>
              </div>
              {lineItems.length > 0 && (
                <table className="w-full">
                  <thead><tr><th className="th">Product</th><th className="th">Qty</th><th className="th">Unit Price</th><th className="th">Disc.</th><th className="th">Total</th><th className="th" /></tr></thead>
                  <tbody>
                    {lineItems.map((l) => (
                      <tr key={l.id}>
                        <td className="td"><Link className="link" href={`/products/${l.product?.id}`}>{l.product?.name}</Link></td>
                        <td className="td">{l.quantity}</td>
                        <td className="td">{fmtCurrency(l.unit_price)}</td>
                        <td className="td">{Number(l.discount_pct)}%</td>
                        <td className="td font-medium">{fmtCurrency(l.total_price)}</td>
                        <td className="td text-right">
                          <ConfirmButton className="text-xs text-red-600 hover:underline" label="Remove"
                            action={deleteLineItem.bind(null, id, l.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {products.length > 0 ? (
                <form action={addLineItem.bind(null, id)} className="grid grid-cols-2 gap-2 p-3 md:grid-cols-5">
                  <select name="product_id" className="input md:col-span-2" required defaultValue="">
                    <option value="" disabled>Add product…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({fmtCurrency(p.unit_price)})</option>)}
                  </select>
                  <input name="quantity" type="number" min="0.01" step="0.01" defaultValue={1} className="input" placeholder="Qty" />
                  <input name="discount_pct" type="number" min="0" max="100" step="0.01" defaultValue={0} className="input" placeholder="Discount %" />
                  <button className="btn-primary justify-center">Add</button>
                </form>
              ) : (
                <p className="p-3 text-sm text-muted">No active products. <Link className="link" href="/products/new">Create a product</Link> to add line items; amount then follows the line-item total.</p>
              )}
            </div>
          )}

          {/* Related lists */}
          {obj.related.map((rl, i) => {
            const t = OBJECTS[rl.object];
            const rows = (relatedRes[i]?.data ?? []) as unknown as Rec[];
            return (
              <div key={rl.object + rl.foreignKey} className="card">
                <div className="flex items-center justify-between border-b border-line p-3">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded text-sm" style={{ background: t.color }}>{t.icon}</span>
                    {rl.label ?? t.plural} ({rows.length}{rows.length === 10 ? "+" : ""})
                  </h3>
                  <Link className="btn" href={`/${t.key}/new?${rl.foreignKey}=${id}&return=${path}`}>New</Link>
                </div>
                {rows.length > 0 && (
                  <table className="w-full">
                    <thead><tr>{rl.columns.map((c) => <th key={c} className="th">{fieldOf(t, c)?.label}</th>)}</tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          {rl.columns.map((c, j) => (
                            <td key={c} className="td">
                              {j === 0 ? <Link className="link" href={`/${t.key}/${r.id}`}>{t.title(r)}</Link> : <FieldValue obj={t} field={fieldOf(t, c)!} rec={r} />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        {/* Activity sidebar */}
        {obj.activityKey && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="border-b border-line p-3 font-semibold">Activity</h3>
              <form action={quickTask.bind(null, obj.key, id)} className="space-y-2 border-b border-line p-3">
                <div className="flex gap-2">
                  <select name="type" className="input w-28" defaultValue="task">
                    <option value="task">Task</option><option value="call">Call</option>
                    <option value="email">Email</option><option value="meeting">Meeting</option>
                  </select>
                  <input name="subject" className="input" placeholder="Subject" required />
                </div>
                <div className="flex gap-2">
                  <input name="due_date" type="date" className="input" />
                  <button className="btn-primary">Save</button>
                </div>
              </form>
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 p-3 text-sm">
                    {t.status === "completed" ? (
                      <span className="mt-0.5 text-green-600">✓</span>
                    ) : (
                      <form action={completeTask.bind(null, t.id, path)}>
                        <button title="Mark complete" className="mt-0.5 h-4 w-4 rounded border border-muted hover:border-brand" />
                      </form>
                    )}
                    <div className="flex-1">
                      <Link href={`/tasks/${t.id}`} className={`link ${t.status === "completed" ? "line-through opacity-60" : ""}`}>{t.subject}</Link>
                      <div className="text-xs text-muted capitalize">{t.type} · {t.due_date ? fmtDate(t.due_date) : "No due date"}</div>
                    </div>
                  </li>
                ))}
                {tasks.length === 0 && <li className="p-3 text-sm text-muted">No activities yet.</li>}
              </ul>
            </div>

            <div className="card">
              <h3 className="border-b border-line p-3 font-semibold">Notes</h3>
              <form action={addNote.bind(null, obj.key, id)} className="space-y-2 border-b border-line p-3">
                <textarea name="body" className="input" rows={3} placeholder="Write a note…" required />
                <button className="btn-primary">Add Note</button>
              </form>
              <ul className="divide-y divide-line">
                {notes.map((n) => (
                  <li key={n.id} className="p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <div className="mt-1 flex justify-between text-xs text-muted">
                      <span>{n.owner?.full_name ?? n.owner?.email} · {fmtDate(n.created_at)}</span>
                      <ConfirmButton className="text-red-600 hover:underline" label="Delete" action={deleteNote.bind(null, obj.key, id, n.id)} />
                    </div>
                  </li>
                ))}
                {notes.length === 0 && <li className="p-3 text-sm text-muted">No notes yet.</li>}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
