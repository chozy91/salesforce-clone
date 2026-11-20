import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ENUMS, humanize } from "@/lib/objects";
import { fmtCurrency, fmtDate } from "@/lib/format";

export default async function Home() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string;

  const now = new Date();
  const qStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1)).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [pipeline, won, leads, cases, myTasks, closing, recentLeads] = await Promise.all([
    supabase.from("pipeline_by_stage").select("*"),
    supabase.from("opportunities").select("amount").eq("stage", "closed_won").gte("close_date", qStart),
    supabase.from("leads").select("id", { count: "exact", head: true }).not("status", "in", "(converted,unqualified)"),
    supabase.from("cases").select("id", { count: "exact", head: true }).neq("status", "closed"),
    supabase.from("tasks").select("id,subject,type,due_date,priority").eq("owner_id", uid).neq("status", "completed")
      .order("due_date", { ascending: true, nullsFirst: false }).limit(8),
    supabase.from("opportunities").select("id,name,amount,stage,close_date,account:accounts!opportunities_account_id_fkey(name)")
      .eq("is_closed", false).order("close_date").limit(6),
    supabase.from("leads").select("id,first_name,last_name,company,status,rating,created_at")
      .neq("status", "converted").order("created_at", { ascending: false }).limit(6),
  ]);

  const stages = (pipeline.data ?? []) as { stage: string; deal_count: number; total_amount: number; weighted_amount: number }[];
  const open = stages.filter((s) => s.stage !== "closed_won" && s.stage !== "closed_lost");
  const openTotal = open.reduce((a, s) => a + Number(s.total_amount), 0);
  const weighted = open.reduce((a, s) => a + Number(s.weighted_amount), 0);
  const wonQ = (won.data ?? []).reduce((a, o) => a + Number(o.amount ?? 0), 0);
  const max = Math.max(1, ...stages.map((s) => Number(s.total_amount)));

  const kpis = [
    { label: "Open Pipeline", value: fmtCurrency(openTotal), href: "/pipeline" },
    { label: "Weighted Pipeline", value: fmtCurrency(weighted), href: "/pipeline" },
    { label: "Won This Quarter", value: fmtCurrency(wonQ), href: "/opportunities?sort=close_date&dir=desc" },
    { label: "Open Leads", value: String(leads.count ?? 0), href: "/leads" },
    { label: "Open Cases", value: String(cases.count ?? 0), href: "/cases" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card p-4 hover:border-brand">
            <div className="text-xs uppercase tracking-wide text-muted">{k.label}</div>
            <div className="mt-1 text-2xl font-semibold">{k.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Pipeline by Stage</h2>
          <div className="space-y-2">
            {ENUMS.opportunity_stage.map((st) => {
              const s = stages.find((x) => x.stage === st);
              const amt = Number(s?.total_amount ?? 0);
              const color = st === "closed_won" ? "#2e844a" : st === "closed_lost" ? "#ba0517" : "#0176d3";
              return (
                <div key={st} className="grid grid-cols-[140px_1fr_110px] items-center gap-3 text-sm">
                  <span className="truncate text-muted">{humanize(st)}</span>
                  <div className="h-5 rounded bg-surface">
                    <div className="h-5 rounded" style={{ width: `${(amt / max) * 100}%`, background: color, minWidth: amt ? 4 : 0 }} />
                  </div>
                  <span className="text-right tabular-nums">{fmtCurrency(amt)} <span className="text-xs text-muted">({s?.deal_count ?? 0})</span></span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between border-b border-line p-3">
            <h2 className="font-semibold">My Open Tasks</h2>
            <Link href="/tasks/new" className="btn">New</Link>
          </div>
          <ul className="divide-y divide-line">
            {(myTasks.data ?? []).map((t) => (
              <li key={t.id} className="p-3 text-sm">
                <Link className="link" href={`/tasks/${t.id}`}>{t.subject}</Link>
                <div className={`text-xs ${t.due_date && t.due_date < today ? "font-medium text-red-600" : "text-muted"}`}>
                  {humanize(t.type)} · {t.due_date ? `Due ${fmtDate(t.due_date)}` : "No due date"}
                </div>
              </li>
            ))}
            {!myTasks.data?.length && <li className="p-3 text-sm text-muted">You&apos;re all caught up.</li>}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="border-b border-line p-3 font-semibold">Opportunities Closing Soon</h2>
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Stage</th><th className="th">Amount</th><th className="th">Close</th></tr></thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(closing.data ?? []).map((o: any) => (
                <tr key={o.id}>
                  <td className="td"><Link className="link" href={`/opportunities/${o.id}`}>{o.name}</Link><div className="text-xs text-muted">{o.account?.name}</div></td>
                  <td className="td">{humanize(o.stage)}</td>
                  <td className="td">{fmtCurrency(o.amount)}</td>
                  <td className={`td ${o.close_date < today ? "text-red-600" : ""}`}>{fmtDate(o.close_date)}</td>
                </tr>
              ))}
              {!closing.data?.length && <tr><td colSpan={4} className="td text-center text-muted">No open opportunities.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="border-b border-line p-3 font-semibold">Recent Leads</h2>
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Company</th><th className="th">Status</th><th className="th">Rating</th></tr></thead>
            <tbody>
              {(recentLeads.data ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="td"><Link className="link" href={`/leads/${l.id}`}>{[l.first_name, l.last_name].filter(Boolean).join(" ")}</Link></td>
                  <td className="td">{l.company}</td>
                  <td className="td">{humanize(l.status)}</td>
                  <td className="td">{humanize(l.rating)}</td>
                </tr>
              ))}
              {!recentLeads.data?.length && <tr><td colSpan={4} className="td text-center text-muted">No leads yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
