create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.conversations set updated_at=now() where id=new.conversation_id;
  return new;
end;
$$;
revoke all on function public.touch_conversation_on_message() from public,anon,authenticated;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
for each row execute function public.touch_conversation_on_message();

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
