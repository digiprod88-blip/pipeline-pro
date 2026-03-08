import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { event, contact_id, course_name, course_id, progress_percent, certificate_url } = body;

    if (!contact_id || !course_name) {
      return new Response(JSON.stringify({ error: "contact_id and course_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "course_purchased" || event === "course_enrolled") {
      // Create enrollment
      const { data: enrollment, error } = await supabase.from("lms_enrollments").insert({
        contact_id, course_name, course_id: course_id || null, status: "enrolled",
      }).select().single();
      if (error) throw error;

      // Boost lead score by 50
      const { data: contact } = await supabase.from("contacts").select("lead_score").eq("id", contact_id).single();
      if (contact) {
        await supabase.from("contacts").update({ lead_score: (contact.lead_score || 0) + 50 }).eq("id", contact_id);
      }

      // Log activity
      const { data: owners } = await supabase.from("contacts").select("user_id").eq("id", contact_id).single();
      if (owners) {
        await supabase.from("activities").insert({
          user_id: owners.user_id, contact_id, type: "lms_enrollment",
          description: `Enrolled in course: ${course_name}`,
        });
      }

      return new Response(JSON.stringify({ success: true, enrollment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "lesson_completed") {
      const { error } = await supabase.from("lms_enrollments")
        .update({ progress_percent: progress_percent || 0, updated_at: new Date().toISOString() })
        .eq("contact_id", contact_id)
        .eq("course_name", course_name);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "course_completed") {
      const { error } = await supabase.from("lms_enrollments")
        .update({
          status: "completed", progress_percent: 100,
          completed_at: new Date().toISOString(),
          certificate_url: certificate_url || null,
        })
        .eq("contact_id", contact_id)
        .eq("course_name", course_name);
      if (error) throw error;

      // Additional +25 score for completion
      const { data: contact } = await supabase.from("contacts").select("lead_score").eq("id", contact_id).single();
      if (contact) {
        await supabase.from("contacts").update({ lead_score: (contact.lead_score || 0) + 25 }).eq("id", contact_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown event type" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
