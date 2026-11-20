-- Run this only after manually creating the first confirmed user in
-- Supabase Dashboard > Authentication > Users.
-- Use this exact email for the initial account: admin@accounts.northstar.invalid
-- Then run this statement in Supabase SQL Editor.

update public.profiles
set username = 'admin',
    display_name = 'Platform Administrator',
    role = 'admin',
    is_active = true
where id = (
  select id
  from auth.users
  where email = 'admin@accounts.northstar.invalid'
);

-- Confirm exactly one row was updated. Do not run this for ordinary accounts.
select username, display_name, role, is_active
from public.profiles
where username = 'admin';
