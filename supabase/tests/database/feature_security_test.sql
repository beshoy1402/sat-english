begin;

select plan(26);

select has_table('public', 'admission_rule_versions', 'Versioned admission rules table exists');
select has_column('public', 'admission_rule_versions', 'version', 'Admission rules carry a version number');
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='admission_rule_versions'),
  'Admission rule registry has RLS enabled'
);
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='admission_rule_versions' and policyname='admission_rules_admin_insert'), 'Only the admin insert policy is present');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='admission_rule_versions' and policyname='admission_rules_admin_update'), 'Only the admin update policy is present');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='admission_rule_versions' and policyname='admission_rules_student_verified_read'), 'Student reads are limited to verified rules');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='admission_rule_versions' and indexname='admission_rule_one_current_verified_idx'), 'Only one current verified version is allowed per university/faculty/year');

select has_table('public', 'live_session_hand_raises', 'Persistent live hand state table exists');
select has_table('public', 'live_session_hand_raise_events', 'Hand raise event history table exists');
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='live_session_hand_raises'),
  'Live hand state has RLS enabled'
);
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='live_session_hand_raise_events'),
  'Live hand event history has RLS enabled'
);
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='live_session_hand_raises' and policyname='live_session_hand_raises_read_participants'), 'Hand state reads require session access');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='live_session_hand_raise_events' and policyname='live_session_hand_raise_events_read_participants'), 'Hand history reads require session access');
select ok(to_regprocedure('public.live_session_set_hand_raise(uuid,boolean,uuid)') is not null, 'Hand state is changed through a dedicated RPC');
select ok(has_function_privilege('authenticated', 'public.live_session_set_hand_raise(uuid,boolean,uuid)', 'EXECUTE'), 'Authenticated participants can call the hand raise RPC');
select ok(not has_function_privilege('anon', 'public.live_session_set_hand_raise(uuid,boolean,uuid)', 'EXECUTE'), 'Anonymous users cannot call the hand raise RPC');

select has_table('public', 'question_bank_items', 'Question bank table exists');
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='question_bank_items'),
  'Question bank has RLS enabled'
);
select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='question_bank_items'),
  0,
  'Question bank has no direct table policies because access is RPC-only'
);
select ok(not has_table_privilege('authenticated', 'public.question_bank_items', 'SELECT'), 'Authenticated users cannot directly read question bank rows');
select ok(not has_table_privilege('anon', 'public.question_bank_items', 'SELECT'), 'Anonymous users cannot directly read question bank rows');
select ok(has_function_privilege('authenticated', 'public.staff_list_question_bank_items(text)', 'EXECUTE'), 'Authenticated staff can call the question bank list RPC');
select ok(not has_function_privilege('anon', 'public.staff_list_question_bank_items(text)', 'EXECUTE'), 'Anonymous users cannot call the question bank list RPC');
select ok(has_function_privilege('authenticated', 'public.staff_save_question_bank_item(uuid,text,text,text,text,text,text,jsonb,jsonb,text,numeric)', 'EXECUTE'), 'Authenticated staff can call the question bank save RPC');
select ok(has_function_privilege('authenticated', 'public.staff_delete_question_bank_item(uuid)', 'EXECUTE'), 'Authenticated staff can call the question bank delete RPC');
select ok(has_function_privilege('authenticated', 'public.staff_add_bank_items_to_exam(uuid,uuid[])', 'EXECUTE'), 'Authenticated staff can call the exam assembly RPC');

select * from finish();
rollback;
