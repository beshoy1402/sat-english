import { useCallback, useEffect, useState } from 'react';
import { Activity, Eye, EyeOff, KeyRound, RefreshCw, Save, ShieldCheck, Sparkles } from 'lucide-react';

type ProviderId = 'nvidia' | 'gemini' | 'groq' | 'openrouter';
type ProviderConfig = { provider: ProviderId; base_url: string; model: string; is_enabled: boolean; priority: number; key_configured: boolean; last_tested_at: string | null; last_test_status: string | null };
const catalog: { id: ProviderId; name: string; detail: string; placeholder: string }[] = [
  { id: 'nvidia', name: 'NVIDIA NIM', detail: 'Primary AI · Nemotron 3.5 Super VL 120B · Free Endpoint', placeholder: 'nvidia/nemotron-3.5-super-vl-120b-a12b' },
  { id: 'gemini', name: 'Google Gemini', detail: 'Fallback AI · Gemini Free Tier only', placeholder: 'gemini-3.8-flash' },
  { id: 'groq', name: 'GroqCloud', detail: 'Alternative AI · GPT-OSS 120B · Free plan', placeholder: 'openai/gpt-oss-120b' },
  { id: 'openrouter', name: 'OpenRouter', detail: 'Fallback AI · Dynamic free-model router', placeholder: 'openrouter/free' },
];

export default function AIProviderSettings({ client }: { client: any }) {
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [usage, setUsage] = useState<any>({ summary: { requests: 0, failures: 0, promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0, pricedEntries: 0 }, rows: [] });
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [priority, setPriority] = useState<Record<string, number>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    if (!client) throw new Error('Supabase is not configured for this environment.');
    const { data, error } = await client.functions.invoke('ai-provider-settings', { body });
    if (error) throw new Error(error.message || 'AI provider request failed.');
    if (data?.error) throw new Error(data.error);
    return data;
  }, [client]);

  const load = useCallback(async () => {
    setBusy('loading');
    try {
      const [data, usageData] = await Promise.all([invoke({ action: 'list' }), invoke({ action: 'usage' })]);
      setUsage(usageData);
      const next: Record<string, ProviderConfig> = {};
      for (const row of data.providers ?? []) next[row.provider] = row;
      setConfigs(next);
      const defaults: Record<string, string> = { nvidia: 'nvidia/nemotron-3.5-super-vl-120b-a12b', gemini: 'gemini-3.8-flash', groq: 'openai/gpt-oss-120b', openrouter: 'openrouter/free' };
      setModels(Object.fromEntries(catalog.map(provider => [provider.id, provider.id === 'nvidia' && next[provider.id]?.model !== defaults[provider.id] ? defaults[provider.id] : provider.id === 'groq' && next[provider.id]?.model === 'llama-3.3-70b-versatile' ? defaults[provider.id] : provider.id === 'openrouter' ? defaults[provider.id] : next[provider.id]?.model || defaults[provider.id]])));
      setBaseUrls(Object.fromEntries(Object.entries(next).map(([id, row]) => [id, row.base_url ?? ''])));
      setEnabled(Object.fromEntries(Object.entries(next).map(([id, row]) => [id, row.is_enabled])));
      const defaultPriorities: Record<string, number> = { nvidia: 1, gemini: 2, groq: 3, openrouter: 4 };
      setPriority(Object.fromEntries(catalog.map(provider => [provider.id, next[provider.id]?.priority ?? defaultPriorities[provider.id]])));
      setMessage(null);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not load provider settings.', error: true });
    } finally { setBusy(''); }
  }, [invoke]);

  useEffect(() => { void load(); }, [load]);

  const save = async (id: ProviderId) => {
    setBusy(id);
    try {
      await invoke({ action: 'save', provider: id, apiKey: keys[id] ?? '', baseUrl: baseUrls[id] ?? configs[id]?.base_url ?? '', model: models[id] ?? '', enabled: Boolean(enabled[id]), priority: Number(priority[id] ?? 100) });
      setKeys(current => ({ ...current, [id]: '' }));
      setMessage({ text: catalog.find(p => p.id === id)!.name + ' settings saved securely.' });
      await load();
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Could not save settings.', error: true }); }
    finally { setBusy(''); }
  };

  const test = async (id: ProviderId) => {
    setBusy('test-' + id);
    try {
      const result = await invoke({ action: 'test', provider: id, baseUrl: baseUrls[id] ?? configs[id]?.base_url ?? '' });
      setMessage({ text: catalog.find(p => p.id === id)!.name + ': ' + result.status, error: result.status !== 'Connected' && !String(result.status).startsWith('Connected ·') });
      await load();
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : 'Connection test failed.', error: true }); }
    finally { setBusy(''); }
  };

  return <section className="panel full-panel ai-provider-panel">
    <div className="panel-heading"><div><small>DEVELOPER · AI CONFIGURATION</small><h3>AI Provider Management</h3><p>Manage your AI routing stack, securely store provider keys, and monitor reliability and usage.</p></div><Sparkles/></div>
    <div className="ai-security-note"><ShieldCheck size={18}/><div><b>Credentials stay server-side</b><span>API keys are saved in Supabase Vault and are never returned to the browser after saving.</span></div></div>
    <div className="ai-security-note"><ShieldCheck size={18}/><div><b>Zero-cost routing is enforced</b><span>Only NVIDIA Nemotron 3.5 Super VL 120B, Gemini Free Tier, Groq GPT-OSS 120B Free and OpenRouter's dynamic free router are allowed. NVIDIA's free endpoint and other providers can have rate limits or quotas; free access is not unlimited. Other providers and paid model IDs are blocked.</span></div></div>
    {message && <div className={message.error ? 'error-banner' : 'notice-banner'}>{message.text}</div>}
    <div className="ai-provider-list">{catalog.map(provider => {
      const row = configs[provider.id];
      const isBusy = busy === provider.id || busy === 'test-' + provider.id;
      return <article className="ai-provider-card" key={provider.id}>
        <div className="ai-provider-top"><div><span className="ai-provider-name">{provider.name}</span><small>{provider.detail}</small></div><span className={row?.key_configured ? 'ai-status connected' : 'ai-status'}>{row?.key_configured ? 'Key saved' : 'Not connected'}</span></div>
        <label>API key<div className="ai-key-field"><KeyRound size={16}/><input type={visible[provider.id] ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} placeholder={row?.key_configured ? 'Saved securely · enter a new key to rotate' : 'Paste API key'} value={keys[provider.id] ?? ''} onChange={e => setKeys(current => ({ ...current, [provider.id]: e.target.value }))}/><button type="button" onClick={() => setVisible(current => ({ ...current, [provider.id]: !current[provider.id] }))} aria-label={visible[provider.id] ? 'Hide API key' : 'Show API key'}>{visible[provider.id] ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
        <label>Preferred model ID<input value={models[provider.id] ?? ''} onChange={e => setModels(current => ({ ...current, [provider.id]: e.target.value }))} placeholder={provider.placeholder}/></label>
        <div className="ai-provider-options"><label className="ai-toggle"><input type="checkbox" checked={Boolean(enabled[provider.id])} onChange={e => setEnabled(current => ({ ...current, [provider.id]: e.target.checked }))}/> Enable provider for routing</label><label>Priority<input type="number" min="1" max="999" value={priority[provider.id] ?? 100} onChange={e => setPriority(current => ({ ...current, [provider.id]: Number(e.target.value) }))}/></label></div>
        <div className="ai-provider-actions"><button className="small-primary" disabled={isBusy || (!keys[provider.id] && !row?.key_configured)} onClick={() => void save(provider.id)}><Save size={15}/>{isBusy && busy === provider.id ? 'Saving…' : 'Save settings'}</button><button className="icon-button" disabled={isBusy || !row?.key_configured} onClick={() => void test(provider.id)}><Activity size={15}/> Test connection</button></div>
        {row?.last_test_status && <small className="ai-last-test">{row.last_test_status}{row.last_tested_at ? ' · ' + new Date(row.last_tested_at).toLocaleString() : ''}</small>}
      </article>;
    })}</div>
    <section className="ai-usage-panel">
      <div className="ai-usage-heading">
        <div><small>AI OPERATIONS</small><h4>Usage and cost monitoring</h4><p>Live operational view of the latest 200 requests across enabled providers.</p></div>
        <button type="button" onClick={() => void load()}><RefreshCw size={14}/> Refresh usage</button>
      </div>
      <div className="ai-usage-stats">
        <div><span>Requests</span><b>{usage.summary?.requests ?? 0}</b></div>
        <div><span>Failed requests</span><b>{usage.summary?.failures ?? 0}</b></div>
        <div><span>Tokens processed</span><b>{(Number(usage.summary?.promptTokens ?? 0) + Number(usage.summary?.completionTokens ?? 0)).toLocaleString()}</b></div>
        <div><span>Estimated AI cost</span><b>{usage.summary?.pricedEntries ? '$' + Number(usage.summary.estimatedCostUsd).toFixed(4) : 'Not priced'}</b></div>
      </div>
      <div className="ai-usage-table">
        <div className="ai-usage-row ai-usage-header"><span>Time</span><span>Feature</span><span>Provider / model</span><span>Status</span><span>Latency</span></div>
        {(usage.rows ?? []).slice(0,20).map((row: any) => <div className="ai-usage-row" key={row.id}><span>{new Date(row.created_at).toLocaleString()}</span><span>{row.feature}</span><span>{row.provider} · {row.model}</span><span className={row.success ? 'ok' : 'failed'}>{row.success ? 'Success' : 'Failed'}</span><span>{row.latency_ms ? row.latency_ms + ' ms' : '—'}</span></div>)}
        {!(usage.rows ?? []).length && <p>No AI requests have been recorded yet.</p>}
      </div>
      <small className="ai-usage-footnote">Token usage and latency are recorded. Exact cost remains unavailable until provider pricing is configured; no cost is guessed.</small>
    </section>
    <div className="ai-footer-actions"><button className="icon-button" onClick={() => void load()} disabled={busy !== ''}><RefreshCw size={15}/> Refresh provider status</button><p>Lower priority numbers are tried first. Automatic failover is handled by the AI request service using this provider registry.</p></div>
  </section>;
}
