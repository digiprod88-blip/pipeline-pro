import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Plus, Trash2, Webhook, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function WebhooksSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/webhook-lead`;

  const { data: webhookKeys, isLoading } = useQuery({
    queryKey: ["webhook-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_keys")
        .select("*, pipelines(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pipelines } = useQuery({
    queryKey: ["pipelines-for-webhook"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipelines").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const createKey = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Enter a name for the webhook");
      const { error } = await supabase.from("webhook_keys").insert({
        user_id: user!.id,
        name: newName.trim(),
        pipeline_id: selectedPipeline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-keys"] });
      setNewName("");
      setSelectedPipeline("");
      toast.success("Webhook key created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-keys"] });
      toast.success("Webhook key deleted");
    },
  });

  const toggleKey = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("webhook_keys").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-keys"] });
      toast.success("Webhook updated");
    },
  });

  const copyUrl = (key: string) => {
    navigator.clipboard.writeText(`${baseUrl}?key=${key}`);
    toast.success("Webhook URL copied!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Inbound Webhooks (API)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How it works</p>
            <p>Generate a unique Webhook URL below. Use it in <strong>Pabbly Connect</strong>, <strong>Zapier</strong>, <strong>Make</strong>, or any platform that sends POST requests.</p>
            <p>When a lead comes in via the webhook, it's automatically added to your Contacts & Pipeline.</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Expected POST Body</h3>
            <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "name": "John Doe",        // or first_name + last_name
  "email": "john@example.com",
  "phone": "+919876543210",
  "source": "facebook",      // optional
  "company": "Acme Inc",     // optional
  "value": 5000,             // optional deal value
  "tags": ["webinar", "hot"] // optional
}`}
            </pre>
          </div>

          {/* Create new webhook key */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Create New Webhook</h3>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Webhook name (e.g. Facebook Leads)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="max-w-xs"
              />
              <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Assign pipeline..." />
                </SelectTrigger>
                <SelectContent>
                  {pipelines?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => createKey.mutate()} disabled={createKey.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Generate
              </Button>
            </div>
          </div>

          {/* Existing webhook keys */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Your Webhook Endpoints</h3>
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {webhookKeys?.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No webhook keys yet. Create one above.</p>
            )}
            {webhookKeys?.map((wk) => (
              <div key={wk.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{wk.name}</span>
                    <Badge variant={wk.is_active ? "default" : "secondary"} className="text-[10px]">
                      {wk.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {(wk as any).pipelines?.name && (
                      <Badge variant="outline" className="text-[10px]">{(wk as any).pipelines.name}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleKey.mutate({ id: wk.id, active: !wk.is_active })}
                    >
                      {wk.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteKey.mutate(wk.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                    {baseUrl}?key={wk.key}
                  </code>
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyUrl(wk.key)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Field Mapping</p>
            <p>If your external platform sends different field names (e.g. <code>full_name</code> instead of <code>name</code>), configure custom field mappings in the <strong>Leads</strong> tab.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
