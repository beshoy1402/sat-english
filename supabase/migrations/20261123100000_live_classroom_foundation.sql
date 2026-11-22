-- Live classroom session scheduling, attendance and private Realtime presence.
-- Source-controlled only: this migration is NOT applied to any Supabase project.

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  room_type text not null default 'lesson' check (room_type in ('lesson','study')),
  provider text not null default 'website' check (provider in ('website','zoom')),
  zoom_meeting_id text,
  zoom_join_url text,
  zoom_password text,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  description text not null default '',
  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','lobby','live','ended','cancelled')),
  created_by uuid not null references public.profiles(id),
  started_by uuid references public.profiles(id),
  ended_by uuid references public.profiles(id),
  cancelled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is not null),
  check (status <> 'live' or started_at is not null),
  check (status <> 'ended' or ended_at is not null)
);

create index if not exists live_sessions_course_schedule_idx
  on public.live_sessions(course_id, scheduled_at desc);
create index if not exists live_sessions_status_schedule_idx
  on public.live_sessions(status, scheduled_at);

create unique index if not exists live_sessions_zoom_meeting_id_unique_idx
  on public.live_sessions(zoom_meeting_id)
  where zoom_meeting_id is not null;

create unique index if not exists live_sessions_one_active_study_room_per_host_idx
  on public.live_sessions(created_by)
  where room_type = 'study' and status in ('lobby','live');

create table if not exists public.live_session_zoom_host_links (
  session_id uuid primary key references public.live_sessions(id) on delete cascade,
  host_profile_id uuid not null references public.profiles(id) on delete cascade,
  start_url text not null,
  updated_at timestamptz not null default now()
);
alter table public.live_session_zoom_host_links enable row level security;
revoke all on public.live_session_zoom_host_links from anon, authenticated;

create table if not exists public.live_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen_at timestamptz not null default now(),
  chat_muted_until timestamptz,
  removed_at timestamptz,
  removed_by uuid references public.profiles(id),
  unique(session_id, profile_id)
);

create index if not exists live_session_participants_session_idx
  on public.live_session_participants(session_id, joined_at);

create table if not exists public.live_session_zoom_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  event_id text not null unique,
  event_type text not null check (event_type in ('meeting.started','meeting.ended','meeting.participant_joined','meeting.participant_left')),
  meeting_id text not null,
  meeting_uuid text,
  participant_user_id text,
  participant_uuid text,
  participant_name text,
  participant_email text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists live_session_zoom_events_session_time_idx
  on public.live_session_zoom_events(session_id, occurred_at desc);
alter table public.live_session_zoom_events enable row level security;
revoke all on public.live_session_zoom_events from anon, authenticated;
grant all on public.live_session_zoom_events to service_role;

create table if not exists public.live_session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id),
  sender_display_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists live_session_messages_history_idx
  on public.live_session_messages(session_id, created_at desc);

create index if not exists live_session_messages_sender_rate_idx
  on public.live_session_messages(session_id, sender_profile_id, created_at desc);

create table if not exists public.live_session_moderation_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id),
  target_profile_id uuid not null references public.profiles(id),
  action text not null check (action in ('chat_muted','chat_unmuted','participant_removed')),
  created_at timestamptz not null default now()
);

create index if not exists live_session_moderation_history_idx
  on public.live_session_moderation_events(session_id, created_at desc);

alter table public.live_session_messages enable row level security;
alter table public.live_session_moderation_events enable row level security;

revoke all on public.live_session_messages from anon, authenticated;
grant select on public.live_session_messages to authenticated;
revoke all on public.live_session_moderation_events from anon, authenticated;
grant select on public.live_session_moderation_events to authenticated;


alter table public.live_sessions enable row level security;
alter table public.live_session_participants enable row level security;

grant select, insert on public.live_sessions to authenticated;
revoke update on public.live_sessions from authenticated;
grant select on public.live_session_participants to authenticated;
revoke insert, update on public.live_session_participants from authenticated;

create or replace function private.can_access_live_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.live_sessions s
    join public.profiles p
      on p.id = (select auth.uid())
     and p.is_active = true
    where s.id = p_session_id
      and (
        (
          p.role in ('admin','teacher','assistant')
          and (
            p.role = 'admin'
            or s.created_by = p.id
            or exists (
              select 1 from public.courses c
              where c.id = s.course_id and c.created_by = p.id
            )
          )
        )
        or (
          p.role = 'student'
          and exists (
            select 1
            from public.course_access ca
            join public.courses c on c.id = ca.course_id
            where ca.course_id = s.course_id
              and ca.student_profile_id = p.id
              and ca.status = 'active'
              and c.status = 'published'
              and (ca.starts_at is null or ca.starts_at <= now())
              and (ca.expires_at is null or ca.expires_at > now())
          )
        )
      )
  );
$function$;

create or replace function private.can_join_live_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.can_access_live_session(p_session_id)
    and exists (
      select 1 from public.live_sessions s
      where s.id = p_session_id
        and s.status in ('lobby','live')
    )
    and not exists (
      select 1 from public.live_session_participants lp
      where lp.session_id = p_session_id
        and lp.profile_id = (select auth.uid())
        and lp.removed_at is not null
    );
$function$;

create or replace function private.can_manage_live_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.live_sessions s
    join public.profiles p
      on p.id = (select auth.uid())
     and p.is_active = true
    where s.id = p_session_id
      and (
        (
          p.role in ('admin','teacher','assistant')
          and (
            p.role = 'admin'
            or s.created_by = p.id
            or exists (
              select 1 from public.courses c
              where c.id = s.course_id and c.created_by = p.id
            )
          )
        )
        or (
          p.role = 'student'
          and s.room_type = 'study'
          and s.created_by = p.id
        )
      )
  );
$function$;

revoke all on function private.can_access_live_session(uuid) from public, anon;
revoke all on function private.can_manage_live_session(uuid) from public, anon;
revoke all on function private.can_join_live_session(uuid) from public, anon;
grant execute on function private.can_access_live_session(uuid) to authenticated;
grant execute on function private.can_manage_live_session(uuid) to authenticated;
grant execute on function private.can_join_live_session(uuid) to authenticated;

drop policy if exists live_session_messages_read_participants on public.live_session_messages;
create policy live_session_messages_read_participants
on public.live_session_messages for select to authenticated
using (
  private.can_manage_live_session(session_id)
  or (
    private.can_join_live_session(session_id)
    and exists (
      select 1 from public.live_session_participants lp
      where lp.session_id = live_session_messages.session_id
        and lp.profile_id = (select auth.uid())
        and lp.left_at is null
        and lp.removed_at is null
    )
  )
);

drop policy if exists live_session_moderation_read_managers on public.live_session_moderation_events;
create policy live_session_moderation_read_managers
on public.live_session_moderation_events for select to authenticated
using (private.can_manage_live_session(session_id));


drop policy if exists live_sessions_read_authorized on public.live_sessions;
create policy live_sessions_read_authorized
on public.live_sessions for select to authenticated
using (private.can_access_live_session(id));

drop policy if exists live_sessions_insert_course_staff on public.live_sessions;
create policy live_sessions_insert_course_staff
on public.live_sessions for insert to authenticated
with check (
  room_type = 'lesson'
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    join public.courses c on c.id = live_sessions.course_id
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin','teacher','assistant')
      and (p.role = 'admin' or c.created_by = p.id)
  )
  and (
    lesson_id is null
    or exists (
      select 1 from public.lessons l
      where l.id = live_sessions.lesson_id
        and l.course_id = live_sessions.course_id
        and l.is_published = true
    )
  )
);

drop policy if exists live_sessions_insert_student_study_room on public.live_sessions;
create policy live_sessions_insert_student_study_room
on public.live_sessions for insert to authenticated
with check (
  room_type = 'study'
  and provider = 'website'
  and lesson_id is null
  and status = 'lobby'
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.course_access ca on ca.student_profile_id = p.id
    join public.courses c on c.id = ca.course_id
    where p.id = (select auth.uid())
      and p.role = 'student'
      and p.is_active = true
      and ca.course_id = live_sessions.course_id
      and ca.status = 'active'
      and c.status = 'published'
      and (ca.starts_at is null or ca.starts_at <= now())
      and (ca.expires_at is null or ca.expires_at > now())
  )
);



drop policy if exists live_sessions_update_manager on public.live_sessions;
create policy live_sessions_update_manager
on public.live_sessions for update to authenticated
using (private.can_manage_live_session(id))
with check (private.can_manage_live_session(id));

drop policy if exists live_participants_read_authorized on public.live_session_participants;
create policy live_participants_read_authorized
on public.live_session_participants for select to authenticated
using (
  profile_id = (select auth.uid())
  or private.can_manage_live_session(session_id)
);

drop policy if exists live_participants_join_self on public.live_session_participants;
create policy live_participants_join_self
on public.live_session_participants for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and private.can_join_live_session(session_id)
  and exists (
    select 1 from public.live_sessions s
    where s.id = live_session_participants.session_id
      and s.status in ('lobby','live')
  )
);

drop policy if exists live_participants_update_self_or_manager on public.live_session_participants;
create policy live_participants_update_self_or_manager
on public.live_session_participants for update to authenticated
using (
  profile_id = (select auth.uid())
  or private.can_manage_live_session(session_id)
)
with check (
  profile_id = (select auth.uid())
  or private.can_manage_live_session(session_id)
);

-- Mutating attendance and session lifecycle timestamps must be server-authored.
create or replace function public.live_session_set_status(
  p_session_id uuid,
  p_status text
)
returns public.live_sessions
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.live_sessions;
begin
  if not private.can_manage_live_session(p_session_id) then
    raise exception 'You are not authorized to manage this live lesson';
  end if;

  if p_status not in ('lobby','live','ended','cancelled') then
    raise exception 'Invalid live lesson status';
  end if;

  select * into v_session
  from public.live_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Live lesson not found';
  end if;

  if v_session.status = p_status then
    return v_session;
  end if;

  if not (
    (v_session.status = 'scheduled' and p_status in ('lobby','live','cancelled'))
    or (v_session.status = 'lobby' and p_status in ('live','cancelled'))
    or (v_session.status = 'live' and p_status = 'ended')
  ) then
    raise exception 'Invalid live lesson status transition: % to %', v_session.status, p_status;
  end if;

  update public.live_sessions
  set status = p_status,
      started_at = case when p_status = 'live' then coalesce(started_at, now()) else started_at end,
      started_by = case when p_status = 'live' then coalesce(started_by, auth.uid()) else started_by end,
      ended_at = case when p_status = 'ended' then now() else ended_at end,
      ended_by = case when p_status = 'ended' then auth.uid() else ended_by end,
      cancelled_by = case when p_status = 'cancelled' then auth.uid() else cancelled_by end,
      updated_at = now()
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$function$;

create or replace function public.live_session_join(p_session_id uuid)
returns public.live_session_participants
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_participant public.live_session_participants;
  v_session public.live_sessions;
  v_active_count integer;
begin
  if not private.can_join_live_session(p_session_id) then
    raise exception 'This live classroom is not open to your account';
  end if;

  select * into v_session
  from public.live_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Live classroom not found';
  end if;

  -- A crashed website tab must not occupy a WebRTC room seat forever.
  -- Zoom attendance is driven by explicit participant-left webhook events instead.
  if v_session.provider = 'website' then
    update public.live_session_participants
    set left_at = now(), last_seen_at = now()
    where session_id = p_session_id
      and left_at is null
      and removed_at is null
      and last_seen_at < now() - interval '2 minutes';
  end if;

  select count(*) into v_active_count
  from public.live_session_participants
  where session_id = p_session_id
    and left_at is null
    and removed_at is null
    and profile_id <> auth.uid();

  if v_active_count >= 6 then
    raise exception 'This small live room has reached its 6-participant limit';
  end if;

  insert into public.live_session_participants(session_id, profile_id, joined_at, last_seen_at)
  values (p_session_id, auth.uid(), now(), now())
  on conflict (session_id, profile_id)
  do update set left_at = null, last_seen_at = now()
  where live_session_participants.removed_at is null
  returning * into v_participant;

  if not found then
    raise exception 'You were removed from this live classroom';
  end if;

  return v_participant;
end;
$function$;

-- Zoom webhooks are signature-verified by the dedicated Edge Function.
-- This trigger maps verified participant email addresses to active enrolled students.
create or replace function private.sync_zoom_attendance_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile_id uuid;
  v_course_id uuid;
begin
  if new.event_type not in ('meeting.participant_joined','meeting.participant_left')
    or nullif(btrim(coalesce(new.participant_email, '')), '') is null then
    return new;
  end if;

  select course_id into v_course_id
  from public.live_sessions
  where id = new.session_id;

  select au.id into v_profile_id
  from auth.users au
  join public.profiles p on p.id = au.id
  join public.course_access ca on ca.student_profile_id = p.id
  join public.courses c on c.id = ca.course_id
  where lower(au.email) = lower(new.participant_email)
    and p.role = 'student'
    and p.is_active = true
    and ca.course_id = v_course_id
    and ca.status = 'active'
    and c.status = 'published'
    and (ca.starts_at is null or ca.starts_at <= new.occurred_at)
    and (ca.expires_at is null or ca.expires_at > new.occurred_at)
  limit 1;

  if v_profile_id is null then
    return new;
  end if;

  if new.event_type = 'meeting.participant_joined' then
    insert into public.live_session_participants(session_id, profile_id, joined_at, last_seen_at)
    values (new.session_id, v_profile_id, new.occurred_at, now())
    on conflict (session_id, profile_id)
    do update set
      joined_at = least(public.live_session_participants.joined_at, excluded.joined_at),
      left_at = case
        when public.live_session_participants.left_at is not null
          and excluded.joined_at > public.live_session_participants.left_at then null
        else public.live_session_participants.left_at
      end,
      last_seen_at = now()
    where public.live_session_participants.removed_at is null;
  else
    update public.live_session_participants
    set left_at = greatest(coalesce(left_at, new.occurred_at), new.occurred_at),
        last_seen_at = now()
    where session_id = new.session_id
      and profile_id = v_profile_id
      and joined_at <= new.occurred_at
      and removed_at is null;
  end if;

  return new;
end;
$function$;

create trigger live_session_zoom_attendance_sync
  after insert on public.live_session_zoom_events
  for each row execute function private.sync_zoom_attendance_event();

revoke all on function private.sync_zoom_attendance_event() from public, anon, authenticated;

create or replace function public.live_session_store_zoom_meeting(
  p_session_id uuid,
  p_meeting_id text,
  p_join_url text,
  p_password text,
  p_start_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.can_manage_live_session(p_session_id) then
    raise exception 'You are not authorized to configure this Zoom lesson';
  end if;

  if not exists (
    select 1 from public.live_sessions s
    where s.id = p_session_id
      and s.created_by = (select auth.uid())
      and s.room_type = 'lesson'
      and s.provider = 'zoom'
  ) then
    raise exception 'Only the teacher who created this Zoom lesson can configure it';
  end if;

  if coalesce(p_meeting_id, '') = ''
    or coalesce(p_join_url, '') = ''
    or coalesce(p_start_url, '') = ''
    or p_join_url !~ '^https://([a-zA-Z0-9-]+\.)*zoom\.us/'
    or p_start_url !~ '^https://([a-zA-Z0-9-]+\.)*zoom\.us/' then
    raise exception 'Invalid Zoom meeting response';
  end if;

  update public.live_sessions
  set zoom_meeting_id = p_meeting_id,
      zoom_join_url = p_join_url,
      zoom_password = nullif(p_password, ''),
      updated_at = now()
  where id = p_session_id;

  insert into public.live_session_zoom_host_links(session_id, host_profile_id, start_url, updated_at)
  values (p_session_id, auth.uid(), p_start_url, now())
  on conflict (session_id)
  do update set host_profile_id = excluded.host_profile_id,
                start_url = excluded.start_url,
                updated_at = now();

  return true;
end;
$function$;

revoke all on function public.live_session_store_zoom_meeting(uuid,text,text,text,text) from public, anon;
grant execute on function public.live_session_store_zoom_meeting(uuid,text,text,text,text) to authenticated;

create or replace function public.live_session_heartbeat(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_last_seen timestamptz;
begin
  if auth.uid() is null or not private.can_join_live_session(p_session_id) then
    raise exception 'You are not authorized to refresh attendance for this live classroom';
  end if;

  update public.live_session_participants
  set last_seen_at = now()
  where session_id = p_session_id
    and profile_id = (select auth.uid())
    and left_at is null
    and removed_at is null
  returning last_seen_at into v_last_seen;

  if not found then
    raise exception 'Join the classroom before refreshing attendance';
  end if;

  return v_last_seen;
end;
$function$;

revoke all on function public.live_session_heartbeat(uuid) from public, anon;
grant execute on function public.live_session_heartbeat(uuid) to authenticated;

create or replace function public.live_session_leave(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.can_access_live_session(p_session_id) then
    raise exception 'You are not authorized to leave this live lesson';
  end if;

  update public.live_session_participants
  set left_at = now(), last_seen_at = now()
  where session_id = p_session_id
    and profile_id = auth.uid()
    and left_at is null;

  return found;
end;
$function$;


-- Chat writes are server-validated, rate-limited and blocked for muted/removed participants.
create or replace function public.live_session_send_message(
  p_session_id uuid,
  p_body text
)
returns public.live_session_messages
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_participant public.live_session_participants;
  v_message public.live_session_messages;
  v_body text;
  v_display_name text;
  v_recent_count integer;
begin
  if auth.uid() is null or not private.can_join_live_session(p_session_id) then
    raise exception 'You are not authorized to chat in this classroom';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'Message must contain between 1 and 1000 characters';
  end if;

  select * into v_participant
  from public.live_session_participants
  where session_id = p_session_id and profile_id = auth.uid()
  for update;

  if not found or v_participant.left_at is not null or v_participant.removed_at is not null then
    raise exception 'Join the classroom before sending a message';
  end if;

  if v_participant.chat_muted_until is not null and v_participant.chat_muted_until > now() then
    raise exception 'Your classroom chat is temporarily muted';
  end if;

  if exists (
    select 1 from public.live_session_messages
    where session_id = p_session_id
      and sender_profile_id = auth.uid()
      and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Please wait before sending another message';
  end if;

  select count(*) into v_recent_count
  from public.live_session_messages
  where session_id = p_session_id
    and sender_profile_id = auth.uid()
    and created_at > now() - interval '1 minute';

  if v_recent_count >= 30 then
    raise exception 'You have reached the classroom chat rate limit';
  end if;

  select display_name into v_display_name
  from public.profiles
  where id = auth.uid() and is_active = true;

  if not found then
    raise exception 'Your account is not active';
  end if;

  insert into public.live_session_messages(session_id, sender_profile_id, sender_display_name, body)
  values (p_session_id, auth.uid(), coalesce(nullif(btrim(v_display_name), ''), 'Participant'), v_body)
  returning * into v_message;

  return v_message;
end;
$function$;

create or replace function public.live_session_set_chat_mute(
  p_session_id uuid,
  p_profile_id uuid,
  p_muted boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_target_role public.app_role;
  v_muted_until timestamptz;
begin
  if auth.uid() is null or not private.can_manage_live_session(p_session_id) then
    raise exception 'You are not authorized to moderate this classroom';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_profile_id and is_active = true;

  if not found or v_target_role <> 'student' then
    raise exception 'Only an active student can be chat-muted';
  end if;

  update public.live_session_participants
  set chat_muted_until = case when p_muted then now() + interval '10 minutes' else null end
  where session_id = p_session_id
    and profile_id = p_profile_id
    and left_at is null
    and removed_at is null
  returning chat_muted_until into v_muted_until;

  if not found then
    raise exception 'The student is not an active participant in this classroom';
  end if;

  insert into public.live_session_moderation_events(session_id, actor_profile_id, target_profile_id, action)
  values (p_session_id, auth.uid(), p_profile_id, case when p_muted then 'chat_muted' else 'chat_unmuted' end);

  return v_muted_until;
end;
$function$;


create or replace function public.live_session_remove_participant(
  p_session_id uuid,
  p_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_target_role public.app_role;
begin
  if auth.uid() is null or not private.can_manage_live_session(p_session_id) then
    raise exception 'You are not authorized to moderate this classroom';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_profile_id and is_active = true;

  if not found or v_target_role <> 'student' then
    raise exception 'Only an active student can be removed from the classroom';
  end if;

  update public.live_session_participants
  set removed_at = now(),
      removed_by = auth.uid(),
      left_at = coalesce(left_at, now()),
      last_seen_at = now()
  where session_id = p_session_id
    and profile_id = p_profile_id
    and left_at is null
    and removed_at is null;

  if not found then
    raise exception 'The student is not an active participant in this classroom';
  end if;

  insert into public.live_session_moderation_events(session_id, actor_profile_id, target_profile_id, action)
  values (p_session_id, auth.uid(), p_profile_id, 'participant_removed');

  return true;
end;
$function$;

revoke all on function public.live_session_send_message(uuid,text) from public, anon;
revoke all on function public.live_session_set_chat_mute(uuid,uuid,boolean) from public, anon;
revoke all on function public.live_session_remove_participant(uuid,uuid) from public, anon;
grant execute on function public.live_session_send_message(uuid,text) to authenticated;
grant execute on function public.live_session_set_chat_mute(uuid,uuid,boolean) to authenticated;
grant execute on function public.live_session_remove_participant(uuid,uuid) to authenticated;

revoke all on function public.live_session_set_status(uuid,text) from public, anon;
revoke all on function public.live_session_join(uuid) from public, anon;
revoke all on function public.live_session_leave(uuid) from public, anon;
grant execute on function public.live_session_set_status(uuid,text) to authenticated;
grant execute on function public.live_session_join(uuid) to authenticated;
grant execute on function public.live_session_leave(uuid) to authenticated;

-- Private Realtime topics use the exact format: live-session:<session UUID>.
-- SELECT permits receiving presence/broadcast events; INSERT permits sending them.
drop policy if exists live_session_realtime_receive on realtime.messages;
create policy live_session_realtime_receive
on realtime.messages for select to authenticated
using (
  case
    when realtime.topic() ~ '^live-session(-media)?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then private.can_join_live_session(split_part(realtime.topic(), ':', 2)::uuid)
    else false
  end
);

drop policy if exists live_session_realtime_send on realtime.messages;
create policy live_session_realtime_send
on realtime.messages for insert to authenticated
with check (
  case
    when realtime.topic() ~ '^live-session(-media)?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then private.can_join_live_session(split_part(realtime.topic(), ':', 2)::uuid)
    else false
  end
);

comment on table public.live_sessions is
  'Scheduled SAT English live lessons. Private Realtime access is scoped to active course staff and enrolled students.';
comment on table public.live_session_participants is
  'Per-session attendance with reconnect-safe one-row-per-profile tracking.';
