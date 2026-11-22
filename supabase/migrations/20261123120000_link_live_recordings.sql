-- Link teacher-created browser recordings to the live lesson that produced them.
-- Source-only migration. Do not apply to production without explicit approval.
alter table public.session_recordings
  add column if not exists live_session_id uuid
  references public.live_sessions(id) on delete set null;

create index if not exists session_recordings_live_session_idx
  on public.session_recordings(live_session_id)
  where live_session_id is not null;

comment on column public.session_recordings.live_session_id is
  'Optional live classroom session that produced this recording; recordings remain private drafts until explicitly published.';
