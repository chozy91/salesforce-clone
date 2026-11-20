"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/(app)/actions";
import { humanize, type Field, type Rec } from "@/lib/objects";

export type LookupOptions = Record<string, { id: string; label: string }[]>;

export default function RecordForm({ fields, record, lookups, action, cancelHref, returnTo }: {
  fields: Field[];
  record: Rec;
  lookups: LookupOptions;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  cancelHref: string;
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const sections = [...new Set(fields.map((f) => f.section ?? "Details"))];

  return (
    <form action={formAction} className="card">
      {returnTo && <input type="hidden" name="__return" value={returnTo} />}
      {state?.error && <div className="m-4 rounded bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      {sections.map((s) => (
        <section key={s} className="border-b border-line p-4 last:border-0">
          <h3 className="mb-3 rounded bg-surface px-2 py-1 text-sm font-semibold">{s}</h3>
          <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {fields.filter((f) => (f.section ?? "Details") === s).map((f) => (
              <div key={f.name} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                <label className="label" htmlFor={f.name}>
                  {f.required && <span className="mr-0.5 text-red-600">*</span>}{f.label}
                </label>
                <Input field={f} value={record[f.name]} options={lookups[f.name]} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-0 flex justify-center gap-2 border-t border-line bg-surface p-3">
        <Link href={cancelHref} className="btn">Cancel</Link>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function Input({ field, value, options }: { field: Field; value: unknown; options?: { id: string; label: string }[] }) {
  const common = { id: field.name, name: field.name, required: field.required, className: "input" };
  const v = value === null || value === undefined ? "" : String(value);
  switch (field.type) {
    case "textarea":
      return <textarea {...common} rows={3} defaultValue={v} />;
    case "picklist":
      return (
        <select {...common} defaultValue={v}>
          <option value="">--None--</option>
          {field.options?.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
        </select>
      );
    case "lookup":
      return (
        <select {...common} defaultValue={v}>
          <option value="">--None--</option>
          {options?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      );
    case "boolean":
      return <input id={field.name} name={field.name} type="checkbox" defaultChecked={value === true || value === undefined} className="h-4 w-4" />;
    case "date":
      return <input {...common} type="date" defaultValue={v.slice(0, 10)} />;
    case "number":
    case "currency":
    case "percent":
      return <input {...common} type="number" step={field.type === "currency" ? "0.01" : "1"} min={0} max={field.type === "percent" ? 100 : undefined} defaultValue={v} />;
    case "email":
      return <input {...common} type="email" defaultValue={v} />;
    case "phone":
      return <input {...common} type="tel" defaultValue={v} />;
    default:
      return <input {...common} type="text" defaultValue={v} />;
  }
}
