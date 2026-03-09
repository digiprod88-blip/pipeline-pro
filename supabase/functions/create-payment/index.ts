import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gateway, amount, currency, product_id, product_name, customer_email, customer_name, order_id } = await req.json();

    if (gateway === "razorpay") {
      const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
      const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        return new Response(
          JSON.stringify({ error: "Razorpay not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create Razorpay order
      const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Razorpay uses paise
          currency: currency || "INR",
          receipt: order_id,
          notes: {
            product_id,
            product_name,
          },
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error?.description || "Failed to create Razorpay order");
      }

      return new Response(
        JSON.stringify({
          gateway: "razorpay",
          order_id: orderData.id,
          amount: orderData.amount,
          currency: orderData.currency,
          key_id: RAZORPAY_KEY_ID,
        }),
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

      // Create Stripe PaymentIntent
      const params = new URLSearchParams();
      params.append("amount", String(Math.round(amount * 100)));
      params.append("currency", (currency || "usd").toLowerCase());
      params.append("automatic_payment_methods[enabled]", "true");
      params.append("metadata[product_id]", product_id || "");
      params.append("metadata[product_name]", product_name || "");
      params.append("metadata[order_id]", order_id || "");
      if (customer_email) params.append("receipt_email", customer_email);

      const intentResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        },
        body: params.toString(),
      });

      const intentData = await intentResponse.json();

      if (!intentResponse.ok) {
        throw new Error(intentData.error?.message || "Failed to create Stripe PaymentIntent");
      }

      return new Response(
        JSON.stringify({
          gateway: "stripe",
          client_secret: intentData.client_secret,
          payment_intent_id: intentData.id,
          amount: intentData.amount,
          currency: intentData.currency,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid gateway specified" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
