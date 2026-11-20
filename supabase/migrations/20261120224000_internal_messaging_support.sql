create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  subject text not null check(length(trim(subject)) between 2 and 180),
  conversation_type text not null default 'support' check(conversation_type in ('support','student_teacher','parent_teacher')),
  status text not null default 'open' check(status in ('open','pending','closed')),
  created_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_updated_idx on public.conversations(updated_at desc);
create index if not exists conversations_assigned_idx on public.conversations(assigned_to,status);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique(conversation_id,profile_id)
);
create index if not exists conversation_participants_profile_idx on public.conversation_participants(profile_id,conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id),
  body text not null check(length(trim(body)) between 1 and 10000),
  attachment_path text,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
grant select,insert,update on public.conversations to authenticated;
grant select,insert on public.conversation_participants to authenticated;
grant select,insert on public.messages to authenticated;

drop policy if exists conversations_read_related on public.conversations;
create policy conversations_read_related on public.conversations for select to authenticated
using(
  exists(select 1 from public.conversation_participants cp where cp.conversation_id=conversations.id and cp.profile_id=auth.uid())
  or private.current_user_role() in ('admin','teacher','assistant')
);
drop policy if exists conversations_insert_active on public.conversations;
create policy conversations_insert_active on public.conversations for insert to authenticated
with check(created_by=auth.uid() and private.current_user_role() in ('admin','teacher','assistant','student','parent'));
drop policy if exists conversations_update_staff on public.conversations;
create policy conversations_update_staff on public.conversations for update to authenticated
using(private.current_user_role() in ('admin','teacher','assistant'))
with check(private.current_user_role() in ('admin','teacher','assistant'));

drop policy if exists conversation_participants_read_related on public.conversation_participants;
create policy conversation_participants_read_related on public.conversation_participants for select to authenticated
using(profile_id=auth.uid() or private.current_user_role() in ('admin','teacher','assistant'));
drop policy if exists conversation_participants_insert_related on public.conversation_participants;
create policy conversation_participants_insert_related on public.conversation_participants for insert to authenticated
with check(
  profile_id=auth.uid()
  or private.current_user_role() in ('admin','teacher','assistant')
);

drop policy if exists messages_read_related on public.messages;
create policy messages_read_related on public.messages for select to authenticated
using(
  private.current_user_role() in ('admin','teacher','assistant')
  or exists(select 1 from public.conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.profile_id=auth.uid())
);
drop policy if exists messages_insert_related on public.messages;
create policy messages_insert_related on public.messages for insert to authenticated
with check(
  sender_profile_id=auth.uid()
  and (
    private.current_user_role() in ('admin','teacher','assistant')
    or exists(select 1 from public.conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.profile_id=auth.uid())
  )
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('message-attachments','message-attachments',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists message_attachments_upload on storage.objects;
create policy message_attachments_upload on storage.objects for insert to authenticated
with check(bucket_id='message-attachments' and (storage.foldername(name))[2]=auth.uid()::text
  and exists(select 1 from public.conversation_participants cp where cp.conversation_id=((storage.foldername(name))[1])::uuid and cp.profile_id=auth.uid()));
drop policy if exists message_attachments_read on storage.objects;
create policy message_attachments_read on storage.objects for select to authenticated
using(bucket_id='message-attachments' and (
  private.current_user_role() in ('admin','teacher','assistant')
  or exists(select 1 from public.conversation_participants cp where cp.conversation_id=((storage.foldername(name))[1])::uuid and cp.profile_id=auth.uid())
));
