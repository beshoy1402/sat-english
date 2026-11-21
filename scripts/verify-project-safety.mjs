import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [ai, recordings, supabaseClient] = await Promise.all([
  read('../supabase/functions/ai-learning/index.ts'),
  read('../src/RecordedSessions.tsx'),
  read('../src/lib/supabase.ts'),
]);

// AI must use a strict zero-cost provider/model/endpoint allowlist.
assert.match(ai, /parsed\.origin === "https:\/\/generativelanguage\.googleapis\.com"/);
assert.match(ai, /provider\.model === "gemini-3\.8-flash"/);
assert.match(ai, /parsed\.origin === "https:\/\/openrouter\.ai"/);
assert.match(ai, /meta-llama\/llama-3\.3-70b-instruct:free/);
assert.match(ai, /p\.is_enabled && p\.key_configured && isApprovedFreeProvider\(p\)/);
assert.match(ai, /AI is paused by the zero-cost safety policy/);

// Resumable uploads must never send credentials to arbitrary browser-stored URLs.
assert.match(recordings, /parsed\.origin === endpointOrigin/);
assert.match(recordings, /parsed\.pathname\.startsWith\('\/storage\/v1\/upload\/resumable\/'\)/);
assert.match(recordings, /confirmedOffset > nextOffset/);
assert.match(recordings, /Could not verify the saved upload session/);

// A completed video must remain recoverable when metadata persistence fails.
assert.match(recordings, /\.eq\('storage_path', path\)\.\s*maybeSingle\(\)/);
assert.match(recordings, /Your uploaded video has been kept so you can retry/);
assert.doesNotMatch(recordings, /if \(insertError\) \{\s*await client\.storage\.from\(BUCKET\)\.remove/);

// Hosted preview deployments must not silently connect to production Supabase.
assert.match(supabaseClient, /appMode !== 'preview-safe'/);

console.log('Project safety checks passed.');
