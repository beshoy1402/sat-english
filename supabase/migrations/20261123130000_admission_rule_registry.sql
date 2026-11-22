-- Versioned Egyptian university admission rules.
-- Rules remain drafts until an administrator verifies the exact source and publishes them.
create table if not exists public.admission_rule_versions (
  id uuid primary key default gen_random_uuid(),
  university text not null check (length(trim(university)) between 2 and 180),
  faculty text not null check (length(trim(faculty)) between 2 and 180),
  admission_year integer not null check (admission_year between 2020 and 2100),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','verified','superseded')),
  source_url text not null default '' check (source_url = '' or source_url ~ '^https://'),
  source_title text not null default '',
  source_published_at date,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  formula jsonb not null default '{}'::jsonb check (jsonb_typeof(formula) = 'object'),
  score_scales jsonb not null default '{}'::jsonb check (jsonb_typeof(score_scales) = 'object'),
  minimum_requirements jsonb not null default '{}'::jsonb check (jsonb_typeof(minimum_requirements) = 'object'),
  rounding_rule text not null default 'none' check (rounding_rule in ('none','integer','one_decimal','two_decimals')),
  assumptions text not null default '',
  notes text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admission_verified_requires_source check (
    status <> 'verified' or (
      source_url like 'https://%'
      and length(trim(source_title)) > 0
      and verified_at is not null
      and verified_by is not null
      and formula->>'kind' = 'weighted_sum'
      and jsonb_typeof(formula->'weights') = 'object'
      and case
        when coalesce((formula #>> '{weights,gpa}') ~ '^[0-9]+([.][0-9]+)?$', false)
          and coalesce((formula #>> '{weights,sat1}') ~ '^[0-9]+([.][0-9]+)?$', false)
          and coalesce((formula #>> '{weights,sat2}') ~ '^[0-9]+([.][0-9]+)?$', false)
        then (
          (formula #>> '{weights,gpa}')::numeric
          + (formula #>> '{weights,sat1}')::numeric
          + (formula #>> '{weights,sat2}')::numeric
        ) = 100
        else false
      end
      and case
        when coalesce((score_scales->>'gpa_max') ~ '^[0-9]+([.][0-9]+)?$', false)
          and coalesce((score_scales->>'sat1_max') ~ '^[0-9]+([.][0-9]+)?$', false)
          and coalesce((score_scales->>'sat2_max') ~ '^[0-9]+([.][0-9]+)?$', false)
        then (score_scales->>'gpa_max')::numeric > 0
          and (score_scales->>'sat1_max')::numeric > 0
          and (score_scales->>'sat2_max')::numeric > 0
        else false
      end
    )
  )
);
create index if not exists admission_rule_lookup_idx
  on public.admission_rule_versions (lower(university), lower(faculty), admission_year, status);

create unique index if not exists admission_rule_version_unique_idx
  on public.admission_rule_versions (lower(university), lower(faculty), admission_year, version);

create unique index if not exists admission_rule_one_current_verified_idx
  on public.admission_rule_versions (lower(university), lower(faculty), admission_year)
  where status = 'verified';

-- Assign monotonically increasing versions and make published history immutable.
create or replace function public.guard_admission_rule_version()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_lock_key text;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Published admission rule history cannot be deleted';
    end if;
    return old;
  end if;

  v_lock_key := lower(btrim(new.university)) || '|' ||
                lower(btrim(new.faculty)) || '|' || new.admission_year::text;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Admission rules must be created as drafts';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    select coalesce(max(r.version), 0) + 1
      into new.version
      from public.admission_rule_versions r
      where lower(r.university) = lower(btrim(new.university))
        and lower(r.faculty) = lower(btrim(new.faculty))
        and r.admission_year = new.admission_year;
    return new;
  end if;

  if lower(btrim(new.university)) <> lower(btrim(old.university))
    or lower(btrim(new.faculty)) <> lower(btrim(old.faculty))
    or new.admission_year <> old.admission_year
    or new.version <> old.version
    or new.created_by <> old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Admission rule identity and version fields are immutable';
  end if;

  if old.status = 'superseded' then
    raise exception 'Superseded admission rule versions are immutable';
  elsif old.status = 'verified' then
    if new.status <> 'superseded'
      or (to_jsonb(new) - 'status' - 'updated_at')
         is distinct from
         (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception 'Published admission rules cannot be edited; create a new draft version';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.status not in ('draft', 'verified') then
    raise exception 'Draft rules may only remain drafts or be verified';
  end if;

  if new.status = 'verified' then
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
    update public.admission_rule_versions r
      set status = 'superseded', updated_at = now()
      where lower(r.university) = lower(btrim(new.university))
        and lower(r.faculty) = lower(btrim(new.faculty))
        and r.admission_year = new.admission_year
        and r.status = 'verified'
        and r.id <> new.id;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists admission_rule_version_guard on public.admission_rule_versions;
create trigger admission_rule_version_guard
before insert or update or delete on public.admission_rule_versions
for each row execute function public.guard_admission_rule_version();

revoke all on function public.guard_admission_rule_version() from public, anon, authenticated;

alter table public.admission_rule_versions enable row level security;
revoke all on public.admission_rule_versions from anon, authenticated;
grant select, insert, update, delete on public.admission_rule_versions to authenticated;

drop policy if exists admission_rules_admin_all on public.admission_rule_versions;
drop policy if exists admission_rules_admin_select on public.admission_rule_versions;
drop policy if exists admission_rules_admin_insert on public.admission_rule_versions;
drop policy if exists admission_rules_admin_update on public.admission_rule_versions;
drop policy if exists admission_rules_admin_delete on public.admission_rule_versions;

create policy admission_rules_admin_select
on public.admission_rule_versions for select to authenticated
using (coalesce(private.current_user_role()::text, '') = 'admin');

create policy admission_rules_admin_insert
on public.admission_rule_versions for insert to authenticated
with check (
  coalesce(private.current_user_role()::text, '') = 'admin'
  and created_by = (select auth.uid())
  and (status <> 'verified' or verified_by = (select auth.uid()))
);

create policy admission_rules_admin_update
on public.admission_rule_versions for update to authenticated
using (coalesce(private.current_user_role()::text, '') = 'admin')
with check (
  coalesce(private.current_user_role()::text, '') = 'admin'
  and (status <> 'verified' or verified_by = (select auth.uid()))
);

create policy admission_rules_admin_delete
on public.admission_rule_versions for delete to authenticated
using (coalesce(private.current_user_role()::text, '') = 'admin');

drop policy if exists admission_rules_student_verified_read on public.admission_rule_versions;
create policy admission_rules_student_verified_read
on public.admission_rule_versions
for select
to authenticated
using (
  status = 'verified'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role = 'student'
  )
);

comment on table public.admission_rule_versions is
  'Versioned, source-attributed Egyptian university admission rules. Only active administrators may manage rules; students can read verified versions only.';
