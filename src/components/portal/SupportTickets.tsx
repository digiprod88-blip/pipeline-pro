import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { HelpCircle, Plus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SupportTicketsProps {
  contactId: string;
}

export function SupportTickets({ contactId }: SupportTicketsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: tickets } = useQuery({
    queryKey: ["support-tickets", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("support_tickets").insert({
        contact_id: contactId,
        user_id: user!.id,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setOpen(false);
      setSubject("");
      setMessage("");
      toast.success("Support ticket submitted!");
    },
  });

  const statusVariant = (s: string) => s === "open" ? "warning" : s === "resolved" ? "success" : "secondary";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />Support & Feedback
        </CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New Ticket
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {tickets?.map(ticket => (
          <div key={ticket.id} className="flex items-start justify-between py-2 border-b border-border last:border-0">
            <div className="flex items-start gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">{ticket.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{ticket.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(ticket.created_at), "MMM d, yyyy HH:mm")}
                </p>
              </div>
            </div>
            <Badge variant={statusVariant(ticket.status)} className="text-xs capitalize">
              {ticket.status}
            </Badge>
          </div>
        ))}
        {(!tickets || tickets.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No tickets yet. Need help? Create a ticket!</p>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
            </div>
            <div>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue or feedback..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createTicket.mutate()} disabled={!subject.trim() || !message.trim()}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
