import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type ProviderRow = { provider: string; base_url: string; model: string; is_enabled: boolean; priority: number; key_configured: boolean };
type ChatMessage = { role: "user" | "assistant"; content: string };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const defaultModels: Record<string, string> = {
  qwen: "qwen-plus",
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  openrouter: "openai/gpt-4o-mini",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  meta_llama: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
};

function extractText(provider: string, data: any): string {
  if (provider === "gemini") return (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
  if (provider === "anthropic") return (data?.content ?? []).filter((p: any) => p.type === "text").map((p: any) => p.text ?? "").join("").trim();
  const value = data?.choices?.[0]?.message?.content;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((p: any) => p.text ?? "").join("").trim();
  return "";
}

function usageOf(provider: string, data: any) {
  if (provider === "gemini") return {
    prompt: Number(data?.usageMetadata?.promptTokenCount ?? 0),
    completion: Number(data?.usageMetadata?.candidatesTokenCount ?? 0),
  };
  if (provider === "anthropic") return {
    prompt: Number(data?.usage?.input_tokens ?? 0),
    completion: Number(data?.usage?.output_tokens ?? 0),
  };
  return {
    prompt: Number(data?.usage?.prompt_tokens ?? 0),
    completion: Number(data?.usage?.completion_tokens ?? 0),
  };
}

function homeworkJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const value = JSON.parse(cleaned);
  const strengths = Array.isArray(value.strengths) ? value.strengths.slice(0, 8).map(String) : [];
  const improvements = Array.isArray(value.improvements) ? value.improvements.slice(0, 8).map(String) : [];
  const score = Number(value.score_suggestion);
  return {
    score_suggestion: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
    feedback_suggestion: String(value.feedback_suggestion ?? "").slice(0, 5000),
    strengths,
    improvements,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!url || !serviceKey || !authHeader) return respond({ error: "Server configuration or authorization missing" }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "Your session is invalid. Sign in again." }, 401);

  const { data: actor, error: actorError } = await admin.from("profiles").select("id,role,is_active").eq("id", authData.user.id).single();
  if (actorError || !actor?.is_active) return respond({ error: "Your account is inactive or unavailable." }, 403);

  let body: { action?: string; messages?: ChatMessage[]; submission_id?: string; exam_program?: string; target_date?: string; current_score?: number; target_score?: number; weekly_hours?: number; weak_topics?: string[] };
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON request." }, 400); }
  const action = body.action;
  if (action !== "tutor" && action !== "homework_review" && action !== "study_plan") return respond({ error: "Unsupported AI action." }, 400);

  if ((action === "tutor" || action === "study_plan") && actor.role !== "student") return respond({ error: "This learning feature is available to student accounts." }, 403);
  if (action === "homework_review" && !["admin", "teacher", "assistant"].includes(actor.role)) return respond({ error: "Only teaching staff can request an AI homework draft." }, 403);

  const { count: recentCount, error: rateError } = await admin.from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_profile_id", actor.id)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (!rateError && (recentCount ?? 0) >= (action === "homework_review" ? 20 : action === "study_plan" ? 8 : 50)) return respond({ error: "You've reached the hourly AI request limit. Please try again later." }, 429);

  let messages: ChatMessage[] = [];
  let submission: any = null;
  if (action === "tutor") {
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    if (!incoming.length || incoming.length > 20) return respond({ error: "Send between 1 and 20 recent messages." }, 400);
    messages = incoming.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 6000),
    })).filter(m => m.content.trim());
    if (!messages.length) return respond({ error: "Message content is required." }, 400);
  } else if (action === "homework_review") {
    if (!body.submission_id) return respond({ error: "Submission ID is required." }, 400);
    const { data: sub, error: subError } = await admin.from("submissions").select("*").eq("id", body.submission_id).single();
    if (subError || !sub) return respond({ error: "Homework submission not found." }, 404);
    submission = sub;
    const { data: assn, error: assnError } = await admin.from("assignments").select("id,title,instructions,exam_program").eq("id", sub.assignment_id).single();
    if (assnError || !assn) return respond({ error: "Homework assignment not found." }, 404);
    if (!String(sub.answer_text ?? "").trim()) return respond({ error: "This submission contains files only. A teacher must open the files and provide text for AI review." }, 400);
    messages = [{ role: "user", content: [
      "Assignment: " + assn.title,
      "Program: " + assn.exam_program,
      "Instructions and rubric: " + (assn.instructions || "No rubric provided."),
      "Student answer: " + sub.answer_text,
      "Review the response for clarity, grammar, vocabulary, organization, task completion and accuracy. Be constructive and age-appropriate.",
      "Return only valid JSON with keys score_suggestion (0-100), feedback_suggestion (string), strengths (string array), improvements (string array). The score is only a suggested percentage, not a final grade.",
    ].join("\n\n") }];
  } else {
    const program = String(body.exam_program ?? "");
    if (!["SAT English", "EST English", "ACT English"].includes(program)) return respond({ error: "Choose SAT English, EST English or ACT English." }, 400);
    const hours = Number(body.weekly_hours ?? 5);
    if (!Number.isFinite(hours) || hours < 1 || hours > 80) return respond({ error: "Weekly study hours must be between 1 and 80." }, 400);
    const weakTopics = Array.isArray(body.weak_topics) ? body.weak_topics.slice(0, 12).map(String) : [];
    messages = [{ role: "user", content: [
      "Create a realistic personal English exam preparation plan.",
      "Exam: " + program,
      "Target date: " + (body.target_date || "Not specified"),
      "Current score: " + (body.current_score ?? "Not specified"),
      "Target score: " + (body.target_score ?? "Not specified"),
      "Available study hours each week: " + hours,
      "Topics to improve: " + (weakTopics.join(", ") || "Create a balanced plan"),
      "Create a practical weekly schedule with review, skill practice, timed questions and checkpoints.",
      "Return only valid JSON with keys overview, weekly_schedule (array of {day, focus, activities:[{title,description,duration_minutes}]}), milestones (array of {title,due_in_weeks,description}), and tips (string array).",
    ].join("\n\n") }];
  }

  const system = action === "tutor"
    ? "You are a patient, precise English exam tutor for SAT, EST and ACT English. Help the student understand reading comprehension, grammar, rhetorical skills, vocabulary and writing. Explain step by step, ask guiding questions when useful, correct misconceptions kindly, and provide short practice questions. Do not claim to know official exam answers unless the student provides the question. Keep answers focused on English learning."
    : action === "study_plan"
      ? "You are an expert English exam-preparation coach. Create achievable, structured plans with spaced review, skill practice and timed checkpoints. Return strict JSON only."
      : "You are an assistant teacher preparing a draft review of English homework. Evaluate only the response and assignment instructions supplied. Never invent rubric criteria. Give constructive feedback. Return strict JSON only.";

  const { data: configs, error: configError } = await admin.rpc("ai_provider_config_list");
  if (configError) return respond({ error: "AI provider configuration is unavailable. Check Developer → AI providers." }, 503);
  const enabled = ((configs ?? []) as ProviderRow[]).filter(p => p.is_enabled && p.key_configured).sort((a,b)=>a.priority-b.priority);
  if (!enabled.length) return respond({ error: "No AI provider is enabled with a saved API key. A Developer must configure at least one provider first." }, 503);

  const failures: string[] = [];
  for (const provider of enabled) {
    const started = Date.now();
    const { data: secret, error: secretError } = await admin.rpc("ai_provider_config_read_secret", { p_provider: provider.provider });
    if (secretError || !secret) { failures.push(provider.provider + ": missing credential"); continue; }
    const model = provider.model || defaultModels[provider.provider] || "";
    if (!model) { failures.push(provider.provider + ": model ID is required"); continue; }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      let endpoint = "";
      let headers: Record<string,string> = { "Content-Type": "application/json", Accept: "application/json" };
      let requestBody: Record<string,unknown>;
      if (provider.provider === "gemini") {
        endpoint = provider.base_url.replace(/\/$/,"") + "/models/" + encodeURIComponent(model) + ":generateContent";
        headers["x-goog-api-key"] = secret;
        requestBody = {
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: action === "tutor" ? 0.35 : 0.15, maxOutputTokens: 1400, ...(action !== "tutor" ? { responseMimeType: "application/json" } : {}) },
        };
      } else if (provider.provider === "anthropic") {
        endpoint = provider.base_url.replace(/\/$/,"") + "/messages";
        headers["x-api-key"] = secret;
        headers["anthropic-version"] = "2023-06-01";
        requestBody = { model, max_tokens: 1400, system, messages: messages.map(m => ({ role: m.role, content: m.content })), temperature: action === "tutor" ? 0.35 : 0.15 };
      } else {
        endpoint = provider.base_url.replace(/\/$/,"") + "/chat/completions";
        headers.Authorization = "Bearer " + secret;
        requestBody = { model, messages: [{ role: "system", content: system }, ...messages], temperature: action === "tutor" ? 0.35 : 0.15, max_tokens: 1400, ...(action !== "tutor" ? { response_format: { type: "json_object" } } : {}) };
      }

      const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(requestBody), signal: controller.signal });
      const raw = await response.text();
      if (!response.ok) throw new Error("HTTP " + response.status + ": " + raw.slice(0, 240));
      let payload: any;
      try { payload = JSON.parse(raw); } catch { throw new Error("Provider returned invalid JSON."); }
      const content = extractText(provider.provider, payload);
      if (!content) throw new Error("Provider returned an empty response.");
      const usage = usageOf(provider.provider, payload);
      const latency = Date.now() - started;
      await admin.from("ai_usage_logs").insert({
        user_profile_id: actor.id, feature: action, provider: provider.provider, model, success: true,
        latency_ms: latency, prompt_tokens: usage.prompt, completion_tokens: usage.completion,
        estimated_cost_usd: null,
      });

      if (action === "homework_review") {
        let draft;
        try { draft = homeworkJson(content); } catch { throw new Error("AI response could not be parsed as a review draft."); }
        const { data: saved, error: saveError } = await admin.from("ai_homework_review_drafts").upsert({
          submission_id: submission.id, ...draft, provider: provider.provider, model, generated_by: actor.id,
        }, { onConflict: "submission_id" }).select("*").single();
        if (saveError) throw new Error("Could not save the AI review draft.");
        return respond({ success: true, feature: action, provider: provider.provider, model, usage, draft: saved, requires_teacher_approval: true });
      }
      if (action === "study_plan") {
        let plan: any;
        try {
          const cleaned = content.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim();
          const value = JSON.parse(cleaned);
          plan = {
            overview: String(value.overview ?? "").slice(0, 2000),
            weekly_schedule: Array.isArray(value.weekly_schedule) ? value.weekly_schedule.slice(0, 7).map((day: any) => ({
              day: String(day.day ?? "").slice(0, 30),
              focus: String(day.focus ?? "").slice(0, 180),
              activities: Array.isArray(day.activities) ? day.activities.slice(0, 6).map((item: any) => ({
                title: String(item.title ?? "").slice(0, 140),
                description: String(item.description ?? "").slice(0, 500),
                duration_minutes: Math.max(5, Math.min(240, Number(item.duration_minutes ?? 30) || 30)),
                completed: false,
              })) : [],
            })) : [],
            milestones: Array.isArray(value.milestones) ? value.milestones.slice(0, 8) : [],
            tips: Array.isArray(value.tips) ? value.tips.slice(0, 10).map(String) : [],
          };
        } catch { throw new Error("AI response could not be parsed as a study plan."); }
        const { data: saved, error: saveError } = await admin.from("student_study_plans").insert({
          student_profile_id: actor.id, exam_program: body.exam_program, target_date: body.target_date || null,
          current_score: body.current_score === null || body.current_score === undefined || body.current_score === '' ? null : (Number.isFinite(Number(body.current_score)) ? Number(body.current_score) : null),
          target_score: body.target_score === null || body.target_score === undefined || body.target_score === '' ? null : (Number.isFinite(Number(body.target_score)) ? Number(body.target_score) : null),
          weekly_hours: Number(body.weekly_hours ?? 5), plan_json: plan, created_by: actor.id,
        }).select("*").single();
        if (saveError) throw new Error("Could not save your study plan.");
        return respond({ success: true, feature: action, provider: provider.provider, model, usage, plan: saved });
      }
      return respond({ success: true, feature: action, provider: provider.provider, model, usage, content, failover_used: failures.length > 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider request failed.";
      failures.push(provider.provider + ": " + message.slice(0, 180));
      await admin.from("ai_usage_logs").insert({
        user_profile_id: actor.id, feature: action, provider: provider.provider, model, success: false,
        error_message: message.slice(0, 500), latency_ms: Date.now() - started,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
  return respond({ error: "All enabled AI providers failed. " + failures.join(" | ") }, 503);
});
