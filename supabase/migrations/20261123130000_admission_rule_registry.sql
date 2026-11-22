-- Versioned Egyptian university admission rules.
-- Rules remain drafts until an administrator verifies the exact source and publishes them.
create table if not exists public.admission_rule_versions (
  id uuid primary key default gen_random_uuid(),
  university text not null check (length(trim(university)) between 2 and 180),
  faculty text not null check (length(trim(faculty)) between 2 and 180),
  admission_year integer not null check (admission_year between 2020 and 2100),
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
      and formula ? 'kind'
      and formula->>'kind' = 'weighted_sum'
      and formula ? 'weights'
      and score_scales ? 'gpa_max'
      and score_scales ? 'sat1_max'
      and score_scales ? 'sat2_max'
    )
  )
);
create index if not exists admission_rule_lookup_idx
  on public.admission_rule_versions (lower(university), lower(faculty), admission_year, status);

alter table public.admission_rule_versions enable row level security;
revoke all on public.admission_rule_versions from anon, authenticated;
grant select, insert, update, delete on public.admission_rule_versions to authenticated;

drop policy if exists admission_rules_admin_all on public.admission_rule_versions;
create policy admission_rules_admin_all
on public.admission_rule_versions
for all
to authenticated
using (coalesce(private.current_user_role()::text, '') = 'admin')
with check (coalesce(private.current_user_role()::text, '') = 'admin');

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
