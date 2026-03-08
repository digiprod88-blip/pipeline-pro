import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Calendar,
  DollarSign,
  MessageSquare,
  Tag,
  Activity,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [activityType, setActivityType] = useState("note");

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

  const { data: activities } = useQuery({
    queryKey: ["contact-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, profiles:user_id(full_name)")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contactTasks } = useQuery({
    queryKey: ["contact-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("contact_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: userRole } = useQuery({
    queryKey: ["my-role-detail", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("hide_phone")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error("Missing data");
      const { error } = await supabase.from("activities").insert({
        user_id: user.id,
        contact_id: id,
        type: activityType,
        description: noteText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-activities", id] });
      setNoteText("");
      toast.success("Activity added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateQuality = useMutation({
    mutationFn: async (quality: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ quality: quality as any })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-detail", id] });
      toast.success("Quality updated");
    },
  });

  const activityIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "meeting": return <Calendar className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      case "stage_change": return <Tag className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (!contact) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const hidePhone = userRole?.hide_phone ?? false;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />Back
      </Button>

      {/* Contact Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold ${contact.status === "customer" ? "bg-success/10 text-success" : "bg-secondary text-foreground"}`}>
            {contact.first_name[0]}{contact.last_name?.[0] ?? ""}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{contact.first_name} {contact.last_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={contact.status === "customer" ? "success" : "secondary"} className="capitalize">
                {contact.status}
              </Badge>
              {contact.quality && (
                <Badge
                  variant={contact.quality === "hot" ? "hot" : contact.quality === "warm" ? "warm" : "cold"}
                  className="capitalize"
                >
                  {contact.quality}
                </Badge>
              )}
              {contact.pipeline_stages && (
                <Badge variant="outline">{(contact.pipeline_stages as any).name}</Badge>
              )}
            </div>
          </div>
        </div>
        <Select value={contact.quality ?? "cold"} onValueChange={(val) => updateQuality.mutate(val)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Quality" />
          </SelectTrigger>
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
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{hidePhone ? "••••••••••" : contact.phone}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.company}</span>
                </div>
              )}
              {contact.value && Number(contact.value) > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>${Number(contact.value).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Added {format(new Date(contact.created_at), "MMM d, yyyy")}</span>
              </div>
              {contact.source && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span>Source: {contact.source}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {contact.notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{contact.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Tasks for this contact */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Tasks ({contactTasks?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {contactTasks?.map((task) => (
                <div key={task.id} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                  <span className={task.status === "completed" ? "line-through text-muted-foreground" : ""}>{task.title}</span>
                  <Badge variant={task.status === "completed" ? "success" : "outline"} className="text-xs capitalize">{task.status}</Badge>
                </div>
              ))}
              {(!contactTasks || contactTasks.length === 0) && (
                <p className="text-xs text-muted-foreground">No tasks</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add Activity */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2 mb-3">
                <Select value={activityType} onValueChange={setActivityType}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note or log an activity..."
                  className="min-h-[60px]"
                />
                <Button
                  size="icon"
                  onClick={() => addActivity.mutate()}
                  disabled={!noteText.trim()}
                  className="shrink-0 self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4">
                  {activities?.map((activity, i) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-4 relative"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary z-10">
                        {activityIcon(activity.type)}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs capitalize">{activity.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(activity.created_at), "MMM d, yyyy h:mm a")}
                          </span>
                          {activity.profiles && (
                            <span className="text-xs text-muted-foreground">
                              by {(activity.profiles as any).full_name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{activity.description}</p>
                      </div>
                    </motion.div>
                  ))}
                  {(!activities || activities.length === 0) && (
                    <p className="text-sm text-muted-foreground ml-10">No activity recorded yet.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
