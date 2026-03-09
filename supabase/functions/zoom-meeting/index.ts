import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, topic, start_time, duration, timezone, agenda } = await req.json();

    const ZOOM_ACCOUNT_ID = Deno.env.get("ZOOM_ACCOUNT_ID");
    const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID");
    const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET");

    if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Zoom credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token using Server-to-Server OAuth
    const tokenResponse = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)}`,
      },
      body: `grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.message || "Failed to get Zoom access token");
    }

    const accessToken = tokenData.access_token;

    if (action === "create") {
      // Create a new meeting
      const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          topic: topic || "Meeting",
          type: 2, // Scheduled meeting
          start_time: start_time,
          duration: duration || 60,
          timezone: timezone || "Asia/Kolkata",
          agenda: agenda || "",
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: true,
            mute_upon_entry: false,
            waiting_room: false,
            auto_recording: "none",
          },
        }),
      });

      const meetingData = await meetingResponse.json();

      if (!meetingResponse.ok) {
        throw new Error(meetingData.message || "Failed to create Zoom meeting");
      }

      return new Response(
        JSON.stringify({
          success: true,
          meeting_id: meetingData.id,
          join_url: meetingData.join_url,
          start_url: meetingData.start_url,
          password: meetingData.password,
          topic: meetingData.topic,
          start_time: meetingData.start_time,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Zoom meeting error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
