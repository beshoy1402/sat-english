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
