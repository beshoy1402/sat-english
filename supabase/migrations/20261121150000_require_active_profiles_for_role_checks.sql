-- Inactive accounts must not retain privileges through SECURITY DEFINER helpers.
-- This helper is used by staff-only RPCs and role-aware RLS policies.
create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $function$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
$function$;

comment on function private.current_user_role() is
  'Returns the authenticated profile role only while the profile is active.';


-- Course write policies must reject inactive staff profiles as well.
drop policy if exists courses_insert_staff on public.courses;
create policy courses_insert_staff
on public.courses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
);

drop policy if exists courses_update_staff on public.courses;
create policy courses_update_staff
on public.courses
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
);

drop policy if exists courses_delete_staff on public.courses;
create policy courses_delete_staff
on public.courses
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
);
