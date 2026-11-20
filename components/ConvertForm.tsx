"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/(app)/actions";

export default function ConvertForm({ action, company, accounts, suggestedAccountId }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  company: string;
  accounts: { id: string; name: string }[];
  suggestedAccountId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [useExisting, setUseExisting] = useState(!!suggestedAccountId);
  const [createOpp, setCreateOpp] = useState(true);

  return (
    <form action={formAction} className="card space-y-5 p-5">
      {state?.error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold">Account</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={!useExisting} onChange={() => setUseExisting(false)} /> Create new account: <b>{company}</b>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={useExisting} onChange={() => setUseExisting(true)} disabled={accounts.length === 0} /> Choose existing account
        </label>
        {useExisting && (
          <select name="existing_account_id" className="input" defaultValue={suggestedAccountId ?? ""} required>
            <option value="" disabled>Select an account…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold">Contact</legend>
        <p className="text-sm text-muted">A new contact is created from the lead&apos;s details.</p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold">Opportunity</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="create_opportunity" checked={createOpp} onChange={(e) => setCreateOpp(e.target.checked)} /> Create an opportunity
        </label>
        {createOpp && <input name="opportunity_name" className="input" defaultValue={`${company} - New Deal`} />}
      </fieldset>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>{pending ? "Converting…" : "Convert"}</button>
      </div>
    </form>
  );
}
