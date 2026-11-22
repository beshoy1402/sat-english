import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [ai, recordings, supabaseClient, providerSettings, providerManagement, deleteAccount, app, homework, homeworkMigration, admission, admissionMigration, questionBank, packageJson] = await Promise.all([
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
assert.match(admission, /\.eq\('status','verified'\)/);
assert.match(admission, /status==='verified'/);
assert.match(admission, /window\.confirm\('Confirm that you personally checked this exact university/);
assert.match(admission, /status:'draft'/);
assert.match(admission, /No verified rule for this selection/);
assert.match(admission, /matching\.source_url/);
assert.match(app, /active==='admissionRules'&&profile\.role==='admin'/);
assert.match(app, /active==='admission'&&profile\.role==='student'/);

// Question-bank document imports must be bounded, previewed and explicit about OCR limits.
assert.match(questionBank, /readXlsxRows/);
assert.match(questionBank, /readDocxText/);
assert.match(questionBank, /readPdfText/);
assert.match(questionBank, /25\*1024\*1024/);
assert.match(questionBank, /pdf\.numPages>80/);
assert.match(questionBank, /No selectable text was found/);
assert.match(questionBank, /Import is limited to 2,500 questions per file/);
assert.match(questionBank, /Duplicate prompt within this file/);
assert.match(questionBank, /Import valid rows/);
assert.match(questionBank, /staff_save_question_bank_item/);
assert.match(packageJson, /"mammoth": "\\^1\.13\.0"/);
assert.match(packageJson, /"pdfjs-dist": "\\^6\.5\.438"/);
assert.match(packageJson, /"read-excel-file": "\\^9\.3\.20"/);

console.log('Project safety checks passed.');
