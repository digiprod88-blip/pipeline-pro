import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Phone, Mail, Calendar, MessageSquare, Tag, Send } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface ContactTimelineProps {
  contactId: string;
}

export function ContactTimeline({ contactId }: ContactTimelineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [activityType, setActivityType] = useState("note");

  const { data: activities } = useQuery({
    queryKey: ["contact-activities", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, profiles:user_id(full_name)")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("activities").insert({
        user_id: user.id,
        contact_id: contactId,
        type: activityType,
        description: noteText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-activities", contactId] });
      setNoteText("");
      toast.success("Activity added");
    },
    onError: (e) => toast.error(e.message),
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

  return (
    <>
      {/* Add Activity */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2 mb-3">
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
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
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note or log an activity..." className="min-h-[60px]" />
            <Button size="icon" onClick={() => addActivity.mutate()} disabled={!noteText.trim()} className="shrink-0 self-end">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />Activity Timeline
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
    </>
  );
}
