import { humanize, type Field } from "./objects";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");

export function fmtCurrency(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return currency.format(Number(v));
}

export function fmtDate(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  // date-only values: avoid timezone shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
  }
  return new Date(s).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtValue(field: Field, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (field.type) {
    case "currency": return fmtCurrency(v);
    case "number": return number.format(Number(v));
    case "percent": return `${v}%`;
    case "date":
    case "datetime": return fmtDate(v);
    case "picklist": return humanize(String(v));
    case "boolean": return v ? "Yes" : "No";
    default: return String(v);
  }
}
