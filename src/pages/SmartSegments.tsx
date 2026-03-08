import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Download, Trash2, Filter, Users, Zap, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

const FIELDS = [
  { value: "quality", label: "Lead Quality" },
  { value: "status", label: "Status" },
  { value: "source", label: "Source" },
  { value: "lead_score", label: "Lead Score" },
  { value: "company", label: "Company" },
  { value: "tags", label: "Tags" },
];

const OPERATORS = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "gt", label: "Greater Than" },
  { value: "lt", label: "Less Than" },
];

export default function SmartSegments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<SegmentRule[]>([{ field: "quality", operator: "eq", value: "hot" }]);
  const [autoTag, setAutoTag] = useState("");
  const [messageContent, setMessageContent] = useState("Hi {{name}}, ");
  const [messageChannel, setMessageChannel] = useState("whatsapp");

  const { data: segments } = useQuery({
    queryKey: ["dynamic-segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_segments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["all-contacts-segments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createSegment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dynamic_segments").insert({
        user_id: user!.id,
        name: name.trim(),
        description: description.trim() || null,
        rules: rules as any,
        auto_tag: autoTag.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-segments"] });
      setCreateOpen(false);
      resetForm();
      toast.success("Segment created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dynamic_segments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-segments"] });
      toast.success("Segment deleted");
    },
  });

  const sendSegmentMessage = useMutation({
    mutationFn: async () => {
      if (!selectedSegment) return;
      const segRules = (selectedSegment.rules as any as SegmentRule[]) || [];
      const matched = matchContacts(segRules);
      const contactIds = matched.map((c) => c.id);

      if (contactIds.length === 0) throw new Error("No contacts match this segment");

      const { data, error } = await supabase.functions.invoke("segment-message", {
        body: {
          segment_id: selectedSegment.id,
          template_content: messageContent,
          contact_ids: contactIds,
          channel: messageChannel,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setMessageOpen(false);
      setMessageContent("Hi {{name}}, ");
      toast.success(`${data?.sent || 0} messages sent, ${data?.failed || 0} failed`);
    },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setRules([{ field: "quality", operator: "eq", value: "hot" }]);
    setAutoTag("");
  };

  const matchContacts = (segmentRules: SegmentRule[]) => {
    if (!contacts) return [];
    return contacts.filter((contact) =>
      segmentRules.every((rule) => {
        const val = (contact as any)[rule.field];
        if (rule.operator === "eq") return String(val) === rule.value;
        if (rule.operator === "neq") return String(val) !== rule.value;
        if (rule.operator === "contains") return String(val || "").toLowerCase().includes(rule.value.toLowerCase());
        if (rule.operator === "gt") return Number(val) > Number(rule.value);
        if (rule.operator === "lt") return Number(val) < Number(rule.value);
        return true;
      })
    );
  };

  const exportForMeta = (segmentRules: SegmentRule[]) => {
    const matched = matchContacts(segmentRules);
    const csv = [
      "email,phone,fn,ln,country",
      ...matched.map((c) =>
        [c.email || "", c.phone || "", c.first_name, c.last_name || "", ""].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meta-custom-audience.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${matched.length} contacts for Meta Ads`);
  };

  const openMessageDialog = (segment: any) => {
    setSelectedSegment(segment);
    setMessageOpen(true);
  };

  const addRule = () => setRules([...rules, { field: "status", operator: "eq", value: "lead" }]);
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, key: keyof SegmentRule, val: string) => {
    const updated = [...rules];
    updated[i] = { ...updated[i], [key]: val };
    setRules(updated);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Smart Segments</h1>
          <p className="text-sm text-muted-foreground">Create dynamic audience segments for targeted campaigns</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Segment
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {segments?.map((segment) => {
          const segRules = (segment.rules as any as SegmentRule[]) || [];
          const matchCount = matchContacts(segRules).length;
          return (
            <Card key={segment.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{segment.name}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openMessageDialog(segment)}
                      title="Send Message"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => exportForMeta(segRules)}
                      title="Export for Meta Ads"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteSegment.mutate(segment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {segment.description && <p className="text-xs text-muted-foreground">{segment.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {segRules.map((rule, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      <Filter className="h-2.5 w-2.5 mr-1" />
                      {rule.field} {rule.operator} {rule.value}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">{matchCount} contacts match</Badge>
                  {segment.auto_tag && (
                    <Badge className="text-xs gap-1">
                      <Zap className="h-2.5 w-2.5" /> {segment.auto_tag}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {(!segments || segments.length === 0) && (
          <p className="text-muted-foreground col-span-full text-center py-8">
            No segments yet. Create dynamic segments for targeted campaigns.
          </p>
        )}
      </div>

      {/* Create Segment Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Dynamic Segment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Segment Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Hot Leads from Kerala" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this segment..." />
            </div>
            <div className="space-y-2">
              <Label>Rules</Label>
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={rule.field} onValueChange={(v) => updateRule(i, "field", v)}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={rule.operator} onValueChange={(v) => updateRule(i, "operator", v)}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="flex-1" value={rule.value} onChange={(e) => updateRule(i, "value", e.target.value)} placeholder="Value" />
                  {rules.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRule(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRule}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Auto-Tag (optional)</Label>
              <Input value={autoTag} onChange={(e) => setAutoTag(e.target.value)} placeholder="e.g., highly-engaged" />
              <p className="text-xs text-muted-foreground">Contacts matching this segment will be auto-tagged</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createSegment.mutate()} disabled={!name.trim() || rules.length === 0}>
              Create Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Send Message to Segment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSegment && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium">{selectedSegment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {matchContacts((selectedSegment.rules as any as SegmentRule[]) || []).length} contacts will receive this message
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={messageChannel} onValueChange={setMessageChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message Template</Label>
              <Textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Hi {{name}}, ..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="text-xs bg-muted px-1 rounded">{"{{name}}"}</code> for personalization. Messages are sent with throttling.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sendSegmentMessage.mutate()}
              disabled={!messageContent.trim() || sendSegmentMessage.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendSegmentMessage.isPending ? "Sending..." : "Send Messages"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
