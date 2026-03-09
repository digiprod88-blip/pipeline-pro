import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowAction {
  id: string;
  workflow_id: string;
  action_type: string;
  action_config: Record<string, any> | null;
  delay_minutes: number | null;
  position: number;
}

interface ScheduledAction {
  id: string;
  workflow_id: string;
  action_id: string;
  contact_id: string;
  execute_at: string;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch pending scheduled actions that are due
    const { data: pendingActions, error: fetchError } = await supabase
      .from("workflow_scheduled_actions")
      .select(`
        *,
        workflow_actions (*)
      `)
      .eq("status", "pending")
      .lte("execute_at", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingActions || pendingActions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const scheduled of pendingActions) {
      try {
        const action = scheduled.workflow_actions as WorkflowAction;
        const config = action.action_config || {};

        // Execute based on action type
        switch (action.action_type) {
          case "send_email":
            await executeEmailAction(supabase, scheduled.contact_id, config);
            break;

          case "send_whatsapp":
            await executeWhatsAppAction(supabase, scheduled.contact_id, config);
            break;

          case "add_tag":
            await executeAddTagAction(supabase, scheduled.contact_id, config);
            break;

          case "update_stage":
            await executeUpdateStageAction(supabase, scheduled.contact_id, config);
            break;

          case "create_task":
            await executeCreateTaskAction(supabase, scheduled.contact_id, config);
            break;

          case "if_else":
            await executeIfElseAction(supabase, scheduled, action, config);
            break;

          case "wait":
            // Wait actions are handled by scheduling, nothing to execute
            break;

          default:
            console.log(`Unknown action type: ${action.action_type}`);
        }

        // Mark as completed
        await supabase
          .from("workflow_scheduled_actions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", scheduled.id);

        // Schedule next action in workflow
        await scheduleNextAction(supabase, scheduled.workflow_id, action.position, scheduled.contact_id);

        // Log success
        await supabase.from("workflow_logs").insert({
          workflow_id: scheduled.workflow_id,
          contact_id: scheduled.contact_id,
          status: "success",
          message: `Executed ${action.action_type}`,
        });

        processed++;
      } catch (error) {
        console.error(`Error executing action ${scheduled.id}:`, error);
        
        await supabase
          .from("workflow_scheduled_actions")
          .update({
            status: "failed",
            error: error.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", scheduled.id);

        await supabase.from("workflow_logs").insert({
          workflow_id: scheduled.workflow_id,
          contact_id: scheduled.contact_id,
          status: "error",
          message: error.message,
        });

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Workflow Cron Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function scheduleNextAction(
  supabase: any,
  workflowId: string,
  currentPosition: number,
  contactId: string
) {
  // Get next action in sequence
  const { data: nextAction } = await supabase
    .from("workflow_actions")
    .select("*")
    .eq("workflow_id", workflowId)
    .gt("position", currentPosition)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (!nextAction) {
    return; // No more actions
  }

  // Calculate execute time
  const delayMinutes = nextAction.delay_minutes || 0;
  const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  // Schedule the action
  await supabase.from("workflow_scheduled_actions").insert({
    workflow_id: workflowId,
    action_id: nextAction.id,
    contact_id: contactId,
    execute_at: executeAt.toISOString(),
    status: "pending",
  });
}

async function executeEmailAction(supabase: any, contactId: string, config: any) {
  // Get contact email
  const { data: contact } = await supabase
    .from("contacts")
    .select("email, first_name")
    .eq("id", contactId)
    .single();

  if (!contact?.email) {
    throw new Error("Contact has no email");
  }

  // In production, integrate with email service
  console.log(`Would send email to ${contact.email}: ${config.subject}`);
}

async function executeWhatsAppAction(supabase: any, contactId: string, config: any) {
  const { data: contact } = await supabase
    .from("contacts")
    .select("phone, first_name")
    .eq("id", contactId)
    .single();

  if (!contact?.phone) {
    throw new Error("Contact has no phone");
  }

  // In production, send via WhatsApp API
  console.log(`Would send WhatsApp to ${contact.phone}: ${config.message}`);
}

async function executeAddTagAction(supabase: any, contactId: string, config: any) {
  const tag = config.tag;
  if (!tag) return;

  const { data: contact } = await supabase
    .from("contacts")
    .select("tags")
    .eq("id", contactId)
    .single();

  const currentTags = contact?.tags || [];
  if (!currentTags.includes(tag)) {
    await supabase
      .from("contacts")
      .update({ tags: [...currentTags, tag] })
      .eq("id", contactId);
  }
}

async function executeUpdateStageAction(supabase: any, contactId: string, config: any) {
  const stageId = config.stage_id;
  if (!stageId) return;

  await supabase
    .from("contacts")
    .update({ stage_id: stageId })
    .eq("id", contactId);
}

async function executeCreateTaskAction(supabase: any, contactId: string, config: any) {
  const { data: contact } = await supabase
    .from("contacts")
    .select("user_id")
    .eq("id", contactId)
    .single();

  await supabase.from("tasks").insert({
    user_id: contact.user_id,
    contact_id: contactId,
    title: config.title || "Follow up",
    description: config.description,
    priority: config.priority || "medium",
    due_date: config.due_days
      ? new Date(Date.now() + config.due_days * 24 * 60 * 60 * 1000).toISOString()
      : null,
  });
}

async function executeIfElseAction(
  supabase: any,
  scheduled: ScheduledAction,
  action: WorkflowAction,
  config: any
) {
  // Evaluate condition
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", scheduled.contact_id)
    .single();

  if (!contact) return;

  const conditionMet = evaluateCondition(contact, config.condition);

  // Get the appropriate branch actions
  const branchPosition = conditionMet
    ? config.true_branch_position
    : config.false_branch_position;

  if (branchPosition) {
    // Schedule branch action
    const { data: branchAction } = await supabase
      .from("workflow_actions")
      .select("*")
      .eq("workflow_id", scheduled.workflow_id)
      .eq("position", branchPosition)
      .single();

    if (branchAction) {
      const delayMinutes = branchAction.delay_minutes || 0;
      const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000);

      await supabase.from("workflow_scheduled_actions").insert({
        workflow_id: scheduled.workflow_id,
        action_id: branchAction.id,
        contact_id: scheduled.contact_id,
        execute_at: executeAt.toISOString(),
        status: "pending",
      });
    }
  }
}

function evaluateCondition(contact: any, condition: any): boolean {
  if (!condition) return false;

  const { field, operator, value } = condition;
  const contactValue = contact[field];

  switch (operator) {
    case "equals":
      return contactValue === value;
    case "not_equals":
      return contactValue !== value;
    case "contains":
      return String(contactValue).includes(value);
    case "greater_than":
      return Number(contactValue) > Number(value);
    case "less_than":
      return Number(contactValue) < Number(value);
    case "is_set":
      return contactValue != null && contactValue !== "";
    case "is_not_set":
      return contactValue == null || contactValue === "";
    default:
      return false;
  }
}
