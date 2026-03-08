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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneIncoming, PhoneOutgoing, Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CallManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    contact_id: "", direction: "outbound", duration_seconds: 0, status: "completed", notes: "",
  });

  const { data: callLogs } = useQuery({
    queryKey: ["call-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("call_logs").select("*, contacts(first_name, last_name, phone)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-calls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, first_name, last_name, phone").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const logCall = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("call_logs").insert({
        user_id: user!.id,
        contact_id: form.contact_id || null,
        direction: form.direction,
        duration_seconds: form.duration_seconds,
        status: form.status,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-logs"] });
      setOpen(false);
      setForm({ contact_id: "", direction: "outbound", duration_seconds: 0, status: "completed", notes: "" });
      toast.success("Call logged!");
    },
  });

  const deleteCall = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("call_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-logs"] });
      toast.success("Call log deleted");
    },
  });

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalCalls = callLogs?.length || 0;
  const inbound = callLogs?.filter(c => c.direction === "inbound").length || 0;
  const outbound = callLogs?.filter(c => c.direction === "outbound").length || 0;
  const totalDuration = callLogs?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Call Management</h1>
          <p className="text-muted-foreground text-sm">Track and log all phone calls</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Log Call</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log a Call</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Contact</Label>
                <Select value={form.contact_id} onValueChange={v => setForm({ ...form, contact_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    {contacts?.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.phone ? `(${c.phone})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Direction</Label>
                  <Select value={form.direction} onValueChange={v => setForm({ ...form, direction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="missed">Missed</SelectItem>
                      <SelectItem value="voicemail">Voicemail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Duration (seconds)</Label>
                <Input type="number" min={0} value={form.duration_seconds} onChange={e => setForm({ ...form, duration_seconds: parseInt(e.target.value) || 0 })} />
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Call summary..." /></div>
              <Button className="w-full" onClick={() => logCall.mutate()} disabled={logCall.isPending}>Log Call</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{totalCalls}</p><p className="text-xs text-muted-foreground">Total Calls</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{inbound}</p><p className="text-xs text-muted-foreground">Inbound</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{outbound}</p><p className="text-xs text-muted-foreground">Outbound</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{formatDuration(totalDuration)}</p><p className="text-xs text-muted-foreground">Total Duration</p></CardContent></Card>
      </div>

      {/* Call Log List */}
      <Card>
        <CardHeader><CardTitle>Recent Calls</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {callLogs?.map((call: any) => (
            <div key={call.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                {call.direction === "inbound" ? <PhoneIncoming className="h-4 w-4 text-success" /> : <PhoneOutgoing className="h-4 w-4 text-primary" />}
                <div>
                  <p className="text-sm font-medium">{call.contacts ? `${call.contacts.first_name} ${call.contacts.last_name}` : "Unknown"}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{call.direction}</span>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatDuration(call.duration_seconds || 0)}</span>
                    <span>•</span>
                    <span>{format(new Date(call.created_at), "MMM d, HH:mm")}</span>
                  </div>
                  {call.notes && <p className="text-xs text-muted-foreground mt-1">{call.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={call.status === "completed" ? "success" : call.status === "missed" ? "destructive" : "secondary"} className="capitalize text-xs">{call.status}</Badge>
                <Button variant="ghost" size="sm" onClick={() => deleteCall.mutate(call.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          {(!callLogs || callLogs.length === 0) && (
            <div className="text-center py-8">
              <Phone className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No call logs yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
