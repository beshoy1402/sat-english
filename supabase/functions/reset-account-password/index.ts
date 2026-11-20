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

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.replace(/^Bearer\\s+/i, "");
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "Invalid session" }, 401);
  const { data: actor, error: actorError } = await admin.from("profiles")
    .select("id,role,is_active").eq("id", authData.user.id).single();
  if (actorError || !actor?.is_active || !["admin", "developer"].includes(actor.role)) {
    return respond({ error: "Only active Admin or Developer accounts can reset passwords." }, 403);
  }

  let body: { user_id?: string; new_password?: string };
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const userId = body.user_id ?? "";
  const password = body.new_password ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return respond({ error: "A valid account ID is required." }, 400);
  }
  if (password.length < 16 || password.length > 128) return respond({ error: "The generated temporary password must contain 16–128 characters." }, 400);
  if (userId === actor.id) return respond({ error: "Use your own account security settings to change your password." }, 400);

  const { data: target, error: targetError } = await admin.from("profiles")
    .select("id,username,role").eq("id", userId).maybeSingle();
  if (targetError || !target) return respond({ error: "Target account was not found." }, 404);
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateError) return respond({ error: "Supabase could not update this account password." }, 400);

  const { error: auditError } = await admin.from("audit_events").insert({
    actor_profile_id: actor.id, action: "account.password_reset", entity_type: "profile", entity_id: userId,
    after_data: { username: target.username, role: target.role, reset_by_role: actor.role },
  });
  return respond({ success: true, audit_warning: auditError ? "Password was changed, but the audit event could not be recorded." : null, user: { id: target.id, username: target.username, role: target.role } });
});
