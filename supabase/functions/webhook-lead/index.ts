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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const webhookKey = url.searchParams.get("key");

    if (!webhookKey) {
      return new Response(JSON.stringify({ error: "Missing webhook key. Pass ?key=YOUR_KEY" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate webhook key
    const { data: webhook, error: webhookError } = await supabase
      .from("webhook_keys")
      .select("*, pipelines(id), pipeline_stages(id)")
      .eq("key", webhookKey)
      .eq("is_active", true)
      .single();

    if (webhookError || !webhook) {
      return new Response(JSON.stringify({ error: "Invalid or inactive webhook key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // ── Omni-channel: detect inbound messages from WhatsApp/Messenger webhooks ──
    const isWhatsAppInbound = body.entry?.[0]?.changes?.[0]?.value?.messages;
    const isMessengerInbound = body.entry?.[0]?.messaging;

    let name = body.name;
    let first_name = body.first_name;
    let last_name = body.last_name;
    let email = body.email;
    let phone = body.phone;
    let source = body.source;
    let company = body.company;
    let value = body.value;
    let inboundMessage = "";

    if (isWhatsAppInbound) {
      const msg = body.entry[0].changes[0].value.messages[0];
      const contact = body.entry[0].changes[0].value.contacts?.[0];
      phone = msg.from;
      name = contact?.profile?.name || phone;
      source = "whatsapp";
      inboundMessage = msg.text?.body || msg.type || "";
    } else if (isMessengerInbound) {
      const msg = body.entry[0].messaging[0];
      name = msg.sender?.id || "Messenger User";
      source = "messenger";
      inboundMessage = msg.message?.text || "";
    }

    const contactFirstName = first_name || name?.split(" ")[0] || "Unknown";
    const contactLastName = last_name || (name?.split(" ").slice(1).join(" ") || null);

    // Get first stage of the pipeline
    let stageId = webhook.stage_id;
    if (!stageId && webhook.pipeline_id) {
      const { data: firstStage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", webhook.pipeline_id)
        .order("position", { ascending: true })
        .limit(1)
        .single();
      stageId = firstStage?.id || null;
    }

    // Create the contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        user_id: webhook.user_id,
        first_name: contactFirstName,
        last_name: contactLastName,
        email: email || null,
        phone: phone || null,
        company: company || null,
        source: source || "webhook",
        value: value ? parseFloat(value) : 0,
        pipeline_id: webhook.pipeline_id,
        stage_id: stageId,
      })
      .select()
      .single();

    if (contactError) {
      throw new Error(`Failed to create contact: ${contactError.message}`);
    }

    // Log activity
    await supabase.from("activities").insert({
      user_id: webhook.user_id,
      contact_id: contact.id,
      type: "webhook",
      description: `Lead captured via webhook "${webhook.name}"${inboundMessage ? ` — "${inboundMessage}"` : ""}`,
      metadata: { source: source || "webhook", webhook_name: webhook.name },
    });

    // If there's an inbound message, also log it to messages table
    if (inboundMessage) {
      await supabase.from("messages").insert({
        user_id: webhook.user_id,
        contact_id: contact.id,
        channel: source || "whatsapp",
        direction: "inbound",
        content: inboundMessage,
        metadata: { auto_created: true, webhook_name: webhook.name },
      });
    }

    // Notify admin
    await supabase.from("notifications").insert({
      user_id: webhook.user_id,
      title: "🔔 New Lead Captured",
      message: `${contactFirstName} ${contactLastName || ""} from ${source || "webhook"}${inboundMessage ? `: "${inboundMessage.slice(0, 100)}"` : ""}`,
      type: "info",
      link: `/contacts/${contact.id}`,
    });

    // ── Trigger active workflows with "new_lead" or "webhook" trigger ──
    const { data: workflows } = await supabase
      .from("workflows")
      .select("id, trigger_type")
      .eq("user_id", webhook.user_id)
      .eq("is_active", true)
      .in("trigger_type", ["new_lead", "webhook"]);

    if (workflows && workflows.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      for (const wf of workflows) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/workflow-executor`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              workflow_id: wf.id,
              contact_id: contact.id,
              trigger_type: wf.trigger_type,
            }),
          });
        } catch (e) {
          console.error(`Failed to trigger workflow ${wf.id}:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, contact_id: contact.id }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
