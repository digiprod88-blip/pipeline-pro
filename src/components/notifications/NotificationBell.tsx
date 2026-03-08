import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const typeColors: Record<string, string> = {
    lead: "bg-info/10 text-info",
    payment: "bg-success/10 text-success",
    task: "bg-warning/10 text-warning",
    system: "bg-muted text-muted-foreground",
    info: "bg-secondary text-secondary-foreground",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllRead.mutate()}>
              <Check className="h-3 w-3 mr-1" />Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[350px]">
          {notifications?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
          )}
          {notifications?.map((n) => (
            <div
              key={n.id}
              className={`flex gap-3 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-accent/50 transition-colors ${!n.is_read ? "bg-accent/20" : ""}`}
              onClick={() => {
                if (!n.is_read) markRead.mutate(n.id);
                if (n.link) { navigate(n.link); setOpen(false); }
              }}
            >
              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${typeColors[n.type] || typeColors.info}`}>
                {n.type === "lead" ? "L" : n.type === "payment" ? "$" : n.type === "task" ? "T" : "i"}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.is_read ? "font-medium" : ""}`}>{n.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {n.link && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />}
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
