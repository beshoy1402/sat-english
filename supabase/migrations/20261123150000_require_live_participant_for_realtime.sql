-- A session's eligibility is not the same as being an admitted participant.
-- Realtime topics and private hand-raise history require a live attendance row,
-- so an enrolled student cannot bypass the six-person join RPC by subscribing
-- directly to the channel.

create or replace function private.can_use_live_session_channel(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.can_join_live_session(p_session_id)
    and exists (
      select 1
      from public.live_session_participants lp
      where lp.session_id = p_session_id
        and lp.profile_id = (select auth.uid())
        and lp.left_at is null
        and lp.removed_at is null
    );
$function$;

revoke all on function private.can_use_live_session_channel(uuid) from public, anon;
grant execute on function private.can_use_live_session_channel(uuid) to authenticated;

drop policy if exists live_session_hand_raises_read_participants on public.live_session_hand_raises;
create policy live_session_hand_raises_read_participants
on public.live_session_hand_raises for select to authenticated
using (private.can_use_live_session_channel(session_id));

drop policy if exists live_session_hand_raise_events_read_participants on public.live_session_hand_raise_events;
create policy live_session_hand_raise_events_read_participants
on public.live_session_hand_raise_events for select to authenticated
using (private.can_use_live_session_channel(session_id));

drop policy if exists live_session_realtime_receive on realtime.messages;
create policy live_session_realtime_receive
on realtime.messages for select to authenticated
using (
  case
    when realtime.topic() ~ '^live-session(-media)?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then private.can_use_live_session_channel(split_part(realtime.topic(), ':', 2)::uuid)
    else false
  end
);

drop policy if exists live_session_realtime_send on realtime.messages;
create policy live_session_realtime_send
on realtime.messages for insert to authenticated
with check (
  case
    when realtime.topic() ~ '^live-session(-media)?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then private.can_use_live_session_channel(split_part(realtime.topic(), ':', 2)::uuid)
    else false
  end
);

comment on function private.can_use_live_session_channel(uuid) is
  'Allows private live-session Realtime and hand-raise history only to profiles with an active attendance row; join eligibility alone does not grant channel access.';
