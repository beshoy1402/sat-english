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
  nvidia: "nvidia/nemotron-3.5-super-vl-120b-a12b",
  gemini: "gemini-2.5-flash",
  groq: "openai/gpt-oss-120b",
  deepseek: "deepseek-chat",
  openrouter: "openrouter/free",
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

  let body: { action?: string; messages?: ChatMessage[]; submission_id?: string; exam_program?: string; target_date?: string; current_score?: number; target_score?: number; weekly_hours?: number; weak_topics?: string[]; topic?: string; difficulty?: string; question_count?: number; include_answer_key?: boolean; include_passage?: boolean };
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON request." }, 400); }
  const action = body.action;
  if (action !== "tutor" && action !== "homework_review" && action !== "study_plan" && action !== "worksheet") return respond({ error: "Unsupported AI action." }, 400);

  if ((action === "tutor" || action === "study_plan") && actor.role !== "student") return respond({ error: "This learning feature is available to student accounts." }, 403);
  if ((action === "homework_review" || action === "worksheet") && !["admin", "teacher", "assistant"].includes(actor.role)) return respond({ error: "Only teaching staff can use these AI teaching tools." }, 403);

  const { count: recentCount, error: rateError } = await admin.from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_profile_id", actor.id)
    .eq("success", true)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (rateError) return respond({ error: "AI usage limits could not be checked safely. Please try again later." }, 503);
  const hourlyLimit = action === "homework_review" ? 20 : action === "worksheet" ? 12 : action === "study_plan" ? 8 : 50;
  if ((recentCount ?? 0) >= hourlyLimit) return respond({ error: "You've reached the hourly AI request limit. Only successful AI actions count toward this limit. Please try again when an earlier successful request expires." , limit: hourlyLimit, used: recentCount ?? 0, remaining: 0, window_minutes: 60 }, 429);

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
  } else if (action === "worksheet") {
    const program = String(body.exam_program ?? "");
    const topic = String(body.topic ?? "").trim().slice(0, 160);
    const difficulty = ["easy", "medium", "hard", "mixed"].includes(String(body.difficulty)) ? String(body.difficulty) : "mixed";
    const count = Math.max(5, Math.min(20, Number(body.question_count ?? 10) || 10));
    if (!["SAT English", "EST English", "ACT English"].includes(program) || topic.length < 2) return respond({ error: "Choose a valid exam program and enter a topic." }, 400);
    messages = [{ role: "user", content: [
      "Create an original, classroom-ready English exam practice worksheet.",
      "Exam program: " + program,
      "Skill/topic: " + topic,
      "Difficulty: " + difficulty,
      "Question count: exactly " + count,
      "Include a short original reading passage: " + (body.include_passage ? "yes, if it fits the topic" : "no, unless essential"),
      "Include answer key: " + (body.include_answer_key === false ? "no" : "yes"),
      "Write original questions; do not reproduce copyrighted test questions. Use plausible distractors and one defensible correct answer. Align the style and skill with the selected exam program without claiming official status.",
      "Return strict JSON only with keys title, instructions, passage (string or null), questions (array of objects with prompt, choices array of 4 strings, answer as A/B/C/D, explanation, difficulty). Make the number of questions exactly " + count + ". " + (body.include_answer_key === false ? "Do not include answers or explanations; use empty strings for answer and explanation." : "Include the correct answer and a concise explanation for each question."),
    ].join("\\n\\n") }];
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
    ? "You are a patient, precise SAT English learning coach. Stay strictly within SAT English study. When a student submits an answer or an attempt, evaluate it carefully against the question and supplied answer key when available. Clearly state whether the answer is correct, identify the exact mistake, explain the underlying grammar/reading/rhetorical concept, show a reliable step-by-step method to solve it, and demonstrate how to improve the student's answer or reasoning. If the student's answer is already correct, explain what they did well and how to make the reasoning more efficient. Never invent an answer key or claim certainty when the question is incomplete or ambiguous; ask for the missing question, choices, or passage. Use encouraging, specific feedback and finish with one short practice prompt when useful. Do not simply give away answers when a hint would teach better. Do not answer unrelated questions."
    : action === "study_plan"
      ? "You are an expert English exam-preparation coach. Create achievable, structured plans with spaced review, skill practice and timed checkpoints. Return strict JSON only."
      : action === "worksheet"
        ? "You are an expert SAT, EST and ACT English teacher. Produce accurate, original, age-appropriate practice material. Check every question and answer for ambiguity. Return strict JSON only."
        : "You are an assistant teacher preparing a draft review of English homework. Evaluate only the response and assignment instructions supplied. Never invent rubric criteria. Give constructive feedback. Return strict JSON only.";

  const { data: configs, error: configError } = await admin.rpc("ai_provider_config_list");
  if (configError) return respond({ error: "AI provider configuration is unavailable. Check Developer → AI providers." }, 503);
  // Zero-cost mode is an allowlist, not a preference. Never call an arbitrary enabled
  // provider or a metered model just because it appears earlier in the provider list.
  const isApprovedFreeProvider = (provider: ProviderRow) => {
    try {
      const parsed = new URL(provider.base_url);
      const path = parsed.pathname.endsWith("/") ? parsed.pathname.slice(0, -1) : parsed.pathname;
      if (provider.provider === "gemini") {
        return parsed.origin === "https://generativelanguage.googleapis.com"
          && path === "/v1beta"
          && provider.model === "gemini-3.8-flash";
      }
      if (provider.provider === "groq") {
        return parsed.origin === "https://api.groq.com"
          && path === "/openai/v1"
          && provider.model === "openai/gpt-oss-120b";
      }
      if (provider.provider === "openrouter") {
        return parsed.origin === "https://openrouter.ai"
          && path === "/api/v1"
          && provider.model === "openrouter/free";
      }
      return false;
    } catch {
      return false;
    }
  };
  const enabled = ((configs ?? []) as ProviderRow[])
    .filter(p => p.is_enabled && p.key_configured && isApprovedFreeProvider(p))
    .sort((a,b)=>a.priority-b.priority);
  if (!enabled.length) return respond({
    error: "AI is paused by the zero-cost safety policy. Configure Gemini 3.8 Flash on a Google AI Studio Free Tier project with billing disabled, OpenRouter Free, or the approved Groq GPT-OSS 120B free tier."
  }, 503);

  const pointCost = action === "tutor" ? 5 : action === "study_plan" ? 15 : 0;
  const pointRequestId = crypto.randomUUID();
  let pointsRemaining: number | null = null;
  if (pointCost > 0) {
    const { data: pointResult, error: pointError } = await admin.rpc("student_ai_points_consume", {
      p_student_profile_id: actor.id, p_points: pointCost, p_feature: action, p_request_id: pointRequestId,
    });
    if (pointError) return respond({ error: "AI points could not be checked safely. Please try again later." }, 503);
    if (!pointResult?.success) return respond({
      error: "You have used all your AI study points. Ask your teacher or administrator for more points.",
      ai_points: { remaining: Number(pointResult?.remaining ?? 0), cost: pointCost },
    }, 429);
    pointsRemaining = Number(pointResult.remaining);
  }

  const refundReservedPoints = async () => {
    if (pointCost <= 0) return { remaining: pointsRemaining, refunded: false };
    const { data, error } = await admin.rpc("student_ai_points_refund", {
      p_student_profile_id: actor.id, p_points: pointCost, p_feature: action, p_request_id: pointRequestId,
    });
    if (error) {
      console.error("AI point refund failed", error.message);
      return { remaining: pointsRemaining, refunded: false };
    }
    return { remaining: Number(data?.remaining ?? pointsRemaining ?? 0), refunded: Boolean(data?.success) };
  };

  const failures: string[] = [];
  const quota = { limit: hourlyLimit, used: (recentCount ?? 0) + 1, remaining: Math.max(0, hourlyLimit - (recentCount ?? 0) - 1), window_minutes: 60 };
  for (const provider of enabled) {
    const started = Date.now();
    const { data: secret, error: secretError } = await admin.rpc("ai_provider_config_read_secret", { p_provider: provider.provider });
    if (secretError || !secret) { failures.push(provider.provider + ": missing credential"); continue; }
    let model = provider.model || defaultModels[provider.provider] || "";
    if (!model) { failures.push(provider.provider + ": model ID is required"); continue; }

    // OpenRouter's free router dynamically selects an available $0 model, avoiding
    // hard-coded free model IDs that may be withdrawn or moved behind paid access.
    if (provider.provider === "openrouter") model = "openrouter/free";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
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
          generationConfig: { temperature: action === "tutor" ? 0.35 : 0.15, maxOutputTokens: action === "worksheet" ? 4096 : 1400, ...(action !== "tutor" ? { responseMimeType: "application/json" } : {}) },
        };
      } else if (provider.provider === "anthropic") {
        endpoint = provider.base_url.replace(/\/$/,"") + "/messages";
        headers["x-api-key"] = secret;
        headers["anthropic-version"] = "2023-06-01";
        requestBody = { model, max_tokens: action === "worksheet" ? 4096 : 1400, system, messages: messages.map(m => ({ role: m.role, content: m.content })), temperature: action === "tutor" ? 0.35 : 0.15 };
      } else {
        endpoint = provider.base_url.replace(/\/$/,"") + "/chat/completions";
        headers.Authorization = "Bearer " + secret;
        requestBody = { model, messages: [{ role: "system", content: system }, ...messages], temperature: action === "tutor" ? 0.35 : 0.15, max_tokens: action === "worksheet" ? 4096 : 2048, ...(action !== "tutor" ? { response_format: { type: "json_object" } } : {}),  };
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
      const recordSuccess = async () => {
        await admin.from("ai_usage_logs").insert({
          user_profile_id: actor.id, feature: action, provider: provider.provider, model, success: true,
          latency_ms: latency, prompt_tokens: usage.prompt, completion_tokens: usage.completion,
          estimated_cost_usd: null,
        });
      };

      if (action === "homework_review") {
        let draft;
        try { draft = homeworkJson(content); } catch { throw new Error("AI response could not be parsed as a review draft."); }
        const { data: saved, error: saveError } = await admin.from("ai_homework_review_drafts").upsert({
          submission_id: submission.id, ...draft, provider: provider.provider, model, generated_by: actor.id,
        }, { onConflict: "submission_id" }).select("*").single();
        if (saveError) return respond({ error: "The AI review was generated, but the draft could not be saved. Please retry after the database issue is fixed." }, 500);
        await recordSuccess();
        return respond({ success: true, feature: action, provider: provider.provider, model, usage, rate_limit: quota, ai_points: pointCost ? { remaining: pointsRemaining, charged: pointCost } : null, draft: saved, requires_teacher_approval: true });
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
        if (saveError) {
          const refund = await refundReservedPoints();
          return respond({
            error: "The study plan was generated, but it could not be saved. Please retry after the database issue is fixed.",
            ai_points: { remaining: refund.remaining, refunded: refund.refunded },
          }, 500);
        }
        await recordSuccess();
        return respond({ success: true, feature: action, provider: provider.provider, model, usage, rate_limit: quota, ai_points: pointCost ? { remaining: pointsRemaining, charged: pointCost } : null, plan: saved });
      }
      if (action === "worksheet") {
        let worksheet: any;
        try {
          const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
          const value = JSON.parse(cleaned);
          const questions = Array.isArray(value.questions) ? value.questions.slice(0, 20).map((q: any) => ({
            prompt: String(q.prompt ?? "").slice(0, 1800),
            choices: Array.isArray(q.choices) ? q.choices.slice(0, 4).map((v: any) => String(v).slice(0, 500)) : [],
            answer: String(q.answer ?? "").slice(0, 10),
            explanation: String(q.explanation ?? "").slice(0, 1800),
            difficulty: String(q.difficulty ?? "mixed").slice(0, 20),
          })).filter((q: any) => q.prompt) : [];
          if (!questions.length) throw new Error("No questions were generated.");
          worksheet = { title: String(value.title ?? "English Practice Worksheet").slice(0, 180), instructions: String(value.instructions ?? "Choose the best answer for each question.").slice(0, 1000), passage: value.passage ? String(value.passage).slice(0, 7000) : null, questions };
        } catch { throw new Error("AI response could not be parsed as a worksheet. Please try again."); }
        await recordSuccess();
        return respond({ success: true, feature: action, provider: provider.provider, model, usage, rate_limit: quota, worksheet, failover_used: failures.length > 0, requires_teacher_review: true });
      }
      await recordSuccess();
      return respond({ success: true, feature: action, provider: provider.provider, model, usage, rate_limit: quota, ai_points: pointCost ? { remaining: pointsRemaining, charged: pointCost } : null, content, failover_used: failures.length > 0 });
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
  const refund = await refundReservedPoints();
  return respond({ error: "All enabled AI providers failed. " + failures.join(" | "), ai_points: pointCost ? { remaining: refund.remaining, refunded: refund.refunded } : null }, 503);
});
