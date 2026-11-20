drop policy if exists conversation_participants_insert_related on public.conversation_participants;
create policy conversation_participants_insert_related on public.conversation_participants for insert to authenticated
with check(
  (
    profile_id=auth.uid()
    and exists(select 1 from public.conversations c where c.id=conversation_participants.conversation_id and c.created_by=auth.uid())
  )
  or private.current_user_role() in ('admin','teacher','assistant')
);