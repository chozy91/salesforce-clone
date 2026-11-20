"use client";

import { useTransition } from "react";
import { setOpportunityStage } from "@/app/(app)/actions";
import { ENUMS, humanize } from "@/lib/objects";

export default function StagePath({ id, stage }: { id: string; stage: string }) {
  const [pending, start] = useTransition();
  const stages = ENUMS.opportunity_stage;
  const current = stages.indexOf(stage as (typeof stages)[number]);
  return (
    <div className={`flex overflow-x-auto rounded-full bg-surface p-1 text-xs ${pending ? "opacity-60" : ""}`}>
      {stages.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const lost = active && s === "closed_lost";
        const cls = lost ? "bg-red-600 text-white" : active ? "bg-brand-dark text-white" : done ? "bg-[#4bca81] text-white" : "bg-[#e5e5e5] text-ink hover:bg-[#d8d8d8]";
        return (
          <button key={s} type="button" disabled={pending || active}
            onClick={() => start(async () => { const e = await setOpportunityStage(id, s); if (e) alert(e); })}
            className={`mx-0.5 flex-1 whitespace-nowrap rounded-full px-3 py-1.5 font-medium ${cls}`}
            title={`Mark as ${humanize(s)}`}>
            {done ? "✓ " : ""}{humanize(s)}
          </button>
        );
      })}
    </div>
  );
}
