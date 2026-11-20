import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { convertLead } from "@/app/(app)/actions";
import ConvertForm from "@/components/ConvertForm";

export default async function ConvertLeadPage({ params }: { params: Promise<{ object: string; id: string }> }) {
  const { object, id } = await params;
  if (object !== "leads") notFound();
  const supabase = await createClient();
  const [{ data: lead }, { data: accounts }] = await Promise.all([
    supabase.from("leads").select("id,first_name,last_name,company,status").eq("id", id).maybeSingle(),
    supabase.from("accounts").select("id,name").order("name").limit(1000),
  ]);
  if (!lead) notFound();
  if (lead.status === "converted") redirect(`/leads/${id}`);

  // Suggest an existing account whose name matches the lead's company
  const match = accounts?.find((a) => a.name.trim().toLowerCase() === lead.company.trim().toLowerCase());

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 text-sm"><Link className="link" href={`/leads/${id}`}>← Back to lead</Link></div>
      <h1 className="mb-3 text-xl font-semibold">Convert Lead: {[lead.first_name, lead.last_name].filter(Boolean).join(" ")}</h1>
      <ConvertForm
        action={convertLead.bind(null, id)}
        company={lead.company}
        accounts={accounts ?? []}
        suggestedAccountId={match?.id}
      />
    </div>
  );
}
