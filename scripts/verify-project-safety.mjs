import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [ai, recordings, supabaseClient, providerSettings, providerManagement, deleteAccount, app, homework, homeworkMigration] = await Promise.all([
  read('../supabase/functions/ai-learning/index.ts'),
  read('../src/RecordedSessions.tsx'),
  read('../src/lib/supabase.ts'),
  read('../src/AIProviderSettings.tsx'),
  read('../supabase/functions/ai-provider-settings/index.ts'),
  read('../supabase/functions/delete-account/index.ts'),
  read('../src/App.tsx'),
  read('../src/HomeworkCenter.tsx'),
  read('../supabase/migrations/20261121162000_homework_teacher_attachments.sql'),
]);

// AI must use the approved Gemini-first, zero-cost provider/model/endpoint allowlist.
assert.match(ai, /parsed\.origin === "https:\/\/generativelanguage\.googleapis\.com"/);
assert.match(ai, /provider\.model === "gemini-3\.8-flash"/);
assert.match(ai, /parsed\.origin === "https:\/\/openrouter\.ai"/);
assert.match(ai, /provider\.model === "openrouter\/free"/);
assert.match(ai, /parsed\.origin === "https:\/\/api\.groq\.com"/);
assert.match(ai, /provider\.model === "openai\/gpt-oss-120b"/);
assert.doesNotMatch(ai, /provider\.provider === "nvidia"/);
assert.doesNotMatch(ai, /provider\.provider === "anthropic"/);
assert.doesNotMatch(ai, /provider\.provider === "openai"/);
assert.match(ai, /\.eq\("success", true\)/);
assert.match(ai, /p\.is_enabled && p\.key_configured && isApprovedFreeProvider\(p\)/);
assert.match(ai, /AI is paused by the zero-cost safety policy/);
assert.match(ai, /refundReservedPoints/);
assert.match(ai, /if \(saveError\) \{\s*const refund = await refundReservedPoints\(\)/);
assert.match(ai, /const refund = await refundReservedPoints\(\);\s*return respond\(\{ error: "All enabled AI providers failed\."/);
assert.match(ai, /if \(rateError\) return respond\(\{ error: "AI usage limits could not be checked safely/);
assert.ok(ai.includes('const cleaned = content.replace(/^\\`\\`\\`(?:json)?\\s*/i'), 'Worksheet JSON fence parsing must accept normal whitespace.');
assert.ok(providerSettings.includes("type ProviderId = 'gemini' | 'openrouter' | 'groq'"));
assert.match(providerSettings, /id: 'gemini', name: 'Google Gemini'/);
assert.match(providerSettings, /id: 'openrouter', name: 'OpenRouter'/);
assert.match(providerSettings, /id: 'groq', name: 'GroqCloud'/);
assert.doesNotMatch(providerSettings, /id: 'nvidia'/);
assert.doesNotMatch(providerSettings, /id: 'anthropic'/);
assert.match(providerSettings, /Primary AI/);
assert.match(providerSettings, /openrouter\/free/);
assert.match(providerManagement, /gemini: \{ baseUrl: "https:\/\/generativelanguage\.googleapis\.com\/v1beta"/);
assert.match(providerManagement, /groq: \{ baseUrl: "https:\/\/api\.groq\.com\/openai\/v1"/);
assert.match(providerManagement, /openrouter: \{ baseUrl: "https:\/\/openrouter\.ai\/api\/v1"/);
assert.doesNotMatch(providerManagement, /nvidia: \{/);
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

console.log('Project safety checks passed.');
