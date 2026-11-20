"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setOpportunityStage } from "@/app/(app)/actions";
import { ENUMS, humanize } from "@/lib/objects";
import { fmtCurrency, fmtDate } from "@/lib/format";

type Card = { id: string; name: string; amount: number | null; close_date: string; stage: string; account: string | null; owner: string | null };

export default function Kanban({ cards }: { cards: Card[] }) {
  const [, start] = useTransition();
  const [optimistic, move] = useOptimistic(cards, (state, { id, stage }: { id: string; stage: string }) =>
    state.map((c) => (c.id === id ? { ...c, stage } : c))
  );

  const drop = (stage: string, id: string) => {
    const card = optimistic.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    start(async () => {
      move({ id, stage });
      const err = await setOpportunityStage(id, stage);
      if (err) alert(err);
    });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {ENUMS.opportunity_stage.map((stage) => {
        const col = optimistic.filter((c) => c.stage === stage);
        const total = col.reduce((a, c) => a + Number(c.amount ?? 0), 0);
        return (
          <div key={stage} className="flex w-64 shrink-0 flex-col rounded-md bg-[#e9edf3]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(stage, e.dataTransfer.getData("text/plain"))}>
            <div className={`rounded-t-md border-b-4 p-2 ${stage === "closed_won" ? "border-green-500" : stage === "closed_lost" ? "border-red-500" : "border-brand"}`}>
              <div className="text-sm font-semibold">{humanize(stage)} <span className="text-muted">({col.length})</span></div>
              <div className="text-xs text-muted">{fmtCurrency(total)}</div>
            </div>
            <div className="min-h-32 flex-1 space-y-2 p-2">
              {col.map((c) => (
                <div key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                  className="cursor-grab rounded border border-line bg-white p-2 text-sm shadow-sm active:cursor-grabbing">
                  <Link href={`/opportunities/${c.id}`} className="link font-medium">{c.name}</Link>
                  {c.account && <div className="text-xs text-muted">{c.account}</div>}
                  <div className="mt-1 flex justify-between text-xs">
                    <span className="font-medium">{fmtCurrency(c.amount)}</span>
                    <span className="text-muted">{fmtDate(c.close_date)}</span>
                  </div>
                  <select aria-label="Move to stage" value={c.stage} onChange={(e) => drop(e.target.value, c.id)}
                    className="mt-2 w-full rounded border border-line bg-surface px-1 py-0.5 text-xs">
                    {ENUMS.opportunity_stage.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
