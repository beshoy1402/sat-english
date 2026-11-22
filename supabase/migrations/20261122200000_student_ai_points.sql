-- Student AI point wallet. This migration is source-controlled only until explicitly approved for production.
create table if not exists public.student_ai_point_accounts (
  student_profile_id uuid primary key references public.profiles(id) on delete cascade,
  points_balance integer not null default 300 check (points_balance >= 0),
  points_granted_total bigint not null default 300 check (points_granted_total >= 0),
  points_spent_total bigint not null default 0 check (points_spent_total >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.student_ai_point_transactions (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid,
  transaction_type text not null check (transaction_type in ('consume','refund','grant','adjustment')),
  points_delta integer not null,
  feature text not null,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists student_ai_point_transactions_request_type_uidx
  on public.student_ai_point_transactions(request_id, transaction_type)
  where request_id is not null;
create index if not exists student_ai_point_transactions_student_created_idx
  on public.student_ai_point_transactions(student_profile_id, created_at desc);

alter table public.student_ai_point_accounts enable row level security;
alter table public.student_ai_point_transactions enable row level security;
drop policy if exists student_ai_points_read_self on public.student_ai_point_accounts;
create policy student_ai_points_read_self on public.student_ai_point_accounts
  for select to authenticated using (student_profile_id = (select auth.uid()) or private.current_user_role() = 'admin');
drop policy if exists student_ai_point_transactions_read_self on public.student_ai_point_transactions;
create policy student_ai_point_transactions_read_self on public.student_ai_point_transactions
  for select to authenticated using (student_profile_id = (select auth.uid()) or private.current_user_role() = 'admin');

create or replace function public.student_ai_points_consume(
  p_student_profile_id uuid, p_points integer, p_feature text, p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_balance integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorized';
  end if;
  if p_points < 1 or p_points > 100 or p_feature not in ('tutor','study_plan') then
    raise exception 'Invalid point charge';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_student_profile_id and p.role='student' and p.is_active) then
    raise exception 'Active student account required';
  end if;
  insert into public.student_ai_point_accounts(student_profile_id) values (p_student_profile_id)
    on conflict (student_profile_id) do nothing;
  update public.student_ai_point_accounts
    set points_balance=points_balance-p_points,
        points_spent_total=points_spent_total+p_points,
        updated_at=now()
    where student_profile_id=p_student_profile_id and points_balance>=p_points
    returning points_balance into v_balance;
  if v_balance is null then
    select points_balance into v_balance from public.student_ai_point_accounts where student_profile_id=p_student_profile_id;
    return jsonb_build_object('success',false,'remaining',coalesce(v_balance,0));
  end if;
  insert into public.student_ai_point_transactions(student_profile_id,request_id,transaction_type,points_delta,feature)
    values(p_student_profile_id,p_request_id,'consume',-p_points,p_feature);
  return jsonb_build_object('success',true,'remaining',v_balance,'charged',p_points);
end;
$$;

create or replace function public.student_ai_points_refund(
  p_student_profile_id uuid, p_points integer, p_feature text, p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_balance integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  if p_points < 1 or p_points > 100 then raise exception 'Invalid refund'; end if;
  if exists(select 1 from public.student_ai_point_transactions t where t.request_id=p_request_id and t.transaction_type='refund') then
    select points_balance into v_balance from public.student_ai_point_accounts where student_profile_id=p_student_profile_id;
    return jsonb_build_object('success',true,'remaining',v_balance,'already_refunded',true);
  end if;
  update public.student_ai_point_accounts
    set points_balance=points_balance+p_points,
        points_spent_total=greatest(0,points_spent_total-p_points),
        updated_at=now()
    where student_profile_id=p_student_profile_id
      and exists(select 1 from public.student_ai_point_transactions t where t.request_id=p_request_id and t.transaction_type='consume');
  if not found then raise exception 'Matching AI point charge not found'; end if;
  insert into public.student_ai_point_transactions(student_profile_id,request_id,transaction_type,points_delta,feature,note)
    values(p_student_profile_id,p_request_id,'refund',p_points,p_feature,'AI provider request failed; points returned');
  select points_balance into v_balance from public.student_ai_point_accounts where student_profile_id=p_student_profile_id;
  return jsonb_build_object('success',true,'remaining',v_balance);
end;
$$;

create or replace function public.staff_adjust_student_ai_points(
  p_student_profile_id uuid, p_delta integer, p_note text default 'Staff adjustment'
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_balance integer;
begin
  if private.current_user_role() <> 'admin' then raise exception 'Admin access required'; end if;
  if p_delta = 0 or abs(p_delta) > 100000 then raise exception 'Invalid point adjustment'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_student_profile_id and p.role='student' and p.is_active) then
    raise exception 'Active student account required';
  end if;
  insert into public.student_ai_point_accounts(student_profile_id) values(p_student_profile_id)
    on conflict (student_profile_id) do nothing;
  update public.student_ai_point_accounts
    set points_balance=points_balance+p_delta,
        points_granted_total=greatest(0,points_granted_total+greatest(p_delta,0)),
        updated_at=now()
    where student_profile_id=p_student_profile_id and points_balance+p_delta>=0
    returning points_balance into v_balance;
  if v_balance is null then raise exception 'Insufficient balance or invalid student'; end if;
  insert into public.student_ai_point_transactions(student_profile_id,transaction_type,points_delta,feature,note)
    values(p_student_profile_id,case when p_delta>0 then 'grant' else 'adjustment' end,p_delta,'admin_adjustment',left(coalesce(p_note,''),300));
  return jsonb_build_object('success',true,'remaining',v_balance);
end;
$$;

grant execute on function public.student_ai_points_consume(uuid,integer,text,uuid) to service_role;
grant execute on function public.student_ai_points_refund(uuid,integer,text,uuid) to service_role;
revoke all on function public.staff_adjust_student_ai_points(uuid,integer,text) from public, anon;
grant execute on function public.staff_adjust_student_ai_points(uuid,integer,text) to authenticated;
