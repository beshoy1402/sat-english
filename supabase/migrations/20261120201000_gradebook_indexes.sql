create index if not exists grade_entries_recorded_by_idx on public.grade_entries(recorded_by);
create index if not exists grade_entry_history_actor_idx on public.grade_entry_history(actor_profile_id);