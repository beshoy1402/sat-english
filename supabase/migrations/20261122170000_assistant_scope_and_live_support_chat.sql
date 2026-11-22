-- Assistant scope and live support escalation.
-- Assistants can triage open student/parent requests, join them, and invite a teacher.
-- Teachers only see a conversation after being added as a participant.
drop policy if exists conversations_read_related on public.conversations;
create policy conversations_read_related on public.conversations for select to authenticated
using (
  exists(select 1 from public.conversation_participants cp where cp.conversation_id=conversations.id and cp.profile_id=(select auth.uid()))
  or private.current_user_role()='admin'
  or (private.current_user_role()='assistant' and status in ('open','pending')
      and conversation_type in ('student_teacher','parent_teacher') and assigned_to is null)
);
drop policy if exists conversations_update_staff on public.conversations;
create policy conversations_update_staff on public.conversations for update to authenticated
using (private.current_user_role()='admin' or exists(select 1 from public.conversation_participants cp where cp.conversation_id=conversations.id and cp.profile_id=(select auth.uid())))
with check (private.current_user_role()='admin' or exists(select 1 from public.conversation_participants cp where cp.conversation_id=conversations.id and cp.profile_id=(select auth.uid())));
create or replace function private.is_current_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = (select auth.uid())
  );
$function$;

revoke all on function private.is_current_conversation_participant(uuid) from public, anon;
grant execute on function private.is_current_conversation_participant(uuid) to authenticated;

drop policy if exists conversation_participants_read_related on public.conversation_participants;
create policy conversation_participants_read_related on public.conversation_participants for select to authenticated
using (
  profile_id = (select auth.uid())
  or private.current_user_role() = 'admin'
  or (
    private.current_user_role() = 'assistant'
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.status in ('open','pending')
        and c.conversation_type in ('student_teacher','parent_teacher')
        and c.assigned_to is null
    )
  )
  or private.is_current_conversation_participant(conversation_id)
);
drop policy if exists conversation_participants_insert_related on public.conversation_participants;
create policy conversation_participants_insert_related on public.conversation_participants for insert to authenticated
with check (
  (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.created_by = (select auth.uid())
    )
  )
  or (
    private.current_user_role() = 'assistant'
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.status in ('open','pending')
        and c.conversation_type in ('student_teacher','parent_teacher')
        and c.assigned_to is null
    )
    and (
      (
        profile_id = (select auth.uid())
      )
      or (
        private.is_current_conversation_participant(conversation_id)
        and exists (
          select 1 from public.profiles target
          where target.id = profile_id
            and target.role = 'teacher'
            and target.is_active = true
        )
      )
    )
  )
  or (
    private.current_user_role() = 'admin'
    and exists (
      select 1 from public.profiles target
      where target.id = profile_id
        and target.is_active = true
        and target.role in ('student','parent','teacher','assistant')
    )
  )
  or (
    private.current_user_role() = 'teacher'
    and private.is_current_conversation_participant(conversation_id)
    and exists (
      select 1 from public.profiles target
      where target.id = profile_id
        and target.is_active = true
        and target.role in ('student','parent','teacher','assistant')
    )
  )
);
drop policy if exists messages_read_related on public.messages;
create policy messages_read_related on public.messages for select to authenticated
using (private.current_user_role()='admin' or exists(select 1 from public.conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.profile_id=(select auth.uid())));
drop policy if exists messages_insert_related on public.messages;
create policy messages_insert_related on public.messages for insert to authenticated
with check (sender_profile_id=(select auth.uid()) and exists(select 1 from public.conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.profile_id=(select auth.uid())));
drop policy if exists message_attachments_read on storage.objects;
create policy message_attachments_read on storage.objects for select to authenticated
using(bucket_id='message-attachments' and (private.current_user_role()='admin' or exists(select 1 from public.conversation_participants cp where cp.conversation_id=((storage.foldername(name))[1])::uuid and cp.profile_id=(select auth.uid()))));
