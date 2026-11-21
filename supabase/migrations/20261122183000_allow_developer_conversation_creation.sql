-- Allow developers to create conversations while preserving creator ownership.
drop policy if exists conversations_insert_active on public.conversations;
create policy conversations_insert_active
on public.conversations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.current_user_role() = any (
    array[
      'admin'::public.app_role,
      'teacher'::public.app_role,
      'assistant'::public.app_role,
      'developer'::public.app_role,
      'student'::public.app_role,
      'parent'::public.app_role
    ]
  )
);
