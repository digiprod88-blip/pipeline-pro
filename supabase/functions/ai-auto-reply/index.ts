import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { contact_id, incoming_message, user_id } = await req.json();
    if (!contact_id || !incoming_message || !user_id) {
      throw new Error("contact_id, incoming_message, and user_id are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if AI Staff is enabled for this user
    const { data: aiConn } = await supabase
      .from("integration_connections")
      .select("is_connected")
      .eq("user_id", user_id)
      .eq("integration_id", "ai_staff")
      .maybeSingle();

    if (!aiConn?.is_connected) {
      return new Response(JSON.stringify({ skipped: true, reason: "AI Staff disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent conversation context
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("direction, content, channel")
      .eq("contact_id", contact_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const context = (recentMessages ?? []).reverse().map(
      (m) => `${m.direction === "inbound" ? "Customer" : "Agent"}: ${m.content}`
    ).join("\n");

    // Fetch contact info
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name, company, tags, notes")
      .eq("id", contact_id)
      .single();

    const contactContext = contact
      ? `Customer: ${contact.first_name} ${contact.last_name || ""}, Company: ${contact.company || "N/A"}, Notes: ${contact.notes || "None"}`
      : "";

    // Generate AI response
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant for a CRM. Reply professionally and helpfully to customer WhatsApp messages. Keep replies concise (under 150 words). Be warm and personable.\n\nCustomer Info: ${contactContext}`,
          },
          {
            role: "user",
            content: `Conversation so far:\n${context}\n\nLatest message from customer: ${incoming_message}\n\nGenerate a helpful reply:`,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) throw new Error(`AI API error: ${await aiRes.text()}`);

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content?.trim() || "";

    if (!reply) throw new Error("Empty AI response");

    // Store the AI reply as an outbound message
    await supabase.from("messages").insert({
      contact_id,
      user_id,
      channel: "whatsapp",
      direction: "outbound",
      content: reply,
      metadata: { ai_generated: true },
    });

    // Log activity
    await supabase.from("activities").insert({
      contact_id,
      user_id,
      type: "ai_reply",
      description: `AI Staff auto-replied: "${reply.slice(0, 80)}..."`,
    });

    return new Response(JSON.stringify({ reply, ai_generated: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
