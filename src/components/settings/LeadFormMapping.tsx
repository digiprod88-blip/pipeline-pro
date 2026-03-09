import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Facebook, ArrowRight, Plus, Trash2, AlertCircle, Settings2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const CRM_FIELDS = [
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "notes", label: "Notes" },
  { value: "source", label: "Source" },
  { value: "tags", label: "Tags" },
];

export function LeadFormMapping() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormPlatform, setNewFormPlatform] = useState("facebook");
  const [newSourceField, setNewSourceField] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Fetch webhook keys (forms)
  const { data: webhookKeys } = useQuery({
    queryKey: ["webhook-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_keys")
        .select("*, webhook_field_mappings(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-lead`;

  const createWebhookKey = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("webhook_keys")
        .insert({ user_id: user!.id, name: newFormName || "New Lead Form", is_active: true })
        .select()
        .single();
      if (error) throw error;

      // Add default mappings
      const defaultMappings = [
        { user_id: user!.id, webhook_key_id: data.id, source_field: "name", target_field: "first_name" },
        { user_id: user!.id, webhook_key_id: data.id, source_field: "email", target_field: "email" },
        { user_id: user!.id, webhook_key_id: data.id, source_field: "phone", target_field: "phone" },
      ];
      await supabase.from("webhook_field_mappings").insert(defaultMappings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-keys"] });
      setAddFormOpen(false);
      setNewFormName("");
      toast.success("Webhook key created with default mappings");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleKey = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("webhook_keys").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-keys"] });
      toast.success("Status updated");
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("webhook_field_mappings").delete().eq("webhook_key_id", id);
      const { error } = await supabase.from("webhook_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-keys"] });
      toast.success("Form mapping deleted");
    },
  });

  const updateMapping = useMutation({
    mutationFn: async ({ id, target_field }: { id: string; target_field: string }) => {
      const { error } = await supabase.from("webhook_field_mappings").update({ target_field }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-keys"] }),
  });

  const addMapping = useMutation({
    mutationFn: async ({ webhookKeyId, sourceField }: { webhookKeyId: string; sourceField: string }) => {
      const { error } = await supabase.from("webhook_field_mappings").insert({
        user_id: user!.id, webhook_key_id: webhookKeyId, source_field: sourceField, target_field: "notes",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-keys"] });
      setNewSourceField("");
      toast.success("Mapping added");
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_field_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-keys"] }),
  });

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Lead Form Mappings</h3>
          <p className="text-xs text-muted-foreground">Map incoming webhook fields to CRM contact fields</p>
        </div>
        <Button size="sm" onClick={() => setAddFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Add Form
        </Button>
      </div>

      {/* Webhook URL info */}
      <Card className="border-dashed">
        <CardContent className="p-3">
          <Label className="text-xs text-muted-foreground">Webhook URL</Label>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{webhookUrl}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(webhookUrl, "url")}>
              {copiedKey === "url" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Send leads to this URL with your webhook key as <code className="text-xs">?key=YOUR_KEY</code></p>
        </CardContent>
      </Card>

      {(!webhookKeys || webhookKeys.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No forms mapped yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Add Your First Form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhookKeys.map((wk: any) => (
            <Card key={wk.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-sm font-medium">{wk.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{wk.key}</code>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(wk.key, wk.id)}>
                          {copiedKey === wk.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={wk.is_active} onCheckedChange={(v) => toggleKey.mutate({ id: wk.id, is_active: v })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteKey.mutate(wk.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr,32px,1fr,32px] items-center gap-2 text-xs text-muted-foreground font-medium px-1">
                    <span>Source Field</span><span /><span>CRM Field</span><span />
                  </div>
                  {wk.webhook_field_mappings?.map((m: any) => (
                    <div key={m.id} className="grid grid-cols-[1fr,32px,1fr,32px] items-center gap-2">
                      <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">{m.source_field}</div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                      <Select value={m.target_field} onValueChange={(v) => updateMapping.mutate({ id: m.id, target_field: v })}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CRM_FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMapping.mutate(m.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr,32px,1fr,32px] items-center gap-2 pt-2">
                    <Input placeholder="field_name" value={newSourceField} onChange={(e) => setNewSourceField(e.target.value)} className="h-9 text-sm font-mono" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                    <Button variant="outline" size="sm" className="h-9" onClick={() => { if (newSourceField.trim()) addMapping.mutate({ webhookKeyId: wk.id, sourceField: newSourceField }); }}>
                      <Plus className="h-3 w-3 mr-1" />Add
                    </Button>
                    <div />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addFormOpen} onOpenChange={setAddFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Lead Form Mapping</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Form Name</Label>
              <Input value={newFormName} onChange={(e) => setNewFormName(e.target.value)} placeholder="e.g. Webinar Registration" />
            </div>
            <Button className="w-full" onClick={() => createWebhookKey.mutate()} disabled={createWebhookKey.isPending}>
              <Plus className="h-4 w-4 mr-2" />Create Webhook Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
