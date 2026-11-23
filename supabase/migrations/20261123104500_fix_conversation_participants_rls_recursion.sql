-- Break the conversation-participant RLS cycle.
-- Storage signed-URL checks query storage.objects, whose message attachment
-- policies read conversation_participants. The old participant SELECT policy
-- queried conversations directly, while conversations SELECT queried
-- conversation_participants, causing infinite RLS recursion.

create or replace function private.is_unassigned_assistant_inbox_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and c.status in ('open', 'pending')
      and c.conversation_type in ('student_teacher', 'parent_teacher')
      and c.assigned_to is null
  );
$function$;

revoke all on function private.is_unassigned_assistant_inbox_conversation(uuid) from public, anon;
grant execute on function private.is_unassigned_assistant_inbox_conversation(uuid) to authenticated;

drop policy if exists conversation_participants_read_related
  on public.conversation_participants;

create policy conversation_participants_read_related
on public.conversation_participants
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or private.current_user_role() = 'admin'::public.app_role
  or (
    private.current_user_role() = 'assistant'::public.app_role
    and private.is_unassigned_assistant_inbox_conversation(conversation_id)
  )
  or private.is_current_conversation_participant(conversation_id)
);
