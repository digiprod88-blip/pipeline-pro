import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { post_id } = await req.json();
    if (!post_id) throw new Error("post_id is required");

    // Fetch the scheduled post
    const { data: post, error: postErr } = await serviceClient
      .from("scheduled_posts")
      .select("*")
      .eq("id", post_id)
      .single();
    if (postErr || !post) throw new Error("Post not found");

    const results: Record<string, { success: boolean; message: string }> = {};

    // ── Facebook ──
    if (post.platforms?.includes("facebook")) {
      const fbToken = Deno.env.get("META_PAGE_ACCESS_TOKEN");
      const fbPageId = Deno.env.get("META_PAGE_ID");
      if (fbToken && fbPageId) {
        try {
          const fbUrl = post.image_url
            ? `https://graph.facebook.com/v18.0/${fbPageId}/photos`
            : `https://graph.facebook.com/v18.0/${fbPageId}/feed`;
          const body = post.image_url
            ? { url: post.image_url, caption: post.content, access_token: fbToken }
            : { message: post.content, access_token: fbToken };

          const res = await fetch(fbUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          results.facebook = res.ok
            ? { success: true, message: `Posted: ${data.id}` }
            : { success: false, message: data.error?.message || "FB API error" };
        } catch (e) {
          results.facebook = { success: false, message: e.message };
        }
      } else {
        results.facebook = { success: false, message: "META_PAGE_ACCESS_TOKEN or META_PAGE_ID not configured" };
      }
    }

    // ── Instagram ──
    if (post.platforms?.includes("instagram")) {
      const igToken = Deno.env.get("META_PAGE_ACCESS_TOKEN");
      const igAccountId = Deno.env.get("META_IG_ACCOUNT_ID");
      if (igToken && igAccountId && post.image_url) {
        try {
          // Step 1: Create media container
          const containerRes = await fetch(
            `https://graph.facebook.com/v18.0/${igAccountId}/media`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: post.image_url,
                caption: post.content,
                access_token: igToken,
              }),
            }
          );
          const containerData = await containerRes.json();
          if (!containerRes.ok) throw new Error(containerData.error?.message);

          // Step 2: Publish
          const publishRes = await fetch(
            `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                creation_id: containerData.id,
                access_token: igToken,
              }),
            }
          );
          const publishData = await publishRes.json();
          results.instagram = publishRes.ok
            ? { success: true, message: `Posted: ${publishData.id}` }
            : { success: false, message: publishData.error?.message || "IG publish error" };
        } catch (e) {
          results.instagram = { success: false, message: e.message };
        }
      } else {
        results.instagram = {
          success: false,
          message: !post.image_url
            ? "Instagram requires an image_url"
            : "META_PAGE_ACCESS_TOKEN or META_IG_ACCOUNT_ID not configured",
        };
      }
    }

    // ── X (Twitter) ──
    if (post.platforms?.includes("x")) {
      const xBearerToken = Deno.env.get("X_BEARER_TOKEN");
      const xAccessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
      const xAccessSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
      const xConsumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
      const xConsumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");

      if (xAccessToken && xAccessSecret && xConsumerKey && xConsumerSecret) {
        // OAuth 1.0a — simplified using fetch with bearer for v2
        // For production, use OAuth 1.0a HMAC-SHA1 signature
        results.x = {
          success: false,
          message: "X/Twitter posting requires OAuth 1.0a signing. Configure TWITTER_* secrets and implement HMAC-SHA1.",
        };
      } else {
        results.x = { success: false, message: "Twitter API credentials not configured" };
      }
    }

    // Update post status
    const allSucceeded = Object.values(results).every(r => r.success);
    const anySucceeded = Object.values(results).some(r => r.success);

    await serviceClient.from("scheduled_posts").update({
      status: allSucceeded ? "published" : anySucceeded ? "partial" : "failed",
      published_at: anySucceeded ? new Date().toISOString() : null,
      metadata: { publish_results: results },
    }).eq("id", post_id);

    // Notify user
    await serviceClient.from("notifications").insert({
      user_id: user.id,
      title: "📱 Social Post Update",
      message: allSucceeded
        ? `Post published to ${Object.keys(results).join(", ")}!`
        : `Post results: ${Object.entries(results).map(([k, v]) => `${k}: ${v.success ? "✓" : "✗"}`).join(", ")}`,
      type: allSucceeded ? "info" : "warning",
      link: "/social",
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Social publish error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
