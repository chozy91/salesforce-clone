-- =====================================================================
-- Salesforce-style CRM schema
-- Objects: profiles, accounts, contacts, leads, opportunities, products,
--          opportunity_line_items, cases, tasks, notes
-- Security model: single workspace. Every signed-in user can read all
-- records; records are created with the creator as owner; only the owner
-- or an admin can update/delete.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;

-- ---------- Enums ----------
create type public.user_role as enum ('admin', 'manager', 'sales_rep', 'support_agent');
create type public.account_type as enum ('prospect', 'customer', 'partner', 'reseller', 'competitor', 'other');
create type public.lead_status as enum ('new', 'working', 'nurturing', 'qualified', 'unqualified', 'converted');
create type public.lead_rating as enum ('hot', 'warm', 'cold');
create type public.lead_source as enum ('web', 'phone_inquiry', 'partner_referral', 'purchased_list', 'trade_show', 'social', 'email_campaign', 'other');
create type public.opportunity_stage as enum ('prospecting', 'qualification', 'needs_analysis', 'value_proposition', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
create type public.opportunity_type as enum ('new_business', 'existing_business', 'renewal', 'upsell');
create type public.case_status as enum ('new', 'working', 'escalated', 'on_hold', 'closed');
create type public.case_priority as enum ('low', 'medium', 'high', 'critical');
create type public.case_origin as enum ('email', 'phone', 'web', 'chat');
create type public.task_status as enum ('not_started', 'in_progress', 'waiting', 'completed', 'deferred');
create type public.task_priority as enum ('low', 'normal', 'high');
create type public.task_type as enum ('task', 'call', 'email', 'meeting');

-- ---------- Shared trigger: updated_at ----------
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Profiles (1:1 with auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  title text,
  role public.user_role not null default 'sales_rep',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    -- the very first user to sign up becomes admin
    case when exists (select 1 from public.profiles) then 'sales_rep'::public.user_role
         else 'admin'::public.user_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

-- ---------- Accounts ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  type public.account_type not null default 'prospect',
  industry text,
  website text,
  phone text,
  annual_revenue numeric(16,2) check (annual_revenue >= 0),
  employees integer check (employees >= 0),
  billing_street text,
  billing_city text,
  billing_state text,
  billing_postal_code text,
  billing_country text,
  description text,
  parent_account_id uuid references public.accounts (id) on delete set null,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Contacts ----------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete set null,
  first_name text,
  last_name text not null check (length(trim(last_name)) > 0),
  title text,
  department text,
  email text,
  phone text,
  mobile text,
  lead_source public.lead_source,
  mailing_street text,
  mailing_city text,
  mailing_state text,
  mailing_postal_code text,
  mailing_country text,
  birthdate date,
  description text,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Opportunities ----------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  account_id uuid references public.accounts (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  stage public.opportunity_stage not null default 'prospecting',
  amount numeric(16,2) check (amount >= 0),
  probability smallint check (probability between 0 and 100),
  close_date date not null default (current_date + 30),
  type public.opportunity_type,
  lead_source public.lead_source,
  next_step text,
  description text,
  is_closed boolean generated always as (stage in ('closed_won', 'closed_lost')) stored,
  is_won boolean generated always as (stage = 'closed_won') stored,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Default probability follows stage (like Salesforce), unless user sets one explicitly on insert
create or replace function private.opportunity_stage_probability()
returns trigger language plpgsql set search_path = '' as $$
declare
  p smallint := case new.stage
    when 'prospecting' then 10 when 'qualification' then 20
    when 'needs_analysis' then 30 when 'value_proposition' then 50
    when 'proposal' then 65 when 'negotiation' then 80
    when 'closed_won' then 100 when 'closed_lost' then 0 end;
begin
  if tg_op = 'INSERT' then
    if new.probability is null then new.probability := p; end if;
  elsif new.stage is distinct from old.stage then
    new.probability := p;
  end if;
  return new;
end $$;

-- ---------- Leads ----------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text not null check (length(trim(last_name)) > 0),
  company text not null check (length(trim(company)) > 0),
  title text,
  email text,
  phone text,
  website text,
  industry text,
  status public.lead_status not null default 'new',
  rating public.lead_rating,
  source public.lead_source,
  annual_revenue numeric(16,2) check (annual_revenue >= 0),
  employees integer check (employees >= 0),
  street text,
  city text,
  state text,
  postal_code text,
  country text,
  description text,
  converted_at timestamptz,
  converted_account_id uuid references public.accounts (id) on delete set null,
  converted_contact_id uuid references public.contacts (id) on delete set null,
  converted_opportunity_id uuid references public.opportunities (id) on delete set null,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Products & line items ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  product_code text unique,
  family text,
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  is_active boolean not null default true,
  description text,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunity_line_items (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  total_price numeric(16,2) generated always as (round(quantity * unit_price * (1 - discount_pct / 100), 2)) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep opportunity.amount in sync with its line items when any exist
create or replace function private.sync_opportunity_amount()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  opp uuid := coalesce(new.opportunity_id, old.opportunity_id);
begin
  update public.opportunities o
     set amount = (select coalesce(sum(total_price), 0) from public.opportunity_line_items where opportunity_id = opp)
   where o.id = opp;
  return null;
end $$;

-- ---------- Cases ----------
create sequence public.case_number_seq start 1000;

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default ('CS-' || lpad(nextval('public.case_number_seq')::text, 6, '0')),
  subject text not null check (length(trim(subject)) > 0),
  description text,
  status public.case_status not null default 'new',
  priority public.case_priority not null default 'medium',
  origin public.case_origin,
  account_id uuid references public.accounts (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  closed_at timestamptz,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.case_closed_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'closed' and new.closed_at is null then new.closed_at := now();
  elsif new.status <> 'closed' then new.closed_at := null;
  end if;
  return new;
end $$;

-- ---------- Activities: tasks ----------
-- Related-to uses explicit nullable FKs (instead of a polymorphic what_id) so
-- referential integrity and cascades work.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(trim(subject)) > 0),
  type public.task_type not null default 'task',
  status public.task_status not null default 'not_started',
  priority public.task_priority not null default 'normal',
  due_date date,
  description text,
  completed_at timestamptz,
  account_id uuid references public.accounts (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.task_completed_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and new.completed_at is null then new.completed_at := now();
  elsif new.status <> 'completed' then new.completed_at := null;
  end if;
  return new;
end $$;

-- ---------- Notes ----------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (length(trim(body)) > 0),
  account_id uuid references public.accounts (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_has_parent check (num_nonnulls(account_id, contact_id, lead_id, opportunity_id, case_id) >= 1)
);

-- ---------- Triggers ----------
create trigger trg_profiles_updated before update on public.profiles for each row execute function private.set_updated_at();
create trigger trg_accounts_updated before update on public.accounts for each row execute function private.set_updated_at();
create trigger trg_contacts_updated before update on public.contacts for each row execute function private.set_updated_at();
create trigger trg_leads_updated before update on public.leads for each row execute function private.set_updated_at();
create trigger trg_opps_updated before update on public.opportunities for each row execute function private.set_updated_at();
create trigger trg_products_updated before update on public.products for each row execute function private.set_updated_at();
create trigger trg_oli_updated before update on public.opportunity_line_items for each row execute function private.set_updated_at();
create trigger trg_cases_updated before update on public.cases for each row execute function private.set_updated_at();
create trigger trg_tasks_updated before update on public.tasks for each row execute function private.set_updated_at();
create trigger trg_notes_updated before update on public.notes for each row execute function private.set_updated_at();

create trigger trg_opps_probability before insert or update of stage on public.opportunities
  for each row execute function private.opportunity_stage_probability();
create trigger trg_oli_sync_amount after insert or update or delete on public.opportunity_line_items
  for each row execute function private.sync_opportunity_amount();
create trigger trg_cases_closed before insert or update of status on public.cases
  for each row execute function private.case_closed_at();
create trigger trg_tasks_completed before insert or update of status on public.tasks
  for each row execute function private.task_completed_at();

-- ---------- Indexes (FKs, owners, list sorting, search) ----------
create index on public.accounts (owner_id);
create index on public.accounts (parent_account_id);
create index on public.accounts (created_by);
create index accounts_name_trgm on public.accounts using gin (name extensions.gin_trgm_ops);
create index on public.contacts (account_id);
create index on public.contacts (owner_id);
create index on public.contacts (created_by);
create index on public.contacts (email);
create index on public.leads (owner_id);
create index on public.leads (status);
create index on public.leads (created_by);
create index on public.leads (converted_account_id);
create index on public.leads (converted_contact_id);
create index on public.leads (converted_opportunity_id);
create index on public.opportunities (account_id);
create index on public.opportunities (contact_id);
create index on public.opportunities (owner_id);
create index on public.opportunities (created_by);
create index on public.opportunities (stage, close_date);
create index on public.products (owner_id);
create index on public.products (created_by);
create index on public.opportunity_line_items (opportunity_id);
create index on public.opportunity_line_items (product_id);
create index on public.opportunity_line_items (created_by);
create index on public.cases (account_id);
create index on public.cases (contact_id);
create index on public.cases (owner_id);
create index on public.cases (created_by);
create index on public.cases (status, priority);
create index on public.tasks (owner_id, status, due_date);
create index on public.tasks (account_id);
create index on public.tasks (contact_id);
create index on public.tasks (lead_id);
create index on public.tasks (opportunity_id);
create index on public.tasks (case_id);
create index on public.tasks (created_by);
create index on public.notes (account_id);
create index on public.notes (contact_id);
create index on public.notes (lead_id);
create index on public.notes (opportunity_id);
create index on public.notes (case_id);
create index on public.notes (owner_id);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.products enable row level security;
alter table public.opportunity_line_items enable row level security;
alter table public.cases enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;

create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (
    (select private.is_admin())
    -- non-admins cannot change their own role
    or (id = (select auth.uid()) and role = (select p.role from public.profiles p where p.id = (select auth.uid())))
  );

-- Owner-based policies for the standard objects
do $$
declare t text;
begin
  foreach t in array array['accounts','contacts','leads','opportunities','products','cases','tasks','notes'] loop
    execute format('create policy "%1$s readable by signed-in users" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s insert as self" on public.%1$I for insert to authenticated with check (owner_id = (select auth.uid()) or (select private.is_admin()))', t);
    execute format('create policy "%1$s update by owner or admin" on public.%1$I for update to authenticated using (owner_id = (select auth.uid()) or (select private.is_admin())) with check (true)', t);
    execute format('create policy "%1$s delete by owner or admin" on public.%1$I for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_admin()))', t);
  end loop;
end $$;

-- Line items inherit access from their opportunity
create policy "line items readable by signed-in users" on public.opportunity_line_items
  for select to authenticated using (true);
create policy "line items writable by opportunity owner" on public.opportunity_line_items
  for all to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id
                 and (o.owner_id = (select auth.uid()) or (select private.is_admin()))))
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_id
                 and (o.owner_id = (select auth.uid()) or (select private.is_admin()))));

-- ---------- Reporting views (respect caller's RLS) ----------
create view public.pipeline_by_stage with (security_invoker = true) as
select stage,
       count(*)::int as deal_count,
       coalesce(sum(amount), 0)::numeric as total_amount,
       coalesce(sum(amount * probability / 100.0), 0)::numeric as weighted_amount
from public.opportunities
group by stage;

-- ---------- Lead conversion (runs as caller, so RLS applies) ----------
create or replace function public.convert_lead(
  p_lead_id uuid,
  p_create_opportunity boolean default true,
  p_opportunity_name text default null,
  p_existing_account_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  l public.leads%rowtype;
  v_account uuid;
  v_contact uuid;
  v_opp uuid;
begin
  select * into l from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if l.status = 'converted' then raise exception 'Lead already converted'; end if;

  if p_existing_account_id is not null then
    v_account := p_existing_account_id;
  else
    insert into public.accounts (name, industry, website, phone, annual_revenue, employees,
                                 billing_street, billing_city, billing_state, billing_postal_code, billing_country,
                                 type, owner_id)
    values (l.company, l.industry, l.website, l.phone, l.annual_revenue, l.employees,
            l.street, l.city, l.state, l.postal_code, l.country, 'prospect', (select auth.uid()))
    returning id into v_account;
  end if;

  insert into public.contacts (account_id, first_name, last_name, title, email, phone, lead_source,
                               mailing_street, mailing_city, mailing_state, mailing_postal_code, mailing_country,
                               owner_id)
  values (v_account, l.first_name, l.last_name, l.title, l.email, l.phone, l.source,
          l.street, l.city, l.state, l.postal_code, l.country, (select auth.uid()))
  returning id into v_contact;

  if p_create_opportunity then
    insert into public.opportunities (name, account_id, contact_id, lead_source, type, owner_id)
    values (coalesce(nullif(trim(p_opportunity_name), ''), l.company || ' - New Deal'),
            v_account, v_contact, l.source, 'new_business', (select auth.uid()))
    returning id into v_opp;
  end if;

  update public.leads
     set status = 'converted', converted_at = now(),
         converted_account_id = v_account, converted_contact_id = v_contact,
         converted_opportunity_id = v_opp
   where id = p_lead_id;

  -- move open activities / notes onto the new contact
  update public.tasks set contact_id = v_contact, account_id = v_account where lead_id = p_lead_id;
  update public.notes set contact_id = v_contact where lead_id = p_lead_id;

  return jsonb_build_object('account_id', v_account, 'contact_id', v_contact, 'opportunity_id', v_opp);
end $$;

-- ---------- Grants ----------
revoke all on function public.convert_lead(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.convert_lead(uuid, boolean, text, uuid) to authenticated;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_admin() to authenticated;
