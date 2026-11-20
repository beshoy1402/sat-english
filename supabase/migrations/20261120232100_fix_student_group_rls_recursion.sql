drop policy if exists student_group_members_insert_staff on public.student_group_members;
create policy student_group_members_insert_staff on public.student_group_members for insert to authenticated
with check(private.current_user_role() in ('admin','teacher','assistant'));