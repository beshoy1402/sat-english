create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_subject text; v_sender_role public.app_role;
begin
  update public.conversations set updated_at=now() where id=new.conversation_id returning subject into v_subject;
  select role into v_sender_role from public.profiles where id=new.sender_profile_id;
  if v_sender_role in ('student','parent') then
    insert into public.notifications(recipient_profile_id,title,body,notification_type,created_by,channel,delivery_status)
    select distinct p.id,'New message: '||coalesce(v_subject,'Conversation'),left(new.body,240),'general',new.sender_profile_id,'in_app','delivered'
    from public.profiles p
    where p.is_active and p.role in ('admin','teacher','assistant') and p.id<>new.sender_profile_id;
  else
    insert into public.notifications(recipient_profile_id,title,body,notification_type,created_by,channel,delivery_status)
    select cp.profile_id,'New message: '||coalesce(v_subject,'Conversation'),left(new.body,240),'general',new.sender_profile_id,'in_app','delivered'
    from public.conversation_participants cp
    where cp.conversation_id=new.conversation_id and cp.profile_id<>new.sender_profile_id;
  end if;
  return new;
end;
$$;
revoke all on function public.touch_conversation_on_message() from public,anon,authenticated;