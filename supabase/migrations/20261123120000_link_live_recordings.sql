-- Link teacher-created browser recordings to the live lesson that produced them.
-- Source-only migration. Do not apply to production without explicit approval.
alter table public.session_recordings
  add column if not exists live_session_id uuid
  references public.live_sessions(id) on delete set null;

create index if not exists session_recordings_live_session_idx
  on public.session_recordings(live_session_id)
  where live_session_id is not null;

comment on column public.session_recordings.live_session_id is
  'Optional live classroom session that produced this recording; recordings remain private drafts until explicitly published.';

-- A browser recording may only be attached to the creator's own website lesson.
create or replace function private.validate_live_session_recording()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role public.app_role;
begin
  if new.live_session_id is null then
    return new;
  end if;

  if auth.uid() is null or new.created_by <> (select auth.uid()) then
    raise exception 'A live lesson recording must be saved by its authenticated creator';
  end if;

  select role into v_role
  from public.profiles
  where id = (select auth.uid()) and is_active = true;

  if coalesce(v_role::text, '') not in ('admin','teacher') then
    raise exception 'Only an active teacher or administrator can attach a live lesson recording';
  end if;

  if not exists (
    select 1
    from public.live_sessions s
    where s.id = new.live_session_id
      and s.course_id = new.course_id
      and s.room_type = 'lesson'
      and s.provider = 'website'
      and s.created_by = (select auth.uid())
      and s.status in ('live','ended')
  ) then
    raise exception 'The recording must belong to your website-delivered lesson and matching course';
  end if;

  return new;
end;
$function$;

drop trigger if exists session_recordings_validate_live_session on public.session_recordings;
create trigger session_recordings_validate_live_session
before insert or update of live_session_id, course_id, created_by
on public.session_recordings
for each row execute function private.validate_live_session_recording();

revoke all on function private.validate_live_session_recording() from public, anon, authenticated;
