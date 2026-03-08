import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Mail, Phone, Send, Instagram, FileText } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface UnifiedInboxProps {
  contactId: string;
}

export function UnifiedInbox({ contactId }: UnifiedInboxProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [activeTab, setActiveTab] = useState("all");

  const { data: messages } = useQuery({
    queryKey: ["messages", contactId, activeTab],
    queryFn: async () => {
      let query = supabase
        .from("messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (activeTab !== "all") {
        query = query.eq("channel", activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const { data: templates } = useQuery({
    queryKey: ["message-templates", channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("channel", channel)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("messages").insert({
        contact_id: contactId,
        user_id: user.id,
        channel,
        direction: "outbound",
        content: messageText.trim(),
      });
      if (error) throw error;

      // Also log as activity
      await supabase.from("activities").insert({
        contact_id: contactId,
        user_id: user.id,
        type: channel,
        description: messageText.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", contactId] });
      queryClient.invalidateQueries({ queryKey: ["contact-activities", contactId] });
      setMessageText("");
      toast.success(`${channel} message logged`);
    },
    onError: (e) => toast.error(e.message),
  });

  const channelIcon = (ch: string) => {
    switch (ch) {
      case "whatsapp": return <MessageSquare className="h-3.5 w-3.5" />;
      case "email": return <Mail className="h-3.5 w-3.5" />;
      case "instagram": return <Instagram className="h-3.5 w-3.5" />;
      case "sms": return <Phone className="h-3.5 w-3.5" />;
      default: return <FileText className="h-3.5 w-3.5" />;
    }
  };

  const channelColor = (ch: string) => {
    switch (ch) {
      case "whatsapp": return "bg-success/10 text-success";
      case "email": return "bg-info/10 text-info";
      case "instagram": return "bg-destructive/10 text-destructive";
      case "sms": return "bg-warning/10 text-warning";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Unified Inbox
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Send Message */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
            {templates && templates.length > 0 && (
              <Select onValueChange={(val) => {
                const tpl = templates.find((t) => t.id === val);
                if (tpl) setMessageText(tpl.content);
              }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Use template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`Type your ${channel} message...`}
              className="min-h-[60px]"
            />
            <Button
              size="icon"
              onClick={() => sendMessage.mutate()}
              disabled={!messageText.trim()}
              className="shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages Timeline */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1">WhatsApp</TabsTrigger>
            <TabsTrigger value="email" className="flex-1">Email</TabsTrigger>
            <TabsTrigger value="instagram" className="flex-1">Instagram</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-3">
            <div className="space-y-3">
              {messages?.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex gap-3 ${msg.direction === "outbound" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${channelColor(msg.channel)}`}>
                    {channelIcon(msg.channel)}
                  </div>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    <p>{msg.content}</p>
                    <div className={`flex items-center gap-2 mt-1 ${msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize border-current/20">
                        {msg.channel}
                      </Badge>
                      <span className="text-[10px]">
                        {format(new Date(msg.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
              {(!messages || messages.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">No messages yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
