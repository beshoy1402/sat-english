import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: authError } = await service.auth.getUser(token);
  if (authError || !userData.user) return respond({ error: "Invalid session" }, 401);
  const { data: actor, error: actorError } = await service.from("profiles").select("id,role,is_active").eq("id", userData.user.id).single();
  if (actorError || !actor?.is_active || !["admin", "teacher", "assistant"].includes(actor.role)) {
    return respond({ error: "Only active Admin, Teacher, or Assistant accounts can provision accounts." }, 403);
  }

  let body: { username?: string; display_name?: string; password?: string; role?: string };
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const username = (body.username ?? "").trim().toLowerCase();
  const displayName = (body.display_name ?? "").trim();
  const password = body.password ?? "";
  const role = body.role ?? "";
  const allowedRoles = ["student", "parent", "teacher", "assistant"];
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username) || !displayName || password.length < 8 || !allowedRoles.includes(role)) {
    return respond({ error: "Use a 3–30 character username, a display name, a password of at least 8 characters, and an allowed role." }, 400);
  }

  const email = username + "@accounts.northstar.invalid";
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: displayName }, app_metadata: { role },
  });
  if (createError || !created.user) return respond({ error: createError?.message ?? "Account creation failed" }, 400);
  const { error: profileError } = await service.from("profiles").update({ username, display_name: displayName, role }).eq("id", created.user.id);
  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    return respond({ error: "Profile setup failed; account creation was rolled back." }, 500);
  }
  const { error: auditError } = await service.from("audit_events").insert({
    actor_profile_id: actor.id, action: "account.created", entity_type: "profile", entity_id: created.user.id,
    after_data: { username, display_name: displayName, role },
  });
  if (auditError) {
    await service.auth.admin.deleteUser(created.user.id);
    return respond({ error: "Account creation was rolled back because its audit record could not be saved." }, 500);
  }
  return respond({ user: { id: created.user.id, username, display_name: displayName, role }, login_hint: username }, 201);
});
