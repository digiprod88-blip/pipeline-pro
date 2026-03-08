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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { referral_id } = await req.json();
    if (!referral_id) throw new Error("referral_id required");

    // Get referral details
    const { data: referral, error: refErr } = await supabase
      .from("referrals")
      .select("*, referrer:contacts!referrals_referrer_contact_id_fkey(first_name, email)")
      .eq("id", referral_id)
      .single();
    if (refErr) throw refErr;

    // Update referral status to converted
    await supabase
      .from("referrals")
      .update({ status: "converted", converted_at: new Date().toISOString(), reward_credits: 10 })
      .eq("id", referral_id);

    // Create notification for the referrer's owner
    const { data: contact } = await supabase
      .from("contacts")
      .select("user_id")
      .eq("id", referral.referrer_contact_id)
      .single();

    if (contact) {
      await supabase.from("notifications").insert({
        user_id: contact.user_id,
        title: "🎉 Referral Converted!",
        message: `${referral.referred_name || "Someone"} referred by ${referral.referrer?.first_name || "a client"} has converted! 10 reward credits added.`,
        type: "referral",
        link: "/portal",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Referral notify error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
