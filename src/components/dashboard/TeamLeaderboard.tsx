import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, TrendingUp, Medal } from "lucide-react";

interface StaffStat {
  userId: string;
  name: string;
  totalLeads: number;
  converted: number;
  conversionRate: number;
  avgResponseMin: number;
}

export default function TeamLeaderboard() {
  const { data: profiles } = useQuery({
    queryKey: ["team-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["team-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, user_id, status, created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["team-first-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("user_id, contact_id, created_at, direction")
        .eq("direction", "outbound")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const stats: StaffStat[] = (() => {
    if (!profiles || !contacts) return [];
    const staffIds = [...new Set(contacts.map((c) => c.user_id))];

    return staffIds.map((uid) => {
      const profile = profiles.find((p) => p.user_id === uid);
      const userContacts = contacts.filter((c) => c.user_id === uid);
      const totalLeads = userContacts.length;
      const converted = userContacts.filter((c) => c.status === "customer").length;
      const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;

      // Calculate avg response time
      let totalResponseMin = 0;
      let responseCount = 0;
      if (messages) {
        userContacts.forEach((contact) => {
          const firstMsg = messages.find((m) => m.contact_id === contact.id && m.user_id === uid);
          if (firstMsg) {
            const diff = (new Date(firstMsg.created_at).getTime() - new Date(contact.created_at).getTime()) / 60000;
            if (diff >= 0 && diff < 1440) {
              totalResponseMin += diff;
              responseCount++;
            }
          }
        });
      }
      const avgResponseMin = responseCount > 0 ? Math.round(totalResponseMin / responseCount) : -1;

      return {
        userId: uid,
        name: profile?.full_name || "Team Member",
        totalLeads,
        converted,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgResponseMin,
      };
    }).sort((a, b) => b.conversionRate - a.conversionRate);
  })();

  const medalColors = ["text-yellow-500", "text-gray-400", "text-amber-700"];

  if (stats.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" /> Team Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.slice(0, 5).map((s, i) => (
          <div key={s.userId} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <div className="w-6 text-center">
              {i < 3 ? <Medal className={`h-4 w-4 mx-auto ${medalColors[i]}`} /> : <span className="text-xs text-muted-foreground">{i + 1}</span>}
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium shrink-0">
              {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.totalLeads} leads · {s.converted} converted</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {s.avgResponseMin >= 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Clock className="h-3 w-3" /> {s.avgResponseMin}m
                </Badge>
              )}
              <Badge variant={s.conversionRate >= 20 ? "success" : "secondary"} className="text-xs gap-1">
                <TrendingUp className="h-3 w-3" /> {s.conversionRate}%
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
