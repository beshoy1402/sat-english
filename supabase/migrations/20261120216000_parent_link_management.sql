drop policy if exists parent_links_insert_staff on public.parent_student_links;
create policy parent_links_insert_staff on public.parent_student_links for insert to authenticated
with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists parent_links_update_staff on public.parent_student_links;
create policy parent_links_update_staff on public.parent_student_links for update to authenticated
using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')))
with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')));
drop policy if exists parent_links_delete_staff on public.parent_student_links;
create policy parent_links_delete_staff on public.parent_student_links for delete to authenticated
using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant')));
