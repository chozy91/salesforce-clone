import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OBJECTS, type ObjectKey, type Rec } from "@/lib/objects";

const SEARCHABLE: ObjectKey[] = ["accounts", "contacts", "leads", "opportunities", "cases"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.replace(/[%,().*:]/g, " ").trim();
  const supabase = await createClient();

  const results = term
    ? await Promise.all(SEARCHABLE.map(async (k) => {
        const o = OBJECTS[k];
        const { data } = await supabase.from(o.table)
          .select(["id", ...new Set([...o.titleColumns, ...o.searchColumns])].join(","))
          .or(o.searchColumns.map((c) => `${c}.ilike.%${term}%`).join(","))
          .limit(10);
        return { o, rows: (data ?? []) as unknown as Rec[] };
      }))
    : [];
  const total = results.reduce((a, r) => a + r.rows.length, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{term ? <>Search results for &ldquo;{term}&rdquo; ({total})</> : "Search"}</h1>
      {results.filter((r) => r.rows.length).map(({ o, rows }) => (
        <div key={o.key} className="card">
          <h2 className="flex items-center gap-2 border-b border-line p-3 font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded text-sm" style={{ background: o.color }}>{o.icon}</span>{o.plural}
          </h2>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <Link className="link font-medium" href={`/${o.key}/${r.id}`}>{o.title(r)}</Link>
                <span className="ml-2 text-muted">{o.searchColumns.filter((c) => !o.titleColumns.includes(c)).map((c) => r[c]).filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {term && total === 0 && <p className="text-muted">No matches.</p>}
    </div>
  );
}
