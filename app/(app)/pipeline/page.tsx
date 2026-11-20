import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Kanban from "@/components/Kanban";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  let q = supabase
    .from("opportunities")
    .select("id,name,amount,close_date,stage,account:accounts!opportunities_account_id_fkey(name),owner:profiles!opportunities_owner_id_fkey(full_name)")
    .order("close_date")
    .limit(500);
  if (scope === "mine") q = q.eq("owner_id", claims?.claims?.sub as string);
  const { data } = await q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cards = (data ?? []).map((o: any) => ({
    id: o.id, name: o.name, amount: o.amount, close_date: o.close_date, stage: o.stage,
    account: o.account?.name ?? null, owner: o.owner?.full_name ?? null,
  }));

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <h1 className="mr-auto text-lg font-semibold">Opportunity Pipeline</h1>
        <div className="flex overflow-hidden rounded border border-line text-sm">
          <Link href="/pipeline" className={`px-3 py-1.5 ${scope !== "mine" ? "bg-brand text-white" : "bg-white"}`}>All</Link>
          <Link href="/pipeline?scope=mine" className={`px-3 py-1.5 ${scope === "mine" ? "bg-brand text-white" : "bg-white"}`}>Mine</Link>
        </div>
        <Link href="/opportunities/new?return=/pipeline" className="btn-primary">New Opportunity</Link>
      </div>
      <p className="text-xs text-muted">Drag cards between columns (or use the dropdown) to change stage. Probability updates automatically.</p>
      <Kanban cards={cards} />
    </div>
  );
}
