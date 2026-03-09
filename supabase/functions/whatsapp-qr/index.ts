import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();

    if (action === "generate") {
      // Generate a unique session ID and QR code data
      const sessionId = crypto.randomUUID();
      const qrData = `wa://link/${sessionId}`;
      
      // Create or update session record
      const { error: upsertError } = await supabase
        .from("whatsapp_sessions")
        .upsert({
          user_id: user.id,
          session_status: "pending",
          session_data: { sessionId, qrData, generatedAt: new Date().toISOString() },
        }, {
          onConflict: "user_id",
        });

      if (upsertError) {
        throw upsertError;
      }

      // In production, this would integrate with WhatsApp Business API or a service like Baileys
      // For now, we simulate the QR code generation
      const qrCodeBase64 = generateQRCodePlaceholder(qrData);

      // Simulate connection after 10 seconds (for demo purposes)
      // In production, this would be handled by the WhatsApp callback
      setTimeout(async () => {
        const serviceClient = createClient(
          supabaseUrl,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        
        await serviceClient
          .from("whatsapp_sessions")
          .update({
            session_status: "connected",
            phone_number: "+1 (555) 123-4567", // Would come from WhatsApp
            last_sync_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }, 10000);

      return new Response(
        JSON.stringify({
          success: true,
          qr_code: qrCodeBase64,
          session_id: sessionId,
          expires_in: 120, // seconds
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { data: session } = await supabase
        .from("whatsapp_sessions")
        .select("session_status, phone_number, last_sync_at")
        .eq("user_id", user.id)
        .single();

      return new Response(
        JSON.stringify({ success: true, session }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      await supabase
        .from("whatsapp_sessions")
        .update({
          session_status: "disconnected",
          phone_number: null,
          session_data: {},
        })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WhatsApp QR Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateQRCodePlaceholder(data: string): string {
  // In production, use a proper QR code library
  // This returns a placeholder for demo
  return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><rect x="20" y="20" width="40" height="40"/><rect x="140" y="20" width="40" height="40"/><rect x="20" y="140" width="40" height="40"/><rect x="80" y="80" width="40" height="40"/></svg>`)}`;
}
