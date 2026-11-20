drop policy if exists parent_links_read_related on public.parent_student_links;
create policy parent_links_read_related on public.parent_student_links for select to authenticated
using (
  parent_profile_id=auth.uid()
  or student_profile_id=auth.uid()
  or private.current_user_role() in ('admin','teacher','assistant','developer')
);