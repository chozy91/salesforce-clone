import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldOf, getObject, selectFor } from "@/lib/objects";
import FieldValue from "@/components/FieldValue";

const PAGE_SIZE = 50;

export default async function ListView({ params, searchParams }: {
  params: Promise<{ object: string }>;
  searchParams: Promise<{ q?: string; scope?: string; sort?: string; dir?: string; page?: string; status?: string }>;
}) {
  const { object } = await params;
  const sp = await searchParams;
  const obj = getObject(object);
  if (!obj) notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string;

  const sortCol = sp.sort && fieldOf(obj, sp.sort) ? sp.sort : obj.defaultSort.column;
  const ascending = sp.dir ? sp.dir === "asc" : sortCol === obj.defaultSort.column ? obj.defaultSort.ascending : true;
  const page = Math.max(1, Number(sp.page) || 1);
  const scope = sp.scope === "mine" ? "mine" : "all";

  let query = supabase.from(obj.table).select(selectFor(obj, obj.listColumns), { count: "exact" });
  if (scope === "mine") query = query.eq("owner_id", uid);
  if (sp.q) {
    // strip characters that have meaning in PostgREST filter syntax
    const term = sp.q.replace(/[%,().*:]/g, " ").trim();
    if (term) query = query.or(obj.searchColumns.map((c) => `${c}.ilike.%${term}%`).join(","));
  }
  if (obj.key === "leads" && sp.status !== "all") query = query.neq("status", "converted");
  if (obj.key === "tasks" && sp.status !== "all") query = query.neq("status", "completed");
  query = query.order(sortCol, { ascending, nullsFirst: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const total = count ?? 0;

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, scope: sp.scope, sort: sp.sort, dir: sp.dir, status: sp.status, ...over };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded text-lg" style={{ background: obj.color }}>{obj.icon}</span>
        <div className="mr-auto">
          <div className="text-xs text-muted">{obj.plural}</div>
          <h1 className="text-lg font-semibold">{scope === "mine" ? `My ${obj.plural}` : `All ${obj.plural}`}</h1>
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="scope" value={scope} />
          <input name="q" defaultValue={sp.q} className="input w-56" placeholder={`Search this list…`} />
        </form>
        <div className="flex overflow-hidden rounded border border-line text-sm">
          <Link href={qs({ scope: undefined, page: undefined })} className={`px-3 py-1.5 ${scope === "all" ? "bg-brand text-white" : "bg-white"}`}>All</Link>
          <Link href={qs({ scope: "mine", page: undefined })} className={`px-3 py-1.5 ${scope === "mine" ? "bg-brand text-white" : "bg-white"}`}>Mine</Link>
        </div>
        {(obj.key === "leads" || obj.key === "tasks") && (
          <Link className="btn" href={qs({ status: sp.status === "all" ? undefined : "all", page: undefined })}>
            {sp.status === "all" ? `Hide ${obj.key === "leads" ? "converted" : "completed"}` : `Show ${obj.key === "leads" ? "converted" : "completed"}`}
          </Link>
        )}
        <Link href={`/${obj.key}/new`} className="btn-primary">New</Link>
      </div>
      <div className="px-4 py-2 text-xs text-muted">{total} item{total === 1 ? "" : "s"} · Sorted by {fieldOf(obj, sortCol)?.label}</div>
      {error && <p className="m-4 rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {obj.listColumns.map((c) => {
                const f = fieldOf(obj, c)!;
                const active = c === sortCol;
                return (
                  <th key={c} className="th">
                    <Link href={qs({ sort: c, dir: active && ascending ? "desc" : "asc", page: undefined })} className="hover:text-ink">
                      {f.label}{active ? (ascending ? " ▲" : " ▼") : ""}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="hover:bg-[#f3f6fb]">
                {obj.listColumns.map((c, i) => (
                  <td key={c} className="td">
                    {i === 0 ? (
                      <Link className="link font-medium" href={`/${obj.key}/${r.id}`}>{obj.title(r) || "(untitled)"}</Link>
                    ) : (
                      <FieldValue obj={obj} field={fieldOf(obj, c)!} rec={r} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="td py-10 text-center text-muted" colSpan={obj.listColumns.length}>
                No {obj.plural.toLowerCase()} yet. <Link className="link" href={`/${obj.key}/new`}>Create one</Link>.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 p-3 text-sm">
          {page > 1 && <Link className="btn" href={qs({ page: String(page - 1) })}>Previous</Link>}
          <span className="text-muted">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          {page * PAGE_SIZE < total && <Link className="btn" href={qs({ page: String(page + 1) })}>Next</Link>}
        </div>
      )}
    </div>
  );
}
