import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowAction {
  id: string;
  workflow_id: string;
  action_type: string;
  action_config: Record<string, any>;
  delay_minutes: number;
  position: number;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  quality: string | null;
  status: string;
  stage_id: string | null;
  user_id: string;
}

// Replace dynamic values like {{first_name}}, {{email}}, etc.
function replaceVariables(text: string, contact: Contact): string {
  return text
    .replace(/\{\{first_name\}\}/gi, contact.first_name || "")
    .replace(/\{\{last_name\}\}/gi, contact.last_name || "")
    .replace(/\{\{contact_name\}\}/gi, `${contact.first_name} ${contact.last_name || ""}`.trim())
    .replace(/\{\{email\}\}/gi, contact.email || "")
    .replace(/\{\{phone\}\}/gi, contact.phone || "");
}

// Evaluate conditions for if/else logic
function evaluateCondition(
  contact: Contact,
  config: { field: string; operator: string; value: string }
): boolean {
  const { field, operator, value } = config;
  
  let contactValue: any;
  switch (field) {
    case "quality":
      contactValue = contact.quality;
      break;
    case "status":
      contactValue = contact.status;
      break;
    case "tags":
      contactValue = contact.tags || [];
      break;
    case "email":
      contactValue = contact.email;
      break;
    case "phone":
      contactValue = contact.phone;
      break;
    default:
      contactValue = null;
  }

  switch (operator) {
    case "equals":
      return String(contactValue).toLowerCase() === value.toLowerCase();
    case "not_equals":
      return String(contactValue).toLowerCase() !== value.toLowerCase();
    case "contains":
      return String(contactValue).toLowerCase().includes(value.toLowerCase());
    case "has_tag":
      return Array.isArray(contactValue) && contactValue.includes(value);
    case "not_has_tag":
      return !Array.isArray(contactValue) || !contactValue.includes(value);
    case "is_empty":
      return !contactValue || contactValue === "";
    case "is_not_empty":
      return !!contactValue && contactValue !== "";
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { workflow_id, contact_id, trigger_type } = await req.json();

    if (!workflow_id || !contact_id) {
      throw new Error("workflow_id and contact_id are required");
    }

    // Fetch workflow
    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflow_id)
      .eq("is_active", true)
      .single();

    if (wfError || !workflow) {
      throw new Error("Workflow not found or inactive");
    }

    // Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      throw new Error("Contact not found");
    }

    // Fetch actions ordered by position
    const { data: actions, error: actionsError } = await supabase
      .from("workflow_actions")
      .select("*")
      .eq("workflow_id", workflow_id)
      .order("position");

    if (actionsError) {
      throw new Error("Failed to fetch workflow actions");
    }

    const results: { action: string; status: string; message?: string }[] = [];

    // Process each action
    for (const action of actions || []) {
      const config = action.action_config || {};

      // Handle delay (wait action)
      if (action.delay_minutes && action.delay_minutes > 0) {
        // In production, this would schedule a delayed job
        // For now, we log it
        results.push({
          action: "wait",
          status: "scheduled",
          message: `Wait ${action.delay_minutes} minutes`,
        });
        continue;
      }

      switch (action.action_type) {
        case "send_message": {
          const channel = config.channel || "whatsapp";
          const content = replaceVariables(config.message || "", contact);
          
          await supabase.from("messages").insert({
            contact_id: contact.id,
            user_id: contact.user_id,
            channel,
            direction: "outbound",
            content,
          });
          
          results.push({
            action: "send_message",
            status: "success",
            message: `Sent ${channel} message`,
          });
          break;
        }

        case "add_tag": {
          const newTag = config.tag;
          if (newTag) {
            const currentTags = contact.tags || [];
            if (!currentTags.includes(newTag)) {
              await supabase
                .from("contacts")
                .update({ tags: [...currentTags, newTag] })
                .eq("id", contact.id);
            }
          }
          results.push({
            action: "add_tag",
            status: "success",
            message: `Added tag: ${config.tag}`,
          });
          break;
        }

        case "remove_tag": {
          const tagToRemove = config.tag;
          if (tagToRemove && contact.tags) {
            const updatedTags = contact.tags.filter((t: string) => t !== tagToRemove);
            await supabase
              .from("contacts")
              .update({ tags: updatedTags })
              .eq("id", contact.id);
          }
          results.push({
            action: "remove_tag",
            status: "success",
            message: `Removed tag: ${config.tag}`,
          });
          break;
        }

        case "update_stage": {
          if (config.stage_id) {
            await supabase
              .from("contacts")
              .update({ stage_id: config.stage_id })
              .eq("id", contact.id);
          }
          results.push({
            action: "update_stage",
            status: "success",
            message: "Stage updated",
          });
          break;
        }

        case "update_quality": {
          if (config.quality) {
            await supabase
              .from("contacts")
              .update({ quality: config.quality })
              .eq("id", contact.id);
          }
          results.push({
            action: "update_quality",
            status: "success",
            message: `Quality set to ${config.quality}`,
          });
          break;
        }

        case "create_task": {
          await supabase.from("tasks").insert({
            user_id: contact.user_id,
            contact_id: contact.id,
            title: replaceVariables(config.title || "Follow up", contact),
            description: replaceVariables(config.description || "", contact),
            priority: config.priority || "medium",
            due_date: config.due_days
              ? new Date(Date.now() + config.due_days * 24 * 60 * 60 * 1000).toISOString()
              : null,
          });
          results.push({
            action: "create_task",
            status: "success",
            message: "Task created",
          });
          break;
        }

        case "send_notification": {
          await supabase.from("notifications").insert({
            user_id: contact.user_id,
            title: replaceVariables(config.title || "Workflow Alert", contact),
            message: replaceVariables(config.message || "", contact),
            type: "workflow",
            link: `/contacts/${contact.id}`,
          });
          results.push({
            action: "send_notification",
            status: "success",
            message: "Notification sent",
          });
          break;
        }

        case "if_else": {
          const condition = evaluateCondition(contact, config);
          results.push({
            action: "if_else",
            status: "evaluated",
            message: `Condition ${condition ? "true" : "false"}: ${config.field} ${config.operator} ${config.value}`,
          });
          // In a full implementation, this would branch to different action paths
          break;
        }

        default:
          results.push({
            action: action.action_type,
            status: "skipped",
            message: "Unknown action type",
          });
      }
    }

    // Log workflow execution
    await supabase.from("workflow_logs").insert({
      workflow_id,
      contact_id,
      status: "success",
      message: JSON.stringify(results),
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Workflow executor error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
