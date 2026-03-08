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
import { Plus, Zap, Clock, MessageSquare, Users, Bell, Trash2, Play, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TRIGGER_TYPES = [
  { value: "new_lead", label: "New Lead Added", icon: Users },
  { value: "stage_change", label: "Pipeline Stage Changed", icon: Zap },
  { value: "webhook", label: "Webhook Received", icon: Zap },
  { value: "form_submit", label: "Form Submitted", icon: Zap },
  { value: "group_added", label: "Added to Contact Group", icon: Users },
];

const ACTION_TYPES = [
  { value: "send_whatsapp", label: "Send WhatsApp Message", icon: MessageSquare },
  { value: "send_email", label: "Send Email", icon: MessageSquare },
  { value: "add_to_group", label: "Add to Contact Group", icon: Users },
  { value: "remove_from_group", label: "Remove from Group", icon: Users },
  { value: "send_notification", label: "Send Notification", icon: Bell },
  { value: "update_stage", label: "Update Pipeline Stage", icon: Zap },
];

export default function Workflows() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", description: "", trigger_type: "new_lead",
  });
  const [actions, setActions] = useState<{ action_type: string; delay_minutes: number; action_config: any }[]>([]);

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

  const addAction = () => {
    setActions([...actions, { action_type: "send_whatsapp", delay_minutes: 0, action_config: {} }]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workflows & Automations</h1>
          <p className="text-muted-foreground text-sm">Automate actions when triggers fire</p>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Actions</Label>
                  <Button variant="outline" size="sm" onClick={addAction}><Plus className="h-3 w-3 mr-1" />Add Action</Button>
                </div>
                {actions.map((action, i) => (
                  <Card key={i} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Step {i + 1}</span>
                        <Button variant="ghost" size="sm" onClick={() => setActions(actions.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      <Select value={action.action_type} onValueChange={v => { const a = [...actions]; a[i].action_type = v; setActions(a); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input type="number" min={0} value={action.delay_minutes} onChange={e => { const a = [...actions]; a[i].delay_minutes = parseInt(e.target.value) || 0; setActions(a); }} className="w-20" />
                        <span className="text-xs text-muted-foreground">minutes delay</span>
                      </div>
                      {(action.action_type === "send_whatsapp" || action.action_type === "send_email") && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <Select
                              value={action.action_config?.template_id || "custom"}
                              onValueChange={v => {
                                const a = [...actions];
                                if (v === "custom") {
                                  a[i].action_config = { ...a[i].action_config, template_id: undefined };
                                } else {
                                  const tmpl = templates?.find(t => t.id === v);
                                  a[i].action_config = { ...a[i].action_config, template_id: v, message: tmpl?.content || "" };
                                }
                                setActions(a);
                              }}
                            >
                              <SelectTrigger className="flex-1"><SelectValue placeholder="Select template" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="custom">Custom Message</SelectItem>
                                {templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Textarea
                            placeholder="Message content..."
                            value={action.action_config?.message || ""}
                            onChange={e => { const a = [...actions]; a[i].action_config = { ...a[i].action_config, message: e.target.value }; setActions(a); }}
                            rows={2}
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

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
          <Card key={wf.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{wf.name}</CardTitle>
                <Switch checked={wf.is_active} onCheckedChange={v => toggleActive.mutate({ id: wf.id, is_active: v })} />
              </div>
              <p className="text-xs text-muted-foreground">{wf.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={wf.is_active ? "success" : "secondary"}>{wf.is_active ? "Active" : "Inactive"}</Badge>
                <Badge variant="outline" className="capitalize">{wf.trigger_type.replace("_", " ")}</Badge>
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
          <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first automation workflow</p>
        </Card>
      )}
    </div>
  );
}
