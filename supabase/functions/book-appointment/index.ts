import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, name, email, phone, notes, start_time, end_time, create_zoom } = await req.json();

    if (!user_id || !name || !email || !start_time || !end_time) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find or create contact
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || null;

    let contactId: string;

    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email)
      .eq("user_id", user_id)
      .maybeSingle();

    if (existing) {
      contactId = existing.id;
    } else {
      const { data: newContact, error: cErr } = await supabase
        .from("contacts")
        .insert({
          user_id,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          source: "booking",
          quality: "warm",
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      contactId = newContact.id;
      await supabase.rpc("calculate_lead_score", { _contact_id: contactId });
    }

    // Try to create Zoom meeting if requested
    let zoomLink: string | null = null;
    if (create_zoom) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const zoomRes = await fetch(`${supabaseUrl}/functions/v1/zoom-meeting`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            topic: `Meeting with ${name}`,
            start_time,
            duration: 30,
          }),
        });
        if (zoomRes.ok) {
          const zoomData = await zoomRes.json();
          zoomLink = zoomData.join_url || zoomData.zoom_link || null;
        }
      } catch (e) {
        console.error("Zoom meeting creation failed (non-fatal):", e);
      }
    }

    const location = zoomLink || "Online";

    // Create appointment
    const { error: apptErr } = await supabase.from("appointments").insert({
      user_id,
      contact_id: contactId,
      title: `Meeting with ${name}`,
      description: notes ? `${notes}${zoomLink ? `\n\nZoom: ${zoomLink}` : ""}` : (zoomLink ? `Zoom: ${zoomLink}` : null),
      start_time,
      end_time,
      location,
    });
    if (apptErr) throw apptErr;

    // Create a task for admin
    await supabase.from("tasks").insert({
      user_id,
      contact_id: contactId,
      title: `Prepare for meeting with ${name}`,
      description: `Booked via scheduling page. Email: ${email}${phone ? `, Phone: ${phone}` : ""}${notes ? `\nNotes: ${notes}` : ""}${zoomLink ? `\nZoom: ${zoomLink}` : ""}`,
      priority: "medium",
      due_date: start_time,
      visible_to_client: true,
    }).then(r => { if (r.error) console.error("Task error:", r.error); });

    // Log activity
    await supabase.from("activities").insert({
      user_id,
      contact_id: contactId,
      type: "booking",
      description: `Appointment booked for ${new Date(start_time).toLocaleString()}${zoomLink ? " (Zoom)" : ""}`,
    });

    // Create notification
    await supabase.from("notifications").insert({
      user_id,
      title: "📅 New Booking",
      message: `${name} booked a meeting on ${new Date(start_time).toLocaleDateString()}${zoomLink ? " — Zoom link created" : ""}`,
      type: "booking",
      link: "/calendar",
    });

    // Send WhatsApp notification if phone is available
    if (phone) {
      const greeting = `Hi ${firstName}! Your meeting is confirmed for ${new Date(start_time).toLocaleString()}.${zoomLink ? ` Join here: ${zoomLink}` : ""} Looking forward to speaking with you!`;
      await supabase.from("messages").insert({
        user_id,
        contact_id: contactId,
        channel: "whatsapp",
        direction: "outbound",
        content: greeting,
        metadata: { auto_sent: true, type: "booking_confirmation" },
      });
    }

    // Trigger booking-related workflows
    const { data: workflows } = await supabase
      .from("workflows")
      .select("id")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .in("trigger_type", ["new_lead", "form_submit"]);

    if (workflows && workflows.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      for (const wf of workflows) {
        fetch(`${supabaseUrl}/functions/v1/workflow-executor`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({ workflow_id: wf.id, contact_id: contactId, trigger_type: "form_submit" }),
        }).catch(console.error);
      }
    }

    return new Response(JSON.stringify({ success: true, contact_id: contactId, zoom_link: zoomLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
