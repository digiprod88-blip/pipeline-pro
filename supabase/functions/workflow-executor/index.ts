import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  lead_score: number;
  value: number | null;
  source: string | null;
}

function replaceVariables(text: string, contact: Contact): string {
  return text
    .replace(/\{\{first_name\}\}/gi, contact.first_name || "")
    .replace(/\{\{last_name\}\}/gi, contact.last_name || "")
    .replace(/\{\{contact_name\}\}/gi, `${contact.first_name} ${contact.last_name || ""}`.trim())
    .replace(/\{\{email\}\}/gi, contact.email || "")
    .replace(/\{\{phone\}\}/gi, contact.phone || "");
}

function evaluateCondition(
  contact: Contact,
  config: { field: string; operator: string; value: string }
): boolean {
  const { field, operator, value } = config;

  let contactValue: any;
  switch (field) {
    case "lead_score": contactValue = contact.lead_score; break;
    case "quality": contactValue = contact.quality; break;
    case "source": contactValue = contact.source; break;
    case "status": contactValue = contact.status; break;
    case "value": contactValue = contact.value; break;
    case "email": contactValue = contact.email; break;
    case "phone": contactValue = contact.phone; break;
    case "tags": contactValue = contact.tags || []; break;
    default: contactValue = null;
  }

  switch (operator) {
    case "gt": return Number(contactValue) > Number(value);
    case "lt": return Number(contactValue) < Number(value);
    case "eq":
    case "equals": return String(contactValue).toLowerCase() === value.toLowerCase();
    case "neq":
    case "not_equals": return String(contactValue).toLowerCase() !== value.toLowerCase();
    case "contains": return String(contactValue).toLowerCase().includes(value.toLowerCase());
    case "has_tag": return Array.isArray(contactValue) && contactValue.includes(value);
    case "not_has_tag": return !Array.isArray(contactValue) || !contactValue.includes(value);
    case "is_empty": return !contactValue || contactValue === "";
    case "is_not_empty": return !!contactValue && contactValue !== "";
    default: return false;
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

    const { data: workflow, error: wfError } = await supabase
      .from("workflows").select("*").eq("id", workflow_id).eq("is_active", true).single();
    if (wfError || !workflow) throw new Error("Workflow not found or inactive");

    const { data: contact, error: contactError } = await supabase
      .from("contacts").select("*").eq("id", contact_id).single();
    if (contactError || !contact) throw new Error("Contact not found");

    const { data: actions, error: actionsError } = await supabase
      .from("workflow_actions").select("*").eq("workflow_id", workflow_id).order("position");
    if (actionsError) throw new Error("Failed to fetch workflow actions");

    const results: { action: string; status: string; message?: string }[] = [];
    let skipRemaining = false;

    for (const action of actions || []) {
      if (skipRemaining) break;
      const config = action.action_config || {};

      // Handle delay - schedule for later
      if (action.action_type === "wait" || (action.delay_minutes && action.delay_minutes > 0)) {
        const delayMin = action.delay_minutes || 0;
        const unit = config.delay_unit || "minutes";
        const actualMinutes = unit === "hours" ? delayMin * 60 : unit === "days" ? delayMin * 1440 : delayMin;
        
        if (actualMinutes > 0) {
          const executeAt = new Date(Date.now() + actualMinutes * 60000).toISOString();
          // Find next action to schedule
          const nextActions = (actions || []).filter((a: any) => a.position > action.position);
          if (nextActions.length > 0) {
            await supabase.from("workflow_scheduled_actions").insert({
              workflow_id, contact_id, action_id: nextActions[0].id,
              execute_at: executeAt, status: "pending",
            });
          }
          results.push({ action: "wait", status: "scheduled", message: `Wait ${delayMin} ${unit}` });
          break; // Stop processing, rest will be picked up by cron
        }
        continue;
      }

      switch (action.action_type) {
        case "send_whatsapp":
        case "send_email":
        case "send_message": {
          const channel = action.action_type === "send_email" ? "email" : 
                          action.action_type === "send_whatsapp" ? "whatsapp" : (config.channel || "whatsapp");
          const content = replaceVariables(config.message || "", contact);
          await supabase.from("messages").insert({
            contact_id: contact.id, user_id: contact.user_id,
            channel, direction: "outbound", content,
          });
          results.push({ action: action.action_type, status: "success", message: `Sent ${channel} message` });
          break;
        }

        case "add_to_group": {
          const groupId = config.group_id;
          const groupName = config.group_name;
          if (groupId) {
            await supabase.from("contact_group_members").upsert(
              { contact_id: contact.id, group_id: groupId },
              { onConflict: "contact_id,group_id" }
            );
            results.push({ action: "add_to_group", status: "success", message: `Added to group ${groupName || groupId}` });
          }
          break;
        }

        case "remove_from_group": {
          const groupId = config.group_id;
          if (groupId) {
            await supabase.from("contact_group_members")
              .delete().eq("contact_id", contact.id).eq("group_id", groupId);
            results.push({ action: "remove_from_group", status: "success", message: `Removed from group` });
          }
          break;
        }

        case "update_stage": {
          if (config.stage_id) {
            await supabase.from("contacts").update({ stage_id: config.stage_id }).eq("id", contact.id);
          }
          results.push({ action: "update_stage", status: "success", message: "Stage updated" });
          break;
        }

        case "move_to_vip":
        case "update_quality": {
          const quality = config.quality || "hot";
          await supabase.from("contacts").update({ quality }).eq("id", contact.id);
          results.push({ action: action.action_type, status: "success", message: `Quality set to ${quality}` });
          break;
        }

        case "boost_score": {
          const boost = Number(config.boost_amount) || 20;
          const newScore = (contact.lead_score || 0) + boost;
          await supabase.from("contacts").update({ lead_score: newScore }).eq("id", contact.id);
          results.push({ action: "boost_score", status: "success", message: `Score boosted by ${boost}` });
          break;
        }

        case "add_tag": {
          const newTag = config.tag;
          if (newTag) {
            const currentTags = contact.tags || [];
            if (!currentTags.includes(newTag)) {
              await supabase.from("contacts").update({ tags: [...currentTags, newTag] }).eq("id", contact.id);
            }
          }
          results.push({ action: "add_tag", status: "success", message: `Added tag: ${config.tag}` });
          break;
        }

        case "remove_tag": {
          const tagToRemove = config.tag;
          if (tagToRemove && contact.tags) {
            await supabase.from("contacts").update({ tags: contact.tags.filter((t: string) => t !== tagToRemove) }).eq("id", contact.id);
          }
          results.push({ action: "remove_tag", status: "success", message: `Removed tag: ${config.tag}` });
          break;
        }

        case "send_notification": {
          await supabase.from("notifications").insert({
            user_id: contact.user_id,
            title: replaceVariables(config.title || "Workflow Alert", contact),
            message: replaceVariables(config.message || "", contact),
            type: "workflow", link: `/contacts/${contact.id}`,
          });
          results.push({ action: "send_notification", status: "success", message: "Notification sent" });
          break;
        }

        case "create_task": {
          await supabase.from("tasks").insert({
            user_id: contact.user_id, contact_id: contact.id,
            title: replaceVariables(config.title || "Follow up", contact),
            description: replaceVariables(config.description || "", contact),
            priority: config.priority || "medium",
            due_date: config.due_days ? new Date(Date.now() + config.due_days * 86400000).toISOString() : null,
          });
          results.push({ action: "create_task", status: "success", message: "Task created" });
          break;
        }

        case "condition":
        case "if_else": {
          const conditionMet = evaluateCondition(contact, config);
          results.push({
            action: "condition", status: "evaluated",
            message: `${config.field} ${config.operator} ${config.value} → ${conditionMet ? "TRUE" : "FALSE"}`,
          });
          if (!conditionMet) skipRemaining = true;
          break;
        }

        default:
          results.push({ action: action.action_type, status: "skipped", message: "Unknown action type" });
      }
    }

    // Log workflow execution
    await supabase.from("workflow_logs").insert({
      workflow_id, contact_id, status: "success",
      message: results.map(r => `${r.action}: ${r.message}`).join(" → "),
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
