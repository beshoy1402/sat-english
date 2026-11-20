import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const providers = {
  qwen: { baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", testUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models", auth: "bearer" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", testUrl: "https://generativelanguage.googleapis.com/v1beta/models", auth: "query" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", testUrl: "https://api.groq.com/openai/v1/models", auth: "bearer" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", testUrl: "https://api.deepseek.com/v1/models", auth: "bearer" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", testUrl: "https://openrouter.ai/api/v1/models", auth: "bearer" },
} as const;

type Provider = keyof typeof providers;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!url || !serviceKey || !authHeader) return respond({ error: "Server configuration or authorization missing" }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.replace(/^Bearer\\s+/i, "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return respond({ error: "Invalid session" }, 401);

  const { data: actor, error: actorError } = await admin.from("profiles")
    .select("id,role,is_active").eq("id", userData.user.id).single();
  if (actorError || !actor?.is_active || actor.role !== "developer") {
    return respond({ error: "Only active Developer accounts can manage AI provider credentials." }, 403);
  }

  let body: { action?: string; provider?: string; apiKey?: string; model?: string; enabled?: boolean; priority?: number };
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const action = body.action;

  if (action === "list") {
    const { data, error } = await admin.rpc("ai_provider_config_list");
    if (error) return respond({ error: "AI provider settings are not initialized. Apply the local AI-provider migration first." }, 503);
    return respond({ providers: data ?? [] });
  }

  const provider = body.provider as Provider;
  if (!provider || !(provider in providers)) return respond({ error: "Choose a supported AI provider." }, 400);
  const config = providers[provider];

  if (action === "save") {
    const apiKey = (body.apiKey ?? "").trim();
    if (apiKey.length > 500) return respond({ error: "API key is too long." }, 400);
    const { error } = await admin.rpc("ai_provider_config_save", {
      p_provider: provider,
      p_api_key: apiKey,
      p_base_url: config.baseUrl,
      p_model: (body.model ?? "").trim().slice(0, 160),
      p_is_enabled: Boolean(body.enabled),
      p_priority: Number.isFinite(body.priority) ? body.priority : 100,
    });
    if (error) return respond({ error: "Could not securely save this provider. Apply the local AI-provider migration first." }, 503);
    return respond({ saved: true, keyConfigured: true });
  }

  if (action === "test") {
    const { data: secret, error: secretError } = await admin.rpc("ai_provider_config_read_secret", { p_provider: provider });
    if (secretError || !secret) return respond({ error: "Save an API key before testing this provider." }, 400);
    const endpoint = config.auth === "query" ? config.testUrl + "?key=" + encodeURIComponent(secret) : config.testUrl;
    const headers: Record<string,string> = { Accept: "application/json" };
    if (config.auth === "bearer") headers.Authorization = "Bearer " + secret;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let status = "Connection failed";
    try {
      const response = await fetch(endpoint, { method: "GET", headers, signal: controller.signal });
      if (response.ok) {
        const payload = await response.json();
        const models = Array.isArray(payload.data) ? payload.data.length : Array.isArray(payload.models) ? payload.models.length : 0;
        status = "Connected" + (models ? " · " + models + " models detected" : "");
      } else {
        status = response.status === 401 || response.status === 403 ? "Authentication failed · check the API key" : "Provider returned HTTP " + response.status;
      }
    } catch (error) {
      status = error instanceof Error && error.name === "AbortError" ? "Connection timed out" : "Could not reach provider";
    } finally {
      clearTimeout(timeout);
    }
    await admin.rpc("ai_provider_config_tested", { p_provider: provider, p_status: status });
    return respond({ tested: true, status });
  }

  return respond({ error: "Unknown action." }, 400);
});
