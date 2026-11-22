import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [ai, recordings, supabaseClient, providerSettings, providerManagement, deleteAccount, app, homework, homeworkMigration, admission, admissionMigration, questionBank, packageJson, liveClassroom, liveMigration, liveCss, questionBankMigration, styles] = await Promise.all([
  read('../supabase/functions/ai-learning/index.ts'),
  read('../src/RecordedSessions.tsx'),
  read('../src/lib/supabase.ts'),
  read('../src/AIProviderSettings.tsx'),
  read('../supabase/functions/ai-provider-settings/index.ts'),
  read('../supabase/functions/delete-account/index.ts'),
  read('../src/App.tsx'),
  read('../src/HomeworkCenter.tsx'),
  read('../supabase/migrations/20261121162000_homework_teacher_attachments.sql'),
  read('../src/AdmissionCalculator.tsx'),
  read('../supabase/migrations/20261123130000_admission_rule_registry.sql'),
  read('../src/QuestionBank.tsx'),
  read('../package.json'),
  read('../src/LiveClassroom.tsx'),
  read('../supabase/migrations/20261123100000_live_classroom_foundation.sql'),
  read('../src/live-classroom.css'),
  read('../supabase/migrations/20261120233000_flexible_question_bank.sql'),
  read('../src/styles.css'),
]);

// AI must use the approved NVIDIA-first provider/model/endpoint allowlist.
assert.match(ai, /parsed\.origin === "https:\/\/integrate\.api\.nvidia\.com"/);
assert.match(ai, /provider\.model === "nvidia\/nemotron-3\.5-super-vl-120b-a12b"/);
assert.match(ai, /parsed\.origin === "https:\/\/generativelanguage\.googleapis\.com"/);
assert.match(ai, /provider\.model === "gemini-3\.8-flash"/);
assert.match(ai, /parsed\.origin === "https:\/\/openrouter\.ai"/);
assert.match(ai, /provider\.model === "openrouter\/free"/);
assert.doesNotMatch(ai, /provider\.provider === "groq"/);
assert.doesNotMatch(ai, /provider\.provider === "anthropic"/);
assert.doesNotMatch(ai, /provider\.provider === "openai"/);
assert.match(ai, /\.eq\("success", true\)/);
assert.match(ai, /p\.is_enabled && p\.key_configured && isApprovedFreeProvider\(p\)/);
assert.match(ai, /refundReservedPoints/);
assert.ok(providerSettings.includes("type ProviderId = 'nvidia' | 'gemini' | 'openrouter'"));
assert.match(providerSettings, /id: 'nvidia', name: 'NVIDIA NIM'/);
assert.match(providerSettings, /id: 'gemini', name: 'Google Gemini'/);
assert.match(providerSettings, /id: 'openrouter', name: 'OpenRouter'/);
assert.doesNotMatch(providerSettings, /id: 'groq'/);
assert.match(providerManagement, /nvidia: \{ baseUrl: "https:\/\/integrate\.api\.nvidia\.com\/v1"/);
assert.match(providerManagement, /gemini: \{ baseUrl: "https:\/\/generativelanguage\.googleapis\.com\/v1beta"/);
assert.match(providerManagement, /openrouter: \{ baseUrl: "https:\/\/openrouter\.ai\/api\/v1"/);
assert.doesNotMatch(providerManagement, /groq: \{/);
assert.doesNotMatch(providerManagement, /anthropic: \{/);
assert.doesNotMatch(providerManagement, /openai: \{/);

// Main account and record actions must always release their busy state after errors.
for (const handler of ['signIn','createAccount','resetAccount','deleteAccount','saveItem','removeRecord']) {
  const start = app.indexOf(`const ${handler}=`);
  const end = app.indexOf('finally { setBusy(false); }', start);
  assert.ok(start >= 0 && end > start, `${handler} must release busy state in finally`);
}
assert.match(app, /Sign out failed\. Please try again\./);
assert.match(app, /Could not load workspace data\. Please refresh\./);
assert.match(app, /Could not restore your session\. Please refresh\./);

// Account deletion permissions must be enforced by the server and reflected in the UI.
assert.match(deleteAccount, /actor\.role !== "admin" && \["teacher", "assistant"\]\.includes\(target\.role\)/);
assert.match(app, /canDeleteStaff=\{profile\.role===\'admin\'\}/);
assert.match(app, /!\[\'teacher\',\'assistant\'\]\.includes\(r\.role\)\|\|canDeleteStaff/);

// Resumable uploads must never send credentials to arbitrary browser-stored URLs.
assert.match(recordings, /parsed\.origin === endpointOrigin/);
assert.match(recordings, /parsed\.pathname\.startsWith\('\/storage\/v1\/upload\/resumable\/'\)/);
assert.match(recordings, /confirmedOffset !== nextOffset/);
assert.match(recordings, /Could not verify the saved upload session/);

// A completed video must remain recoverable when metadata persistence fails.
assert.match(recordings, /\.eq\('storage_path', path\)\s*\.\s*maybeSingle\(\)/);
assert.match(recordings, /Your uploaded video has been kept so you can retry/);
assert.doesNotMatch(recordings, /if \(insertError\) \{\s*await client\.storage\.from\(BUCKET\)\.remove/);

// Hosted preview deployments must not silently connect to production Supabase.
assert.match(supabaseClient, /appMode !== 'preview-safe'/);


// Teacher homework supports optional AI worksheet generation and secure attachments.
assert.match(homework, /Generate an AI worksheet for this homework/);
assert.match(homework, /action:'worksheet'/);
assert.match(homework, /include_answer_key:false/);
assert.match(homework, /attachment_paths:uploaded/);
assert.match(homework, /Attach homework files/);
assert.match(homeworkMigration, /add column if not exists attachment_paths text\[\]/);
assert.match(homeworkMigration, /homework_assignment_attachment_upload/);
assert.match(homeworkMigration, /homework_assignment_attachment_read/);
assert.match(homeworkMigration, /l\.parent_profile_id = \(select auth\.uid\(\)\)/);

// Admission rules must be versioned, source-attributed and server-authorized.
assert.match(admissionMigration, /alter table public\.admission_rule_versions enable row level security/);
assert.match(admissionMigration, /admission_rules_admin_insert/);
assert.match(admissionMigration, /admission_rules_admin_update/);
assert.match(admissionMigration, /created_by = \(select auth\.uid\(\)\)/);
assert.match(admissionMigration, /status = 'verified'/);
assert.match(admissionMigration, /p\.role = 'student'/);
assert.match(admissionMigration, /verified_by = \(select auth\.uid\(\)\)/);
assert.match(admissionMigration, /admission_verified_requires_source/);
assert.match(admissionMigration, /version integer not null default 1/);
assert.match(admissionMigration, /admission_rule_version_unique_idx/);
assert.match(admissionMigration, /admission_rule_one_current_verified_idx/);
assert.match(admissionMigration, /create or replace function public\.guard_admission_rule_version/);
assert.match(admissionMigration, /Admission rules must be created as drafts/);
assert.match(admissionMigration, /Published admission rules cannot be edited/);
assert.match(admissionMigration, /Superseded admission rule versions are immutable/);
assert.match(admissionMigration, /Published admission rule history cannot be deleted/);
assert.match(admissionMigration, /revoke all on function public\.guard_admission_rule_version\(\) from public, anon, authenticated/);
assert.match(admissionMigration, /pg_advisory_xact_lock/);
assert.match(admission, /Number\.isInteger\(year\)/);
assert.match(admission, /minimum<0\|\|minimum>100/);
assert.match(admission, /v\{rule\.version\?\?1\}/);

assert.match(admission, /\.eq\('status','verified'\)/);
assert.match(admission, /status==='verified'/);
assert.match(admission, /window\.confirm\('Confirm that you personally checked this exact university/);
assert.match(admission, /status:'draft'/);
assert.match(admission, /No verified rule for this selection/);
assert.match(admission, /matching\.source_url/);
assert.match(app, /active==='admissionRules'&&profile\.role==='admin'/);
assert.match(app, /active==='admission'&&profile\.role==='student'/);

// The responsive workspace refinement must retain its navigation, mobile and visual-system hooks.
assert.match(styles, /\.workspace-hero\s*\{/);
assert.match(styles, /\.side-nav button\.active/);
assert.match(styles, /\.mobile-scrim/);
assert.match(styles, /@media\(max-width:760px\)/);
assert.match(styles, /prefers-reduced-motion/);

// Question-bank document imports must be bounded, previewed and explicit about OCR limits.
assert.match(questionBank, /readXlsxRows/);
assert.match(questionBank, /readDocxText/);
assert.match(questionBank, /readPdfText/);
assert.match(questionBank, /choice_\+letter/);
assert.match(questionBank, /option_\+letter/);
assert.match(questionBank, /answerLetter/);
assert.match(questionBank, /normalizedAnswer/);
assert.match(questionBank, /first worksheet must include a question column named prompt, question or question_text/);
assert.match(questionBank, /\.join\('\\n'\)/);
assert.match(questionBank, /25\*1024\*1024/);
assert.match(questionBank, /pdf\.numPages>80/);
assert.match(questionBank, /No selectable text was found/);
assert.match(questionBank, /Import is limited to 2,500 questions per file/);
assert.match(questionBank, /Duplicate prompt within this file/);
assert.match(questionBank, /Import valid rows/);
assert.match(questionBank, /staff_save_question_bank_item/);
assert.ok(packageJson.includes('"mammoth": "^1.13.0"'));
assert.ok(packageJson.includes('"pdfjs-dist": "^6.5.438"'));
assert.ok(packageJson.includes('"read-excel-file": "^9.3.20"'));

 // Question-bank table is RPC-only; non-admin staff may edit/delete only their own items.
assert.match(questionBankMigration, /revoke all on public\.question_bank_items from anon,authenticated/);
assert.match(questionBankMigration, /created_by = \(select auth\.uid\(\)\)/);
assert.match(questionBankMigration, /Question bank item not found or you cannot edit it/);
assert.match(questionBankMigration, /Question bank item not found or you cannot delete it/);
assert.match(questionBankMigration, /where id=p_id\s+and\s+\(/);
assert.match(questionBankMigration, /for update/);
assert.match(questionBankMigration, /v_exam\.status::text <> 'draft'/);
assert.match(questionBankMigration, /You can only add question-bank items to exams you created/);


// Live hand raises persist in the database, are permission-checked by an RPC, and retain an event trail.
assert.match(liveMigration, /create table if not exists public\.live_session_hand_raises/);
assert.match(liveMigration, /create table if not exists public\.live_session_hand_raise_events/);
assert.match(liveMigration, /alter table public\.live_session_hand_raises enable row level security/);
assert.match(liveMigration, /live_session_hand_raises_read_participants/);
assert.match(liveMigration, /live_session_hand_raise_events_read_participants/);
assert.match(liveMigration, /create or replace function public\.live_session_set_hand_raise/);
assert.match(liveMigration, /Only an enrolled student in an open room can raise a hand/);
assert.match(liveMigration, /Only the classroom host or assigned staff may lower another participant hand/);
assert.match(liveMigration, /lowered_by_teacher/);
const leaveRpcStart = liveMigration.indexOf('create or replace function public.live_session_leave');
const leaveRpcEnd = liveMigration.indexOf('$function$;', leaveRpcStart + 1);
const leaveRpc = liveMigration.slice(leaveRpcStart, leaveRpcEnd);
const removeRpcStart = liveMigration.indexOf('create or replace function public.live_session_remove_participant');
const removeRpcEnd = liveMigration.indexOf('$function$;', removeRpcStart + 1);
const removeRpc = liveMigration.slice(removeRpcStart, removeRpcEnd);
assert.match(leaveRpc, /live_session_hand_raises/);
assert.match(leaveRpc, /live_session_hand_raise_events/);
assert.match(removeRpc, /live_session_hand_raises/);
assert.match(removeRpc, /live_session_hand_raise_events/);
assert.match(liveMigration, /revoke all on function public\.live_session_set_hand_raise\(uuid,boolean,uuid\) from public, anon/);
assert.match(liveClassroom, /from\('live_session_hand_raises'\)/);
assert.match(liveClassroom, /from\('live_session_hand_raise_events'\)/);
assert.match(liveClassroom, /rpc\('live_session_set_hand_raise'/);
assert.match(liveClassroom, /lowerParticipantHand/);
assert.match(liveClassroom, /Hand raise history/);
assert.match(liveCss, /\.live-hand-history/);


console.log('Project safety checks passed.');
