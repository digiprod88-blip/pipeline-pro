import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gateway, order_id, payment_id, signature, razorpay_order_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (gateway === "razorpay") {
      const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

      if (!RAZORPAY_KEY_SECRET) {
        return new Response(
          JSON.stringify({ error: "Razorpay not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify signature
      const crypto = await import("https://deno.land/std@0.168.0/crypto/mod.ts");
      const encoder = new TextEncoder();
      const data = encoder.encode(`${razorpay_order_id}|${payment_id}`);
      const key = encoder.encode(RAZORPAY_KEY_SECRET);
      
      const hmacKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const signatureBuffer = await crypto.subtle.sign("HMAC", hmacKey, data);
      const generatedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      if (generatedSignature !== signature) {
        return new Response(
          JSON.stringify({ error: "Invalid payment signature", verified: false }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update order status
      if (order_id) {
        await supabase
          .from("orders")
          .update({
            status: "paid",
            payment_id: payment_id,
            payment_method: "razorpay",
          })
          .eq("id", order_id);
      }

      return new Response(
        JSON.stringify({ verified: true, payment_id, gateway: "razorpay" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (gateway === "stripe") {
      const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

      if (!STRIPE_SECRET_KEY) {
        return new Response(
          JSON.stringify({ error: "Stripe not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Retrieve PaymentIntent to verify
      const intentResponse = await fetch(
        `https://api.stripe.com/v1/payment_intents/${payment_id}`,
        {
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          },
        }
      );

      const intentData = await intentResponse.json();

      if (!intentResponse.ok || intentData.status !== "succeeded") {
        return new Response(
          JSON.stringify({ error: "Payment not completed", verified: false }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update order status
      const metaOrderId = intentData.metadata?.order_id;
      if (metaOrderId) {
        await supabase
          .from("orders")
          .update({
            status: "paid",
            payment_id: payment_id,
            payment_method: "stripe",
          })
          .eq("id", metaOrderId);
      }

      return new Response(
        JSON.stringify({ verified: true, payment_id, gateway: "stripe" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid gateway" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Payment verification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
