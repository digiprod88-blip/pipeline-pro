import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Mail, Phone, Building, Calendar, DollarSign, Tag, TrendingUp, MessageSquare, Activity } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { UnifiedInbox } from "@/components/contacts/UnifiedInbox";
import { ContactTimeline } from "@/components/contacts/ContactTimeline";
import LeadScoreBadge from "@/components/dashboard/LeadScoreBadge";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contact } = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, pipeline_stages(name, color)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contactTasks } = useQuery({
    queryKey: ["contact-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("contact_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: scoreBreakdown } = useQuery({
    queryKey: ["score-breakdown", id],
    queryFn: async () => {
      const [{ count: activityCount }, { count: messageCount }, { count: inboundCount }] = await Promise.all([
        supabase.from("activities").select("*", { count: "exact", head: true }).eq("contact_id", id!),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", id!),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", id!).eq("direction", "inbound"),
      ]);
      return {
        activities: activityCount ?? 0,
        messages: messageCount ?? 0,
        inbound: inboundCount ?? 0,
      };
    },
    enabled: !!id,
  });

  const { data: userRole } = useQuery({
    queryKey: ["my-role-detail", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("user_roles").select("hide_phone").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const updateQuality = useMutation({
    mutationFn: async (quality: string) => {
      const { error } = await supabase.from("contacts").update({ quality: quality as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-detail", id] });
      toast.success("Quality updated");
    },
  });

  if (!contact) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const hidePhone = userRole?.hide_phone ?? false;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold ${contact.status === "customer" ? "bg-success/10 text-success" : "bg-secondary text-foreground"}`}>
            {contact.first_name[0]}{contact.last_name?.[0] ?? ""}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{contact.first_name} {contact.last_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <LeadScoreBadge score={contact.lead_score ?? 0} />
              <Badge variant={contact.status === "customer" ? "success" : "secondary"} className="capitalize">{contact.status}</Badge>
              {contact.quality && (
                <Badge variant={contact.quality === "hot" ? "hot" : contact.quality === "warm" ? "warm" : "cold"} className="capitalize">{contact.quality}</Badge>
              )}
              {contact.pipeline_stages && <Badge variant="outline">{(contact.pipeline_stages as any).name}</Badge>}
            </div>
          </div>
        </div>
        <Select value={contact.quality ?? "cold"} onValueChange={(val) => updateQuality.mutate(val)}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Quality" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info Column */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Contact Info</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {contact.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{contact.email}</span></div>}
              {contact.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{hidePhone ? "••••••••••" : contact.phone}</span></div>}
              {contact.company && <div className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" /><span>{contact.company}</span></div>}
              {contact.value && Number(contact.value) > 0 && <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span>${Number(contact.value).toLocaleString()}</span></div>}
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>Added {format(new Date(contact.created_at), "MMM d, yyyy")}</span></div>
              {contact.source && <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" /><span>Source: {contact.source}</span></div>}
            </CardContent>
          </Card>

          {contact.notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{contact.notes}</p></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Tasks ({contactTasks?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {contactTasks?.map((task) => (
                <div key={task.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                  <span className={task.status === "completed" ? "line-through text-muted-foreground" : ""}>{task.title}</span>
                  <Badge variant={task.status === "completed" ? "success" : "outline"} className="text-xs capitalize">{task.status}</Badge>
                </div>
              ))}
              {(!contactTasks || contactTasks.length === 0) && <p className="text-xs text-muted-foreground">No tasks</p>}
            </CardContent>
          </Card>
        </div>

        {/* Timeline & Inbox Column */}
        <div className="lg:col-span-2 space-y-4">
          <UnifiedInbox contactId={id!} />
          <ContactTimeline contactId={id!} />
        </div>
      </div>
    </div>
  );
}
