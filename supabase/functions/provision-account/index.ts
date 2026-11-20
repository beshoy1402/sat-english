import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!url || !serviceKey || !authHeader) return new Response(JSON.stringify({ error: "Server configuration or authorization missing" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const { data: actor, error: actorError } = await admin.from("profiles").select("id,role,is_active").eq("id", userData.user.id).single();
  if (actorError || !actor?.is_active) return new Response(JSON.stringify({ error: "Account is not active" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

  let body: { username?: string; display_name?: string; password?: string; role?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

  const username = (body.username ?? "").trim().toLowerCase();
  const displayName = (body.display_name ?? "").trim();
  const password = body.password ?? "";
  const role = body.role ?? "";
  const allowedRoles = ["student", "teacher", "assistant", "developer", "designer", "parent"];
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username) || !displayName || password.length < 12 || !allowedRoles.includes(role)) {
    return new Response(JSON.stringify({ error: "Use a 3–30 character username, a display name, a password of at least 12 characters, and a valid role." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
  if (!["admin", "developer"].includes(actor.role) && !(actor.role === "assistant" && role === "student")) {
    return new Response(JSON.stringify({ error: "You do not have permission to create this role." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const email = username + "@accounts.northstar.invalid";
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: displayName },
    app_metadata: { role },
  });
  if (createError || !created.user) return new Response(JSON.stringify({ error: createError?.message ?? "Account creation failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  const { error: profileError } = await admin.from("profiles").update({ username, display_name: displayName, role }).eq("id", created.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return new Response(JSON.stringify({ error: "Profile setup failed; account creation was rolled back." }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  await admin.from("audit_events").insert({ actor_profile_id: actor.id, action: "account.created", entity_type: "profile", entity_id: created.user.id, after_data: { username, display_name: displayName, role } });
  return new Response(JSON.stringify({ user: { id: created.user.id, username, display_name: displayName, role }, login_hint: username }), { status: 201, headers: { ...cors, "Content-Type": "application/json" } });
});