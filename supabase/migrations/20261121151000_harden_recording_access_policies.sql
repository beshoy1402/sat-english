-- Keep recording metadata and storage authorization in sync.
-- A disabled account must not retain student playback access.
drop policy if exists session_recordings_student_select on public.session_recordings;
create policy session_recordings_student_select
on public.session_recordings
for select
to authenticated
using (
  is_published = true
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role = 'student'
  )
  and exists (
    select 1
    from public.course_access ca
    join public.courses c on c.id = ca.course_id
    where ca.course_id = session_recordings.course_id
      and ca.student_profile_id = (select auth.uid())
      and ca.status = 'active'
      and c.status = 'published'
      and (ca.starts_at is null or ca.starts_at <= now())
      and (ca.expires_at is null or ca.expires_at > now())
  )
);

drop policy if exists session_recordings_storage_read_authorized on storage.objects;
create policy session_recordings_storage_read_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id = 'sat-session-recordings'
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
        and p.role in ('admin', 'teacher', 'assistant', 'developer')
    )
    or (
      exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.is_active = true
          and p.role = 'student'
      )
      and exists (
        select 1
        from public.session_recordings sr
        join public.course_access ca on ca.course_id = sr.course_id
        join public.courses c on c.id = sr.course_id
        where sr.storage_path = objects.name
          and sr.is_published = true
          and c.status = 'published'
          and ca.status = 'active'
          and (ca.starts_at is null or ca.starts_at <= now())
          and (ca.expires_at is null or ca.expires_at > now())
          and ca.student_profile_id = (select auth.uid())
      )
    )
  )
);

-- The UI and metadata policy allow any active admin/teacher to delete recordings.
-- Do not additionally require the deleting staff member to be the uploader.
drop policy if exists session_recordings_storage_staff_delete on storage.objects;
create policy session_recordings_storage_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'sat-session-recordings'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin', 'teacher')
  )
);
