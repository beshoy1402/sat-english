drop policy if exists assignments_read_authorized on public.assignments;
create policy assignments_read_authorized on public.assignments for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
  or (status='published' and (
    exists(select 1 from public.assignment_targets t where t.assignment_id=assignments.id and t.student_profile_id=auth.uid())
    or exists(select 1 from public.assignment_targets t join public.parent_student_links l on l.student_profile_id=t.student_profile_id
      where t.assignment_id=assignments.id and l.parent_profile_id=auth.uid())
  ))
);

drop policy if exists assignment_targets_read_related on public.assignment_targets;
create policy assignment_targets_read_related on public.assignment_targets for select to authenticated
using (
  student_profile_id=auth.uid()
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=assignment_targets.student_profile_id)
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
);

drop policy if exists submissions_read_related on public.submissions;
create policy submissions_read_related on public.submissions for select to authenticated
using (
  student_profile_id=auth.uid()
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and l.student_profile_id=submissions.student_profile_id)
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
);

drop policy if exists submissions_insert_own on public.submissions;
create policy submissions_insert_own on public.submissions for insert to authenticated
with check (
  student_profile_id=auth.uid()
  and exists(select 1 from public.assignment_targets t join public.assignments a on a.id=t.assignment_id
    where t.assignment_id=submissions.assignment_id and t.student_profile_id=auth.uid() and a.status='published'
      and (a.due_at is null or a.due_at>=now() or a.allow_late_submission))
);
drop policy if exists submissions_update_own_before_review on public.submissions;
create policy submissions_update_own_before_review on public.submissions for update to authenticated
using (
  student_profile_id=auth.uid() and reviewed_at is null
  and exists(select 1 from public.assignment_targets t join public.assignments a on a.id=t.assignment_id
    where t.assignment_id=submissions.assignment_id and t.student_profile_id=auth.uid() and a.status='published'
      and (a.due_at is null or a.due_at>=now() or a.allow_late_submission))
)
with check (
  student_profile_id=auth.uid() and reviewed_at is null
  and exists(select 1 from public.assignment_targets t join public.assignments a on a.id=t.assignment_id
    where t.assignment_id=submissions.assignment_id and t.student_profile_id=auth.uid() and a.status='published'
      and (a.due_at is null or a.due_at>=now() or a.allow_late_submission))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('homework-submissions','homework-submissions',false,26214400,
array['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','application/zip'])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists homework_submission_upload on storage.objects;
create policy homework_submission_upload on storage.objects for insert to authenticated
with check(bucket_id='homework-submissions' and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='student'));
drop policy if exists homework_submission_read on storage.objects;
create policy homework_submission_read on storage.objects for select to authenticated
using(bucket_id='homework-submissions' and (
  (storage.foldername(name))[1]=auth.uid()::text
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
  or exists(select 1 from public.parent_student_links l where l.parent_profile_id=auth.uid() and (storage.foldername(name))[1]=l.student_profile_id::text)
));
drop policy if exists homework_submission_delete on storage.objects;
create policy homework_submission_delete on storage.objects for delete to authenticated
using(bucket_id='homework-submissions' and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='student'));
