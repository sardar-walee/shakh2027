import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  postId?: unknown;
  paymentReference?: unknown;
};

type ProviderVerification = {
  status?: unknown;
  reference?: unknown;
  amount?: unknown;
  currency?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const providerVerifyUrl = Deno.env.get("PAYMENT_PROVIDER_VERIFY_URL");
  const providerSecret = Deno.env.get("PAYMENT_PROVIDER_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !providerVerifyUrl || !providerSecret) {
    return response({ error: "payment_verification_not_configured" }, 503);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return response({ error: "authentication_required" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "authentication_required" }, 401);

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return response({ error: "invalid_request" }, 400);
  }

  const postId = text(body.postId);
  const paymentReference = text(body.paymentReference);
  if (!/^[0-9a-f-]{36}$/i.test(postId) || paymentReference.length < 4 || paymentReference.length > 200) {
    return response({ error: "invalid_payment_request" }, 400);
  }

  const { data: post, error: postError } = await admin
    .from("posts")
    .select("id,owner_id,category,price,status,listing_fee,listing_fee_paid,payment_status")
    .eq("id", postId)
    .maybeSingle();
  if (postError || !post) return response({ error: "post_not_found" }, 404);
  if (post.owner_id !== authData.user.id) return response({ error: "ownership_mismatch" }, 403);
  if (post.category !== "car_dealer" || post.status !== "pending_payment" || post.listing_fee_paid || post.payment_status !== "pending") {
    return response({ error: "post_not_eligible_for_payment" }, 409);
  }

  const { data: settings } = await admin
    .from("platform_settings")
    .select("car_listing_fee_min,car_listing_fee_percent,platform_commission_percent,currency")
    .eq("id", true)
    .maybeSingle();
  const price = numberValue(post.price);
  const minimumFee = numberValue(settings?.car_listing_fee_min) ?? 25000;
  const feePercent = numberValue(settings?.car_listing_fee_percent) ?? numberValue(settings?.platform_commission_percent) ?? 3;
  if (price === null || price < 0) return response({ error: "invalid_listing_amount" }, 422);
  const expectedAmount = Math.max(minimumFee, Math.round(price * feePercent / 100));
  const currency = text(settings?.currency) || "IQD";

  const { data: attempt, error: attemptError } = await admin
    .from("car_listing_payment_attempts")
    .insert({
      post_id: postId,
      customer_id: authData.user.id,
      payment_reference: paymentReference,
      expected_amount: expectedAmount,
      currency,
      status: "pending",
    })
    .select("id")
    .single();
  if (attemptError || !attempt) return response({ error: "duplicate_or_invalid_payment_reference" }, 409);

  let providerResult: ProviderVerification;
  let providerHttpStatus = 200;
  try {
    const providerResponse = await fetch(providerVerifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerSecret}`,
      },
      body: JSON.stringify({ reference: paymentReference, amount: expectedAmount, currency }),
    });
    providerHttpStatus = providerResponse.status;
    providerResult = (await providerResponse.json()) as ProviderVerification;
  } catch {
    providerResult = { status: "provider_unreachable" };
    providerHttpStatus = 502;
  }

  const providerStatus = text(providerResult.status).toLowerCase();
  const providerReference = text(providerResult.reference);
  const providerAmount = numberValue(providerResult.amount);
  const providerCurrency = text(providerResult.currency);
  const verified = providerHttpStatus >= 200 && providerHttpStatus < 300
    && ["approved", "paid", "verified", "completed"].includes(providerStatus)
    && providerReference === paymentReference
    && providerAmount === expectedAmount
    && providerCurrency.toUpperCase() === currency.toUpperCase();

  const { data: resolution, error: resolutionError } = await admin.rpc("resolve_car_listing_payment", {
    p_attempt_id: attempt.id,
    p_provider_reference: providerReference || null,
    p_provider_amount: providerAmount,
    p_provider_currency: providerCurrency || null,
    p_provider_status: providerStatus || "unknown",
    p_provider_payload: { status: providerStatus, reference: providerReference, amount: providerAmount, currency: providerCurrency },
    p_verified: verified,
  });
  if (resolutionError) return response({ error: "payment_resolution_failed" }, 502);
  if (!verified || resolution?.verified !== true) return response({ error: "payment_not_verified" }, 402);

  return response({ verified: true, status: "pending_review", postId });
});
