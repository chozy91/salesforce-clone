-- Replace the FOR ALL policy (which overlapped with the SELECT policy) with per-action policies
drop policy "line items writable by opportunity owner" on public.opportunity_line_items;

create policy "line items insert by opportunity owner" on public.opportunity_line_items
  for insert to authenticated
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_id
                      and (o.owner_id = (select auth.uid()) or (select private.is_admin()))));

create policy "line items update by opportunity owner" on public.opportunity_line_items
  for update to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id
                 and (o.owner_id = (select auth.uid()) or (select private.is_admin()))))
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_id
                      and (o.owner_id = (select auth.uid()) or (select private.is_admin()))));

create policy "line items delete by opportunity owner" on public.opportunity_line_items
  for delete to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id
                 and (o.owner_id = (select auth.uid()) or (select private.is_admin()))));
