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
    return respond({ error: "Only active Admin, Teacher, or Assistant accounts can delete accounts." }, 403);
  }

  let body: { user_id?: string };
  try { body = await req.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const userId = body.user_id ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return respond({ error: "A valid account ID is required." }, 400);
  if (userId === actor.id) return respond({ error: "You cannot delete your own account." }, 403);

  const { data: target, error: targetError } = await service.from("profiles").select("id,username,display_name,role").eq("id", userId).maybeSingle();
  if (targetError || !target) return respond({ error: "Account not found." }, 404);
  if (["admin", "developer", "designer"].includes(target.role)) return respond({ error: "Admin, Developer, and Designer accounts are protected from deletion." }, 403);
  const { error: auditError } = await service.from("audit_events").insert({
    actor_profile_id: actor.id, action: "account.deleted", entity_type: "profile", entity_id: target.id,
    before_data: { username: target.username, display_name: target.display_name, role: target.role },
  });
  if (auditError) return respond({ error: "Could not record the deletion audit event. No account was deleted." }, 500);
  const { error: deleteError } = await service.auth.admin.deleteUser(userId);
  if (deleteError) return respond({ error: deleteError.message }, 400);
  return respond({ deleted: true, username: target.username });
});
