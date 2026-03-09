import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Variable, Info } from "lucide-react";

interface DynamicVariable {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export function DynamicVariables() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ key: "", value: "", description: "" });

  const { data: variables = [], isLoading } = useQuery({
    queryKey: ["dynamic-variables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_variables")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as DynamicVariable[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const key = values.key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const { error } = await supabase.from("dynamic_variables").insert({
        user_id: user!.id,
        key,
        value: values.value,
        description: values.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-variables"] });
      setDialogOpen(false);
      setForm({ key: "", value: "", description: "" });
      toast.success("Variable created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from("dynamic_variables")
        .update({ value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-variables"] });
      toast.success("Variable updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dynamic_variables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-variables"] });
      toast.success("Variable deleted");
    },
  });

  const copyToken = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    toast.success(`Copied {{${key}}} to clipboard`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Variable className="h-4 w-4" />
              Dynamic Variables
            </CardTitle>
            <CardDescription className="mt-1">
              Create reusable tokens like {"{{webinar_date}}"} for landing pages and messages
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Variable
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Dynamic Variable</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Variable Key</Label>
                  <Input
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value })}
                    placeholder="webinar_date"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use in content as: {"{{" + (form.key || "key") + "}}"}
                  </p>
                </div>
                <div>
                  <Label>Value</Label>
                  <Input
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder="March 15, 2026"
                  />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Date of the upcoming webinar"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.key || !form.value || createMutation.isPending}
                >
                  Create Variable
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : variables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Variable className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No variables yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {variables.map((variable) => (
              <div
                key={variable.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {`{{${variable.key}}}`}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToken(variable.key)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    value={variable.value}
                    onChange={(e) => updateMutation.mutate({ id: variable.id, value: e.target.value })}
                    className="h-8 text-sm"
                    onBlur={() => {}}
                  />
                  {variable.description && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {variable.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-destructive shrink-0"
                  onClick={() => deleteMutation.mutate(variable.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <p className="font-medium mb-1">How to use:</p>
          <p>Insert {"{{variable_key}}"} anywhere in your landing pages or message templates. The token will be replaced with the variable's current value.</p>
        </div>
      </CardContent>
    </Card>
  );
}
