-- Teacher-created homework attachments are stored in the existing private homework bucket.
-- This migration is committed to the preview branch only; it is not applied to production.
alter table public.assignments
  add column if not exists attachment_paths text[] not null default '{}'::text[];

drop policy if exists homework_assignment_attachment_upload on storage.objects;
create policy homework_assignment_attachment_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'homework-submissions'
  and (storage.foldername(name))[1] = 'assignments'
  and exists (
    select 1
    from public.assignments a
    join public.profiles p on p.id = a.created_by
    where a.id = (storage.foldername(name))[2]::uuid
      and a.created_by = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
);

drop policy if exists homework_assignment_attachment_read on storage.objects;
create policy homework_assignment_attachment_read
on storage.objects for select to authenticated
using (
  bucket_id = 'homework-submissions'
  and (storage.foldername(name))[1] = 'assignments'
  and (
    exists (
      select 1
      from public.assignments a
      join public.profiles p on p.id = (select auth.uid())
      where a.id = (storage.foldername(name))[2]::uuid
        and p.is_active = true
        and p.role in ('admin', 'teacher', 'assistant')
    )
    or exists (
      select 1
      from public.assignment_targets t
      join public.profiles p on p.id = (select auth.uid())
      where t.assignment_id = (storage.foldername(name))[2]::uuid
        and t.student_profile_id = (select auth.uid())
        and p.is_active = true
        and p.role = 'student'
    )
    or exists (
      select 1
      from public.assignment_targets t
      join public.parent_student_links l on l.student_profile_id = t.student_profile_id
      join public.profiles p on p.id = (select auth.uid())
      where t.assignment_id = (storage.foldername(name))[2]::uuid
        and l.parent_profile_id = (select auth.uid())
        and p.is_active = true
        and p.role = 'parent'
    )
  )
);

drop policy if exists homework_assignment_attachment_delete on storage.objects;
create policy homework_assignment_attachment_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'homework-submissions'
  and (storage.foldername(name))[1] = 'assignments'
  and exists (
    select 1
    from public.assignments a
    join public.profiles p on p.id = (select auth.uid())
    where a.id = (storage.foldername(name))[2]::uuid
      and a.created_by = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher', 'assistant')
  )
);
