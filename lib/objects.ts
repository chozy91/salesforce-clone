// Metadata-driven object model, in the spirit of Salesforce's object/field setup.
// Every list, detail, form and related list is rendered from these definitions.

export type FieldType =
  | "text" | "textarea" | "email" | "phone" | "url"
  | "number" | "currency" | "percent" | "date" | "datetime"
  | "picklist" | "lookup" | "boolean";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean; // shown on detail, never written by forms
  options?: readonly string[]; // picklist values
  lookup?: ObjectKey; // target object for lookups
  section?: string;
};

export type RelatedList = {
  object: ObjectKey;
  foreignKey: string;
  label?: string;
  columns: string[];
};

export type ObjectDef = {
  key: ObjectKey;
  table: string;
  label: string;
  plural: string;
  icon: string;
  color: string;
  /** columns needed to build a record title */
  titleColumns: string[];
  title: (r: Rec) => string;
  searchColumns: string[];
  listColumns: string[];
  defaultSort: { column: string; ascending: boolean };
  fields: Field[];
  related: RelatedList[];
  /** column name used by tasks/notes to point at this object */
  activityKey?: string;
  inNav?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = Record<string, any>;

export const ENUMS = {
  account_type: ["prospect", "customer", "partner", "reseller", "competitor", "other"],
  lead_status: ["new", "working", "nurturing", "qualified", "unqualified", "converted"],
  lead_rating: ["hot", "warm", "cold"],
  lead_source: ["web", "phone_inquiry", "partner_referral", "purchased_list", "trade_show", "social", "email_campaign", "other"],
  opportunity_stage: ["prospecting", "qualification", "needs_analysis", "value_proposition", "proposal", "negotiation", "closed_won", "closed_lost"],
  opportunity_type: ["new_business", "existing_business", "renewal", "upsell"],
  case_status: ["new", "working", "escalated", "on_hold", "closed"],
  case_priority: ["low", "medium", "high", "critical"],
  case_origin: ["email", "phone", "web", "chat"],
  task_status: ["not_started", "in_progress", "waiting", "completed", "deferred"],
  task_priority: ["low", "normal", "high"],
  task_type: ["task", "call", "email", "meeting"],
} as const;

export type ObjectKey =
  | "accounts" | "contacts" | "leads" | "opportunities"
  | "products" | "cases" | "tasks";

const personTitle = (r: Rec) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "(no name)";

const ownerField: Field = { name: "owner_id", label: "Owner", type: "lookup", lookup: undefined, readOnly: true, section: "System" };
const systemFields: Field[] = [
  ownerField,
  { name: "created_at", label: "Created", type: "datetime", readOnly: true, section: "System" },
  { name: "updated_at", label: "Last Modified", type: "datetime", readOnly: true, section: "System" },
];

const address = (prefix: string, section: string): Field[] => [
  { name: `${prefix}street`, label: "Street", type: "text", section },
  { name: `${prefix}city`, label: "City", type: "text", section },
  { name: `${prefix}state`, label: "State/Province", type: "text", section },
  { name: `${prefix}postal_code`, label: "Postal Code", type: "text", section },
  { name: `${prefix}country`, label: "Country", type: "text", section },
];

export const OBJECTS: Record<ObjectKey, ObjectDef> = {
  accounts: {
    key: "accounts", table: "accounts", label: "Account", plural: "Accounts", icon: "🏢", color: "#7f8de1",
    titleColumns: ["name"], title: (r) => r.name,
    searchColumns: ["name", "industry", "billing_city"],
    listColumns: ["name", "type", "industry", "phone", "billing_city", "owner_id"],
    defaultSort: { column: "name", ascending: true },
    activityKey: "account_id", inNav: true,
    fields: [
      { name: "name", label: "Account Name", type: "text", required: true, section: "Account Information" },
      { name: "type", label: "Type", type: "picklist", options: ENUMS.account_type, section: "Account Information" },
      { name: "industry", label: "Industry", type: "text", section: "Account Information" },
      { name: "parent_account_id", label: "Parent Account", type: "lookup", lookup: "accounts", section: "Account Information" },
      { name: "website", label: "Website", type: "url", section: "Account Information" },
      { name: "phone", label: "Phone", type: "phone", section: "Account Information" },
      { name: "annual_revenue", label: "Annual Revenue", type: "currency", section: "Account Information" },
      { name: "employees", label: "Employees", type: "number", section: "Account Information" },
      ...address("billing_", "Billing Address"),
      { name: "description", label: "Description", type: "textarea", section: "Description" },
      ...systemFields,
    ],
    related: [
      { object: "contacts", foreignKey: "account_id", columns: ["last_name", "title", "email", "phone"] },
      { object: "opportunities", foreignKey: "account_id", columns: ["name", "stage", "amount", "close_date"] },
      { object: "cases", foreignKey: "account_id", columns: ["case_number", "subject", "status", "priority"] },
      { object: "accounts", foreignKey: "parent_account_id", label: "Child Accounts", columns: ["name", "type", "industry"] },
    ],
  },
  contacts: {
    key: "contacts", table: "contacts", label: "Contact", plural: "Contacts", icon: "👤", color: "#a094ed",
    titleColumns: ["first_name", "last_name"], title: personTitle,
    searchColumns: ["first_name", "last_name", "email", "title"],
    listColumns: ["last_name", "account_id", "title", "email", "phone", "owner_id"],
    defaultSort: { column: "last_name", ascending: true },
    activityKey: "contact_id", inNav: true,
    fields: [
      { name: "first_name", label: "First Name", type: "text", section: "Contact Information" },
      { name: "last_name", label: "Last Name", type: "text", required: true, section: "Contact Information" },
      { name: "account_id", label: "Account", type: "lookup", lookup: "accounts", section: "Contact Information" },
      { name: "title", label: "Title", type: "text", section: "Contact Information" },
      { name: "department", label: "Department", type: "text", section: "Contact Information" },
      { name: "email", label: "Email", type: "email", section: "Contact Information" },
      { name: "phone", label: "Phone", type: "phone", section: "Contact Information" },
      { name: "mobile", label: "Mobile", type: "phone", section: "Contact Information" },
      { name: "lead_source", label: "Lead Source", type: "picklist", options: ENUMS.lead_source, section: "Contact Information" },
      { name: "birthdate", label: "Birthdate", type: "date", section: "Contact Information" },
      ...address("mailing_", "Mailing Address"),
      { name: "description", label: "Description", type: "textarea", section: "Description" },
      ...systemFields,
    ],
    related: [
      { object: "opportunities", foreignKey: "contact_id", columns: ["name", "stage", "amount", "close_date"] },
      { object: "cases", foreignKey: "contact_id", columns: ["case_number", "subject", "status", "priority"] },
    ],
  },
  leads: {
    key: "leads", table: "leads", label: "Lead", plural: "Leads", icon: "⭐", color: "#f88962",
    titleColumns: ["first_name", "last_name"], title: personTitle,
    searchColumns: ["first_name", "last_name", "company", "email"],
    listColumns: ["last_name", "company", "status", "rating", "email", "owner_id"],
    defaultSort: { column: "created_at", ascending: false },
    activityKey: "lead_id", inNav: true,
    fields: [
      { name: "first_name", label: "First Name", type: "text", section: "Lead Information" },
      { name: "last_name", label: "Last Name", type: "text", required: true, section: "Lead Information" },
      { name: "company", label: "Company", type: "text", required: true, section: "Lead Information" },
      { name: "title", label: "Title", type: "text", section: "Lead Information" },
      { name: "status", label: "Lead Status", type: "picklist", options: ENUMS.lead_status.filter((s) => s !== "converted"), section: "Lead Information" },
      { name: "rating", label: "Rating", type: "picklist", options: ENUMS.lead_rating, section: "Lead Information" },
      { name: "source", label: "Lead Source", type: "picklist", options: ENUMS.lead_source, section: "Lead Information" },
      { name: "email", label: "Email", type: "email", section: "Lead Information" },
      { name: "phone", label: "Phone", type: "phone", section: "Lead Information" },
      { name: "website", label: "Website", type: "url", section: "Lead Information" },
      { name: "industry", label: "Industry", type: "text", section: "Lead Information" },
      { name: "annual_revenue", label: "Annual Revenue", type: "currency", section: "Lead Information" },
      { name: "employees", label: "Employees", type: "number", section: "Lead Information" },
      ...address("", "Address"),
      { name: "description", label: "Description", type: "textarea", section: "Description" },
      { name: "converted_at", label: "Converted", type: "datetime", readOnly: true, section: "Conversion" },
      { name: "converted_account_id", label: "Converted Account", type: "lookup", lookup: "accounts", readOnly: true, section: "Conversion" },
      { name: "converted_contact_id", label: "Converted Contact", type: "lookup", lookup: "contacts", readOnly: true, section: "Conversion" },
      { name: "converted_opportunity_id", label: "Converted Opportunity", type: "lookup", lookup: "opportunities", readOnly: true, section: "Conversion" },
      ...systemFields,
    ],
    related: [],
  },
  opportunities: {
    key: "opportunities", table: "opportunities", label: "Opportunity", plural: "Opportunities", icon: "💰", color: "#fcb95b",
    titleColumns: ["name"], title: (r) => r.name,
    searchColumns: ["name", "next_step"],
    listColumns: ["name", "account_id", "stage", "amount", "close_date", "owner_id"],
    defaultSort: { column: "close_date", ascending: true },
    activityKey: "opportunity_id", inNav: true,
    fields: [
      { name: "name", label: "Opportunity Name", type: "text", required: true, section: "Opportunity Information" },
      { name: "account_id", label: "Account", type: "lookup", lookup: "accounts", section: "Opportunity Information" },
      { name: "contact_id", label: "Primary Contact", type: "lookup", lookup: "contacts", section: "Opportunity Information" },
      { name: "stage", label: "Stage", type: "picklist", options: ENUMS.opportunity_stage, required: true, section: "Opportunity Information" },
      { name: "amount", label: "Amount", type: "currency", section: "Opportunity Information" },
      { name: "probability", label: "Probability (%)", type: "percent", section: "Opportunity Information" },
      { name: "close_date", label: "Close Date", type: "date", required: true, section: "Opportunity Information" },
      { name: "type", label: "Type", type: "picklist", options: ENUMS.opportunity_type, section: "Opportunity Information" },
      { name: "lead_source", label: "Lead Source", type: "picklist", options: ENUMS.lead_source, section: "Opportunity Information" },
      { name: "next_step", label: "Next Step", type: "text", section: "Opportunity Information" },
      { name: "description", label: "Description", type: "textarea", section: "Description" },
      ...systemFields,
    ],
    related: [], // products are shown via the dedicated line-items panel
  },
  products: {
    key: "products", table: "products", label: "Product", plural: "Products", icon: "📦", color: "#b781d3",
    titleColumns: ["name"], title: (r) => r.name,
    searchColumns: ["name", "product_code", "family"],
    listColumns: ["name", "product_code", "family", "unit_price", "is_active"],
    defaultSort: { column: "name", ascending: true },
    inNav: true,
    fields: [
      { name: "name", label: "Product Name", type: "text", required: true, section: "Product Information" },
      { name: "product_code", label: "Product Code", type: "text", section: "Product Information" },
      { name: "family", label: "Product Family", type: "text", section: "Product Information" },
      { name: "unit_price", label: "List Price", type: "currency", required: true, section: "Product Information" },
      { name: "is_active", label: "Active", type: "boolean", section: "Product Information" },
      { name: "description", label: "Description", type: "textarea", section: "Description" },
      ...systemFields,
    ],
    related: [],
  },
  cases: {
    key: "cases", table: "cases", label: "Case", plural: "Cases", icon: "🎧", color: "#f2cf5b",
    titleColumns: ["case_number", "subject"], title: (r) => `${r.case_number ?? ""} ${r.subject ?? ""}`.trim(),
    searchColumns: ["case_number", "subject"],
    listColumns: ["case_number", "subject", "account_id", "status", "priority", "owner_id"],
    defaultSort: { column: "created_at", ascending: false },
    activityKey: "case_id", inNav: true,
    fields: [
      { name: "case_number", label: "Case Number", type: "text", readOnly: true, section: "Case Information" },
      { name: "subject", label: "Subject", type: "text", required: true, section: "Case Information" },
      { name: "status", label: "Status", type: "picklist", options: ENUMS.case_status, section: "Case Information" },
      { name: "priority", label: "Priority", type: "picklist", options: ENUMS.case_priority, section: "Case Information" },
      { name: "origin", label: "Case Origin", type: "picklist", options: ENUMS.case_origin, section: "Case Information" },
      { name: "account_id", label: "Account", type: "lookup", lookup: "accounts", section: "Case Information" },
      { name: "contact_id", label: "Contact", type: "lookup", lookup: "contacts", section: "Case Information" },
      { name: "closed_at", label: "Closed", type: "datetime", readOnly: true, section: "Case Information" },
      { name: "description", label: "Description", type: "textarea", section: "Description" },
      ...systemFields,
    ],
    related: [],
  },
  tasks: {
    key: "tasks", table: "tasks", label: "Task", plural: "Tasks", icon: "✅", color: "#4bc076",
    titleColumns: ["subject"], title: (r) => r.subject,
    searchColumns: ["subject"],
    listColumns: ["subject", "type", "status", "priority", "due_date", "owner_id"],
    defaultSort: { column: "due_date", ascending: true },
    inNav: true,
    fields: [
      { name: "subject", label: "Subject", type: "text", required: true, section: "Task Information" },
      { name: "type", label: "Type", type: "picklist", options: ENUMS.task_type, section: "Task Information" },
      { name: "status", label: "Status", type: "picklist", options: ENUMS.task_status, section: "Task Information" },
      { name: "priority", label: "Priority", type: "picklist", options: ENUMS.task_priority, section: "Task Information" },
      { name: "due_date", label: "Due Date", type: "date", section: "Task Information" },
      { name: "account_id", label: "Account", type: "lookup", lookup: "accounts", section: "Related To" },
      { name: "contact_id", label: "Contact", type: "lookup", lookup: "contacts", section: "Related To" },
      { name: "lead_id", label: "Lead", type: "lookup", lookup: "leads", section: "Related To" },
      { name: "opportunity_id", label: "Opportunity", type: "lookup", lookup: "opportunities", section: "Related To" },
      { name: "case_id", label: "Case", type: "lookup", lookup: "cases", section: "Related To" },
      { name: "description", label: "Comments", type: "textarea", section: "Description" },
      { name: "completed_at", label: "Completed", type: "datetime", readOnly: true, section: "System" },
      ...systemFields,
    ],
    related: [],
  },
};

export const NAV: ObjectKey[] = ["accounts", "contacts", "leads", "opportunities", "cases", "tasks", "products"];

export function getObject(key: string): ObjectDef | null {
  return (OBJECTS as Record<string, ObjectDef>)[key] ?? null;
}

export function fieldOf(obj: ObjectDef, name: string): Field | undefined {
  return obj.fields.find((f) => f.name === name);
}

export function editableFields(obj: ObjectDef): Field[] {
  return obj.fields.filter((f) => !f.readOnly);
}

export function humanize(v: string | null | undefined): string {
  if (!v) return "";
  return v.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Builds a PostgREST select string that embeds lookup targets and the owner,
 * using explicit FK hints (tables reference profiles via both owner_id and created_by).
 */
export function selectFor(obj: ObjectDef, columns?: string[]): string {
  const cols = new Set<string>(["id", ...obj.titleColumns, ...(columns ?? obj.fields.map((f) => f.name))]);
  const parts: string[] = [];
  for (const c of cols) {
    parts.push(c);
    const f = fieldOf(obj, c);
    if (f?.type === "lookup") {
      if (c === "owner_id") {
        parts.push(`owner_id__ref:profiles!${obj.table}_owner_id_fkey(id,full_name,email)`);
      } else if (f.lookup) {
        const t = OBJECTS[f.lookup];
        parts.push(`${c}__ref:${t.table}!${obj.table}_${c}_fkey(${["id", ...t.titleColumns].join(",")})`);
      }
    }
  }
  return parts.join(",");
}

export function refLabel(obj: ObjectDef, field: Field, rec: Rec): { label: string; href: string | null } | null {
  const ref = rec[`${field.name}__ref`];
  if (!ref) return null;
  if (field.name === "owner_id") return { label: ref.full_name || ref.email, href: null };
  if (!field.lookup) return null;
  const target = OBJECTS[field.lookup];
  return { label: target.title(ref), href: `/${target.key}/${ref.id}` };
}
