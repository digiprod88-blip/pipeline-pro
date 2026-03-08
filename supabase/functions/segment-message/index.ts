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

    // Simulate throttled sending (in production, integrate WhatsApp Business API)
    let sentCount = 0;
    let failedCount = 0;

    for (const contactId of contact_ids) {
      try {
        // Get contact details
        const { data: contact } = await serviceClient
          .from("contacts")
          .select("first_name, phone, email")
          .eq("id", contactId)
          .single();

        if (!contact?.phone) {
          failedCount++;
          continue;
        }

        // Personalize message
        const personalizedMsg = template_content
          .replace("{{name}}", contact.first_name || "there")
          .replace("{{phone}}", contact.phone || "");

        // Log as outbound message
        await serviceClient.from("messages").insert({
          contact_id: contactId,
          user_id: userId,
          channel: channel || "whatsapp",
          direction: "outbound",
          content: personalizedMsg,
          metadata: { segment_id, batch_id: msgRecord.id },
        });

        sentCount++;

        // Throttle: 100ms delay between messages
        await new Promise((r) => setTimeout(r, 100));
      } catch {
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
      message: `${sentCount} messages sent, ${failedCount} failed from segment batch.`,
      type: "info",
      link: "/segments",
    });

    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Segment message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
