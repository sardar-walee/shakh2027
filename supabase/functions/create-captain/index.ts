import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  phone?: unknown;
  kind?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_not_configured" }, 503);

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "authentication_required" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "authentication_required" }, 401);

  const { data: callerProfile, error: callerError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (callerError || !callerProfile || !["admin", "super_admin"].includes(callerProfile.role)) {
    return json({ error: "captain_creation_not_authorized" }, 403);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const email = text(body.email).toLowerCase();
  const password = text(body.password);
  const fullName = text(body.fullName);
  const phone = text(body.phone);
  const kind = text(body.kind);
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || fullName.length < 2 || !["merchant", "shakh"].includes(kind)) {
    return json({ error: "invalid_captain_data" }, 422);
  }
  if (kind === "shakh" && callerProfile.role !== "super_admin") {
    return json({ error: "shakh_captain_requires_super_admin" }, 403);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: fullName, phone, captain_kind: kind },
  });
  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes("already") || createError?.code === "email_exists";
    return json({ error: duplicate ? "captain_email_already_exists" : "captain_creation_failed" }, duplicate ? 409 : 400);
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: created.user.id,
    full_name: fullName,
    phone: phone || null,
    role: "captain",
    captain_kind: kind,
    captain_owner_id: kind === "merchant" ? authData.user.id : null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "captain_profile_creation_failed" }, 500);
  }

  return json({
    success: true,
    captain: { id: created.user.id, email, fullName, kind, role: "captain" },
  });
});
