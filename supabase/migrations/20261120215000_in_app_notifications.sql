create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(length(trim(title)) between 2 and 180),
  body text not null default '',
  notification_type text not null default 'general' check(notification_type in ('general','homework','exam','grade','attendance','course','account','system')),
  action_url text,
  channel text not null default 'in_app' check(channel in ('in_app')),
  delivery_status text not null default 'delivered' check(delivery_status in ('queued','delivered','failed')),
  read_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_profile_id,created_at desc);
create index if not exists notifications_delivery_status_idx on public.notifications(delivery_status,created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select,update on public.notifications to authenticated;
grant insert on public.notifications to authenticated;
drop policy if exists notifications_read_related on public.notifications;
create policy notifications_read_related on public.notifications for select to authenticated
using (
  recipient_profile_id=auth.uid()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
);
drop policy if exists notifications_insert_staff on public.notifications;
create policy notifications_insert_staff on public.notifications for insert to authenticated
with check (
  created_by=auth.uid()
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('admin','teacher','assistant'))
);
drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications for update to authenticated
using(recipient_profile_id=auth.uid())
with check(recipient_profile_id=auth.uid());
