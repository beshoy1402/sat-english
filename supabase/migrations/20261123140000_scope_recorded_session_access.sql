-- Scope private recording metadata and object access to the relevant course staff.
-- Administrators retain global access; teachers/assistants see recordings they
-- created, recordings in courses they own, or recordings for lessons they host.
-- Students retain access only to published recordings for active enrolments.

create or replace function private.can_manage_session_recording(
  p_course_id uuid,
  p_created_by uuid,
  p_live_session_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and (
        p.role = 'admin'
        or (
          p.role in ('teacher', 'assistant')
          and (
            p_created_by = p.id
            or exists (
              select 1
              from public.courses c
              where c.id = p_course_id
                and c.created_by = p.id
            )
            or (
              p_live_session_id is not null
              and exists (
                select 1
                from public.live_sessions ls
                where ls.id = p_live_session_id
                  and ls.course_id = p_course_id
                  and ls.created_by = p.id
              )
            )
          )
        )
      )
  );
$function$;

revoke all on function private.can_manage_session_recording(uuid,uuid,uuid) from public, anon;
grant execute on function private.can_manage_session_recording(uuid,uuid,uuid) to authenticated;

-- Uploaders must be staff on the target course (or the host of the linked
-- website lesson); knowing another course UUID is not sufficient.
drop policy if exists session_recordings_staff_insert on public.session_recordings;
create policy session_recordings_staff_insert
on public.session_recordings
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin','teacher','assistant')
      and (
        p.role = 'admin'
        or exists (
          select 1
          from public.courses c
          where c.id = session_recordings.course_id
            and c.created_by = p.id
        )
        or (
          session_recordings.live_session_id is not null
          and exists (
            select 1
            from public.live_sessions ls
            where ls.id = session_recordings.live_session_id
              and ls.course_id = session_recordings.course_id
              and ls.created_by = p.id
              and ls.provider = 'website'
              and ls.room_type = 'lesson'
          )
        )
      )
  )
);

drop policy if exists session_recordings_staff_select on public.session_recordings;
create policy session_recordings_staff_select
on public.session_recordings
for select
to authenticated
using (
  private.can_manage_session_recording(course_id, created_by, live_session_id)
);

drop policy if exists session_recordings_staff_update on public.session_recordings;
create policy session_recordings_staff_update
on public.session_recordings
for update
to authenticated
using (
  private.can_manage_session_recording(course_id, created_by, live_session_id)
)
with check (
  private.can_manage_session_recording(course_id, created_by, live_session_id)
);

-- Course, uploader and linked lesson are identity fields. Only an administrator
-- may reassign them; normal staff can edit title/description/publish state.
create or replace function private.guard_session_recording_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(private.current_user_role()::text, '') <> 'admin'
    and (
      new.course_id is distinct from old.course_id
      or new.created_by is distinct from old.created_by
      or new.storage_path is distinct from old.storage_path
      or new.live_session_id is distinct from old.live_session_id
    )
  then
    raise exception 'Only an administrator may reassign a recording or change its storage identity';
  end if;
  return new;
end;
$function$;

drop trigger if exists session_recordings_guard_identity on public.session_recordings;
create trigger session_recordings_guard_identity
before update on public.session_recordings
for each row execute function private.guard_session_recording_identity();

revoke all on function private.guard_session_recording_identity() from public, anon, authenticated;

drop policy if exists session_recordings_staff_delete on public.session_recordings;
create policy session_recordings_staff_delete
on public.session_recordings
for delete
to authenticated
using (
  private.current_user_role() = 'admin'
  or (
    private.current_user_role() = 'teacher'
    and private.can_manage_session_recording(course_id, created_by, live_session_id)
  )
);

-- A storage object is readable by course staff only when its metadata row is
-- within that staff member's scope. Students still require a published row and
-- active course enrolment; developer accounts receive no blanket media access.
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
      from public.session_recordings sr
      where sr.storage_path = objects.name
        and private.can_manage_session_recording(sr.course_id, sr.created_by, sr.live_session_id)
    )
    or exists (
      select 1
      from public.profiles p
      join public.session_recordings sr on sr.storage_path = objects.name
      join public.course_access ca on ca.course_id = sr.course_id
      join public.courses c on c.id = sr.course_id
      where p.id = (select auth.uid())
        and p.is_active = true
        and p.role = 'student'
        and sr.is_published = true
        and c.status = 'published'
        and ca.status = 'active'
        and (ca.starts_at is null or ca.starts_at <= now())
        and (ca.expires_at is null or ca.expires_at > now())
        and ca.student_profile_id = p.id
    )
  )
);

drop policy if exists session_recordings_storage_staff_delete on storage.objects;
create policy session_recordings_storage_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'sat-session-recordings'
  and (
    private.current_user_role() = 'admin'
    or (
      private.current_user_role() = 'teacher'
      and exists (
        select 1
        from public.session_recordings sr
        where sr.storage_path = objects.name
          and private.can_manage_session_recording(sr.course_id, sr.created_by, sr.live_session_id)
      )
    )
  )
);

comment on function private.can_manage_session_recording(uuid,uuid,uuid) is
  'Limits private recording access to administrators and active staff who created the recording, own its course, or host its linked lesson.';
