# Sales Cloud Clone

A Salesforce-style CRM built with **Next.js 16 (App Router)**, **Supabase** (Postgres, Auth, RLS) and **Tailwind CSS 4**. Deploys to Vercel with no extra config.

## Features

- **Standard objects:** Accounts, Contacts, Leads, Opportunities, Products, Cases, Tasks, plus Notes and opportunity line items
- **Metadata-driven UI** (`lib/objects.ts`): list views, record pages, forms and related lists are all generated from object/field definitions. Add a field there and to the database and it appears everywhere
- **List views:** search, sort by any column, All/Mine scope, pagination
- **Record pages:** highlights panel, sectioned details, related lists with prefilled "New", activity timeline (quick task/call/email/meeting), notes
- **Opportunities:** clickable stage path, drag-and-drop Kanban pipeline, products/line items with discounts (amount auto-rolls up)
- **Lead conversion:** creates or reuses an Account, creates a Contact and optional Opportunity, moves activities across. Runs as one database transaction (`convert_lead` RPC)
- **Home dashboard:** open/weighted pipeline, won this quarter, open leads/cases, pipeline by stage, tasks due, deals closing soon
- **Global search** across the main objects
- **Auth:** email/password via Supabase. The first user to sign up becomes the workspace admin

## Data model and security

Schema: `supabase/migrations/`.

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`; role (`admin`, `manager`, `sales_rep`, `support_agent`) |
| `accounts` | Companies; self-referencing `parent_account_id` hierarchy |
| `contacts` | People, optionally linked to an account |
| `leads` | Unqualified prospects; conversion fields link to the created records |
| `opportunities` | Deals; stage enum, probability auto-set by stage, generated `is_closed`/`is_won` |
| `products`, `opportunity_line_items` | Price book; line-item `total_price` is generated, opportunity `amount` is synced by trigger |
| `cases` | Support tickets; auto-numbered `CS-001000`, `closed_at` maintained by trigger |
| `tasks` | Activities with explicit FKs to account/contact/lead/opportunity/case |
| `notes` | Notes attached to any main record |
| `pipeline_by_stage` | Reporting view (`security_invoker`, so RLS applies) |

**Row Level Security** is on for every table. It's a single-workspace model: any signed-in user can read all records. Records are created with the creator as owner, and only the owner or an admin can edit or delete them. Users can't change their own role. Helper functions live in a non-exposed `private` schema.

## Local development

```bash
cp .env.example .env.local   # already points at the Supabase project
npm install
npm run dev
```

## Deploy to Vercel

1. Import `chozy91/salesforce-clone` in Vercel (framework is auto-detected as Next.js).
2. Add the environment variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Deploy.
4. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel URL. Then add `https://<your-app>.vercel.app/auth/callback` (and `http://localhost:3000/auth/callback`) to **Redirect URLs** so the email confirmation links work.

To skip email confirmation while testing, turn off **Confirm email** under Authentication → Providers → Email.

## Applying migrations to another project

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```
