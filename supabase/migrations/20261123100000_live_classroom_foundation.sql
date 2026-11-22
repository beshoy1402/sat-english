-- Live classroom session scheduling, attendance and private Realtime presence.
-- Source-controlled only: this migration is NOT applied to any Supabase project.

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  description text not null default '',
  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','lobby','live','ended','cancelled')),
  created_by uuid not null references public.profiles(id),
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

create table if not exists public.live_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen_at timestamptz not null default now(),
  unique(session_id, profile_id)
);

create index if not exists live_session_participants_session_idx
  on public.live_session_participants(session_id, joined_at);

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
      and p.role in ('admin','teacher','assistant')
      and (
        p.role = 'admin'
        or s.created_by = p.id
        or exists (
          select 1 from public.courses c
          where c.id = s.course_id and c.created_by = p.id
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

drop policy if exists live_sessions_read_authorized on public.live_sessions;
create policy live_sessions_read_authorized
on public.live_sessions for select to authenticated
using (private.can_access_live_session(id));

drop policy if exists live_sessions_insert_course_staff on public.live_sessions;
create policy live_sessions_insert_course_staff
on public.live_sessions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    join public.courses c on c.id = live_sessions.course_id
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role in ('admin','teacher','assistant')
      and (p.role = 'admin' or c.created_by = p.id)
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
using (private.can_access_live_session(session_id));

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
      ended_at = case when p_status = 'ended' then now() else ended_at end,
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
begin
  if not private.can_join_live_session(p_session_id) then
    raise exception 'This live classroom is not open to your account';
  end if;

  insert into public.live_session_participants(session_id, profile_id, joined_at, last_seen_at)
  values (p_session_id, auth.uid(), now(), now())
  on conflict (session_id, profile_id)
  do update set left_at = null, last_seen_at = now()
  returning * into v_participant;

  return v_participant;
end;
$function$;

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
    when realtime.topic() ~ '^live-session:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then private.can_join_live_session(split_part(realtime.topic(), ':', 2)::uuid)
    else false
  end
);

drop policy if exists live_session_realtime_send on realtime.messages;
create policy live_session_realtime_send
on realtime.messages for insert to authenticated
with check (
  case
    when realtime.topic() ~ '^live-session:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then private.can_access_live_session(split_part(realtime.topic(), ':', 2)::uuid)
    else false
  end
);

comment on table public.live_sessions is
  'Scheduled SAT English live lessons. Private Realtime access is scoped to active course staff and enrolled students.';
comment on table public.live_session_participants is
  'Per-session attendance with reconnect-safe one-row-per-profile tracking.';
