import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { event, contact_id, user_email, course_name, course_id, progress_percent, certificate_url } = body;

    // Resolve contact_id from user_email if not provided
    let resolvedContactId = contact_id;
    if (!resolvedContactId && user_email) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", user_email)
        .maybeSingle();
      if (contact) {
        resolvedContactId = contact.id;
      } else {
        return new Response(JSON.stringify({ error: "No contact found for email: " + user_email }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!resolvedContactId || !course_name) {
      return new Response(JSON.stringify({ error: "contact_id (or user_email) and course_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get contact owner for notifications
    const { data: contactData } = await supabase
      .from("contacts")
      .select("user_id, lead_score, first_name, last_name")
      .eq("id", resolvedContactId)
      .single();

    if (event === "course_purchased" || event === "course_enrolled") {
      const { data: enrollment, error } = await supabase.from("lms_enrollments").insert({
        contact_id: resolvedContactId, course_name, course_id: course_id || null, status: "enrolled",
      }).select().single();
      if (error) throw error;

      // Boost lead score by 50
      if (contactData) {
        await supabase.from("contacts")
          .update({ lead_score: (contactData.lead_score || 0) + 50 })
          .eq("id", resolvedContactId);

        // Log activity
        await supabase.from("activities").insert({
          user_id: contactData.user_id, contact_id: resolvedContactId, type: "lms_enrollment",
          description: `Enrolled in course: ${course_name}`,
        });

        // Notify admin
        await supabase.from("notifications").insert({
          user_id: contactData.user_id,
          title: "📚 New LMS Enrollment",
          message: `${contactData.first_name || ""} ${contactData.last_name || ""} enrolled in "${course_name}". Lead score +50.`,
          type: "info",
          link: `/contacts/${resolvedContactId}`,
        });
      }

      return new Response(JSON.stringify({ success: true, enrollment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "lesson_completed") {
      const { error } = await supabase.from("lms_enrollments")
        .update({ progress_percent: progress_percent || 0, updated_at: new Date().toISOString() })
        .eq("contact_id", resolvedContactId)
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
        .eq("contact_id", resolvedContactId)
        .eq("course_name", course_name);
      if (error) throw error;

      // +25 score for completion
      if (contactData) {
        await supabase.from("contacts")
          .update({ lead_score: (contactData.lead_score || 0) + 25 })
          .eq("id", resolvedContactId);

        // Notify admin
        await supabase.from("notifications").insert({
          user_id: contactData.user_id,
          title: "🎓 Course Completed!",
          message: `${contactData.first_name || ""} ${contactData.last_name || ""} completed "${course_name}". Lead score +25.`,
          type: "info",
          link: `/contacts/${resolvedContactId}`,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown event type. Supported: course_purchased, course_enrolled, lesson_completed, course_completed" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
