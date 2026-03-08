import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────────
// Production API Configuration
// Set these secrets for real delivery:
//   META_WHATSAPP_TOKEN    – WhatsApp Business API token
//   META_WHATSAPP_PHONE_ID – WhatsApp Business phone number ID
//   META_GRAPH_API_VERSION  – e.g., "v18.0"
// ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) throw new Error("Unauthorized");
    const userId = claims.claims.sub as string;

    const { segment_id, template_content, contact_ids, channel } = await req.json();
    if (!segment_id || !template_content || !contact_ids?.length) {
      throw new Error("segment_id, template_content, and contact_ids are required");
    }

    // Check for Meta WhatsApp Business API credentials
    const metaToken = Deno.env.get("META_WHATSAPP_TOKEN");
    const metaPhoneId = Deno.env.get("META_WHATSAPP_PHONE_ID");
    const metaApiVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v18.0";
    const useRealApi = !!(metaToken && metaPhoneId && channel === "whatsapp");

    // Create segment message record
    const { data: msgRecord, error: insertErr } = await serviceClient
      .from("segment_messages")
      .insert({
        segment_id,
        user_id: userId,
        channel: channel || "whatsapp",
        template_content,
        total_contacts: contact_ids.length,
        status: "processing",
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    let sentCount = 0;
    let failedCount = 0;

    for (const contactId of contact_ids) {
      try {
        const { data: contact } = await serviceClient
          .from("contacts")
          .select("first_name, phone, email")
          .eq("id", contactId)
          .single();

        if (!contact?.phone && channel === "whatsapp") {
          failedCount++;
          continue;
        }
        if (!contact?.email && channel === "email") {
          failedCount++;
          continue;
        }

        // Personalize message
        const personalizedMsg = template_content
          .replace(/\{\{name\}\}/g, contact.first_name || "there")
          .replace(/\{\{phone\}\}/g, contact.phone || "")
          .replace(/\{\{email\}\}/g, contact.email || "");

        // Real WhatsApp Business API delivery
        if (useRealApi) {
          const phone = contact.phone!.replace(/[^0-9]/g, "");
          const waResponse = await fetch(
            `https://graph.facebook.com/${metaApiVersion}/${metaPhoneId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${metaToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: personalizedMsg },
              }),
            }
          );
          const waBody = await waResponse.text();
          if (!waResponse.ok) {
            console.error(`WhatsApp API error for ${phone}: ${waBody}`);
            failedCount++;
            continue;
          }
        }

        // Log as outbound message
        await serviceClient.from("messages").insert({
          contact_id: contactId,
          user_id: userId,
          channel: channel || "whatsapp",
          direction: "outbound",
          content: personalizedMsg,
          metadata: {
            segment_id,
            batch_id: msgRecord.id,
            delivery_mode: useRealApi ? "live" : "simulation",
          },
        });

        sentCount++;

        // Throttle: 200ms for real API, 50ms for simulation
        await new Promise((r) => setTimeout(r, useRealApi ? 200 : 50));
      } catch (e) {
        console.error("Message send error:", e);
        failedCount++;
      }
    }

    // Update final status
    await serviceClient
      .from("segment_messages")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", msgRecord.id);

    // Notify user
    await serviceClient.from("notifications").insert({
      user_id: userId,
      title: "📨 Segment Message Sent",
      message: `${sentCount} messages sent, ${failedCount} failed. Mode: ${useRealApi ? "Live" : "Simulation"}.`,
      type: "info",
      link: "/segments",
    });

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount, mode: useRealApi ? "live" : "simulation" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Segment message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
