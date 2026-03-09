import { useState, useEffect, useRef } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages", contactId, activeTab],
    queryFn: async () => {
      let query = supabase
        .from("messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: true });

      if (activeTab !== "all") query = query.eq("channel", activeTab);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  // Realtime subscription for messages
  useEffect(() => {
    const msgChannel = supabase
      .channel(`messages-${contactId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `contact_id=eq.${contactId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", contactId] });
      })
      .subscribe();

    // Also listen for whatsapp session changes
    const waChannel = supabase
      .channel(`wa-sessions-${contactId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_sessions",
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", contactId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(waChannel);
    };
  }, [contactId, queryClient]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const { data: templates } = useQuery({
    queryKey: ["message-templates", channel],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_templates").select("*").eq("channel", channel).order("name");
      if (error) throw error;
      return data;
    },
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("messages").insert({
        contact_id: contactId, user_id: user.id, channel, direction: "outbound", content: messageText.trim(),
      });
      if (error) throw error;
      await supabase.from("activities").insert({
        contact_id: contactId, user_id: user.id, type: channel, description: messageText.trim(),
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
    const icons: Record<string, JSX.Element> = {
      whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
      email: <Mail className="h-3.5 w-3.5" />,
      instagram: <Instagram className="h-3.5 w-3.5" />,
      sms: <Phone className="h-3.5 w-3.5" />,
    };
    return icons[ch] || <FileText className="h-3.5 w-3.5" />;
  };

  const channelColor = (ch: string) => {
    const colors: Record<string, string> = {
      whatsapp: "bg-success/10 text-success",
      email: "bg-info/10 text-info",
      instagram: "bg-destructive/10 text-destructive",
      sms: "bg-warning/10 text-warning",
    };
    return colors[ch] || "bg-secondary text-secondary-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Unified Inbox
          <Badge variant="outline" className="text-[10px] ml-auto">{messages?.length ?? 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages Timeline */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1">WhatsApp</TabsTrigger>
            <TabsTrigger value="email" className="flex-1">Email</TabsTrigger>
            <TabsTrigger value="instagram" className="flex-1">IG</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-3">
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {messages?.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 ${msg.direction === "outbound" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${channelColor(msg.channel)}`}>
                      {channelIcon(msg.channel)}
                    </div>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                      <p className="text-[13px]">{msg.content}</p>
                      <div className={`flex items-center gap-2 mt-1 ${msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        <span className="text-[10px] capitalize">{msg.channel}</span>
                        <span className="text-[10px]">{format(new Date(msg.created_at), "h:mm a")}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {(!messages || messages.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">No messages yet</p>
              )}
              <div ref={bottomRef} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Send Message */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-[120px] h-9 text-xs">
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
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Template..." />
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
              placeholder={`Type ${channel} message...`}
              className="min-h-[50px] text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && messageText.trim()) { e.preventDefault(); sendMessage.mutate(); } }}
            />
            <Button size="icon" onClick={() => sendMessage.mutate()} disabled={!messageText.trim()} className="shrink-0 self-end">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
