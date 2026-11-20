import Link from "next/link";
import { refLabel, type Field, type ObjectDef, type Rec } from "@/lib/objects";
import { fmtValue } from "@/lib/format";

export default function FieldValue({ obj, field, rec }: { obj: ObjectDef; field: Field; rec: Rec }) {
  const v = rec[field.name];
  if (field.type === "lookup") {
    const ref = refLabel(obj, field, rec);
    if (!ref) return null;
    return ref.href ? <Link className="link" href={ref.href}>{ref.label}</Link> : <span>{ref.label}</span>;
  }
  if (v === null || v === undefined || v === "") return null;
  if (field.type === "email") return <a className="link" href={`mailto:${v}`}>{v}</a>;
  if (field.type === "phone") return <a className="link" href={`tel:${v}`}>{v}</a>;
  if (field.type === "url") {
    const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    return <a className="link" href={href} target="_blank" rel="noreferrer">{v}</a>;
  }
  if (field.type === "textarea") return <span className="whitespace-pre-wrap">{v}</span>;
  return <span>{fmtValue(field, v)}</span>;
}
