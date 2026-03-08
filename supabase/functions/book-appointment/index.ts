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
    const { user_id, name, email, phone, notes, start_time, end_time } = await req.json();

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

      // Calculate lead score for new contact
      await supabase.rpc("calculate_lead_score", { _contact_id: contactId });
    }

    // Create appointment
    const { error: apptErr } = await supabase.from("appointments").insert({
      user_id,
      contact_id: contactId,
      title: `Meeting with ${name}`,
      description: notes,
      start_time,
      end_time,
      location: "Online",
    });
    if (apptErr) throw apptErr;

    // Create a task for admin
    const { error: taskErr } = await supabase.from("tasks").insert({
      user_id,
      contact_id: contactId,
      title: `Prepare for meeting with ${name}`,
      description: `Booked via scheduling page. Email: ${email}${phone ? `, Phone: ${phone}` : ""}${notes ? `\nNotes: ${notes}` : ""}`,
      priority: "medium",
      due_date: start_time,
      visible_to_client: true,
    });
    if (taskErr) console.error("Task creation error:", taskErr);

    // Log activity
    await supabase.from("activities").insert({
      user_id,
      contact_id: contactId,
      type: "booking",
      description: `Appointment booked for ${new Date(start_time).toLocaleString()}`,
    });

    // Create notification
    await supabase.from("notifications").insert({
      user_id,
      title: "New Booking",
      message: `${name} booked a meeting on ${new Date(start_time).toLocaleDateString()}`,
      type: "booking",
      link: "/calendar",
    });

    return new Response(JSON.stringify({ success: true, contact_id: contactId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
