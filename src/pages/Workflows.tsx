import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Zap, Clock, MessageSquare, Users, Bell, Trash2, Play, AlertCircle, FileText, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TRIGGER_TYPES = [
  { value: "new_lead", label: "New Lead Added", icon: Users },
  { value: "stage_change", label: "Pipeline Stage Changed", icon: Zap },
  { value: "webhook", label: "Webhook Received", icon: Zap },
  { value: "form_submit", label: "Form Submitted", icon: Zap },
  { value: "group_added", label: "Added to Contact Group", icon: Users },
  { value: "link_click", label: "🔗 Link Clicked", icon: Zap },
  { value: "score_threshold", label: "⭐ Lead Score Threshold", icon: Zap },
  { value: "lms_enrollment", label: "📚 Course Enrolled (LMS)", icon: Zap },
];

const ACTION_TYPES = [
  { value: "send_whatsapp", label: "Send WhatsApp Message", icon: MessageSquare },
  { value: "send_email", label: "Send Email", icon: MessageSquare },
  { value: "wait", label: "⏳ Wait / Delay", icon: Clock },
  { value: "condition", label: "🔀 If/Else Branch", icon: GitBranch },
  { value: "add_to_group", label: "Add to Contact Group", icon: Users },
  { value: "remove_from_group", label: "Remove from Group", icon: Users },
  { value: "send_notification", label: "Send Notification", icon: Bell },
  { value: "update_stage", label: "Update Pipeline Stage", icon: Zap },
  { value: "move_to_vip", label: "⭐ Move to VIP Stage", icon: Zap },
  { value: "boost_score", label: "📈 Boost Lead Score", icon: Zap },
];

const CONDITION_FIELDS = [
  { value: "lead_score", label: "Lead Score" },
  { value: "quality", label: "Lead Quality" },
  { value: "source", label: "Lead Source" },
  { value: "status", label: "Contact Status" },
  { value: "value", label: "Deal Value" },
];

const CONDITION_OPERATORS = [
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
  { value: "contains", label: "Contains" },
];

interface WorkflowAction {
  action_type: string;
  delay_minutes: number;
  action_config: any;
}

export default function Workflows() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", description: "", trigger_type: "new_lead" });
  const [actions, setActions] = useState<WorkflowAction[]>([]);

  const { data: templates } = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workflows").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: workflowLogs } = useQuery({
    queryKey: ["workflow-logs", showLogs],
    queryFn: async () => {
      if (!showLogs) return [];
      const { data, error } = await supabase.from("workflow_logs").select("*, contacts(first_name, last_name)").eq("workflow_id", showLogs).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!showLogs,
  });

  const createWorkflow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("workflows").insert({
        user_id: user!.id, name: form.name, description: form.description, trigger_type: form.trigger_type,
      }).select().single();
      if (error) throw error;

      if (actions.length > 0) {
        const actionsToInsert = actions.map((a, i) => ({
          workflow_id: data.id, action_type: a.action_type, delay_minutes: a.delay_minutes,
          action_config: a.action_config || {}, position: i,
        }));
        const { error: actErr } = await supabase.from("workflow_actions").insert(actionsToInsert);
        if (actErr) throw actErr;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setOpen(false);
      setForm({ name: "", description: "", trigger_type: "new_lead" });
      setActions([]);
      toast.success("Workflow created!");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("workflows").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow updated");
    },
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workflows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow deleted");
    },
  });

  const updateAction = (index: number, updates: Partial<WorkflowAction>) => {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  const updateActionConfig = (index: number, key: string, value: any) => {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, action_config: { ...a.action_config, [key]: value } } : a));
  };

  // Check if workflow has high-frequency risk (wait actions with 100+ potential recipients)
  const hasHighFrequencyRisk = actions.some(a => a.action_type === "send_whatsapp") && actions.every(a => a.action_type !== "wait" || a.delay_minutes < 1);

  const renderActionEditor = (action: WorkflowAction, i: number) => {
    switch (action.action_type) {
      case "wait":
        return (
          <div className="flex items-center gap-2 bg-warning/5 border border-warning/20 rounded-lg p-3">
            <Clock className="h-4 w-4 text-warning shrink-0" />
            <span className="text-xs font-medium text-warning">Wait</span>
            <Input type="number" min={1} value={action.delay_minutes} onChange={e => updateAction(i, { delay_minutes: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            <Select value={action.action_config?.delay_unit || "minutes"} onValueChange={v => updateActionConfig(i, "delay_unit", v)}>
              <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );

      case "condition":
        return (
          <div className="space-y-3 bg-info/5 border border-info/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-info shrink-0" />
              <span className="text-xs font-medium text-info">If/Else Branch</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={action.action_config?.field || ""} onValueChange={v => updateActionConfig(i, "field", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
                <SelectContent>
                  {CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={action.action_config?.operator || ""} onValueChange={v => updateActionConfig(i, "operator", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Operator" /></SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="h-8 text-xs" placeholder="Value" value={action.action_config?.value || ""} onChange={e => updateActionConfig(i, "value", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-success/5 border border-success/20">
                <span className="text-success font-medium">✓ TRUE →</span>
                <p className="text-muted-foreground mt-1">Continue to next action</p>
              </div>
              <div className="p-2 rounded bg-destructive/5 border border-destructive/20">
                <span className="text-destructive font-medium">✗ FALSE →</span>
                <p className="text-muted-foreground mt-1">Skip to end</p>
              </div>
            </div>
          </div>
        );

      case "send_whatsapp":
      case "send_email":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Select
                value={action.action_config?.template_id || "custom"}
                onValueChange={v => {
                  if (v === "custom") {
                    updateActionConfig(i, "template_id", undefined);
                  } else {
                    const tmpl = templates?.find(t => t.id === v);
                    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, action_config: { ...a.action_config, template_id: v, message: tmpl?.content || "" } } : a));
                  }
                }}
              >
                <SelectTrigger className="flex-1 h-8"><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Message</SelectItem>
                  {templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Message content..."
              value={action.action_config?.message || ""}
              onChange={e => updateActionConfig(i, "message", e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        );

      default:
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input type="number" min={0} value={action.delay_minutes} onChange={e => updateAction(i, { delay_minutes: parseInt(e.target.value) || 0 })} className="w-20 h-8" />
            <span className="text-xs text-muted-foreground">min delay</span>
          </div>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workflows & Automations</h1>
          <p className="text-muted-foreground text-sm">Automate actions with triggers, delays, and smart branches</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Workflow</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Workflow</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Welcome New Leads" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What does this workflow do?" /></div>
              <div>
                <Label>Trigger</Label>
                <Select value={form.trigger_type} onValueChange={v => setForm({ ...form, trigger_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Steps Timeline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Action Steps</Label>
                  <Button variant="outline" size="sm" onClick={() => setActions([...actions, { action_type: "send_whatsapp", delay_minutes: 0, action_config: {} }])}>
                    <Plus className="h-3 w-3 mr-1" />Add Step
                  </Button>
                </div>

                {/* Timeline visualization */}
                <div className="relative">
                  {actions.map((action, i) => (
                    <div key={i} className="relative pl-6 pb-3 last:pb-0">
                      {/* Timeline line */}
                      {i < actions.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-border" />
                      )}
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold
                        ${action.action_type === "wait" ? "bg-warning/20 text-warning border border-warning/30" : 
                          action.action_type === "condition" ? "bg-info/20 text-info border border-info/30" : 
                          "bg-primary/10 text-primary border border-primary/20"}`}
                      >
                        {i + 1}
                      </div>

                      <Card className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">Step {i + 1}</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setActions(actions.filter((_, j) => j !== i))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <Select value={action.action_type} onValueChange={v => updateAction(i, { action_type: v })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {renderActionEditor(action, i)}
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>

                {actions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No steps yet. Add actions to build your automation.</p>
                )}
              </div>

              {/* WABA Warning for high-frequency messaging */}
              {hasHighFrequencyRisk && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-destructive">⚠️ Bulk Messaging Warning</p>
                    <p className="text-muted-foreground mt-1">
                      Sending WhatsApp messages to many leads simultaneously without a proper delay can get your personal number banned by WhatsApp. 
                      Add a <strong>Wait</strong> step between messages or use a <strong>WhatsApp Business API (WABA)</strong> account for bulk messaging.
                    </p>
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={() => createWorkflow.mutate()} disabled={!form.name || createWorkflow.isPending}>
                Create Workflow
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Logs Dialog */}
      <Dialog open={!!showLogs} onOpenChange={() => setShowLogs(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Workflow Logs</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {workflowLogs?.map((log: any) => (
              <div key={log.id} className="flex items-start gap-2 text-sm border-b border-border pb-2">
                {log.status === "success" ? <Zap className="h-4 w-4 text-success mt-0.5" /> : <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />}
                <div>
                  <p>{log.message}</p>
                  {log.contacts && <p className="text-muted-foreground text-xs">{log.contacts.first_name} {log.contacts.last_name}</p>}
                  <p className="text-muted-foreground text-xs">{format(new Date(log.created_at), "MMM d, HH:mm")}</p>
                </div>
              </div>
            ))}
            {(!workflowLogs || workflowLogs.length === 0) && <p className="text-sm text-muted-foreground">No logs yet</p>}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workflows?.map((wf) => (
          <Card key={wf.id} className="card-elegant">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{wf.name}</CardTitle>
                <Switch checked={wf.is_active} onCheckedChange={v => toggleActive.mutate({ id: wf.id, is_active: v })} />
              </div>
              <p className="text-xs text-muted-foreground">{wf.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={wf.is_active ? "success" : "secondary"} className="text-xs">{wf.is_active ? "Active" : "Inactive"}</Badge>
                <Badge variant="outline" className="capitalize text-xs">
                  {wf.trigger_type === "group_added" ? "Group Enrollment" : wf.trigger_type.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Created {format(new Date(wf.created_at), "MMM d, yyyy")}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowLogs(wf.id)}><Play className="h-3 w-3 mr-1" />Logs</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteWorkflow.mutate(wf.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!workflows || workflows.length === 0) && (
        <Card className="p-12 text-center">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-semibold">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first automation workflow</p>
        </Card>
      )}
    </div>
  );
}
