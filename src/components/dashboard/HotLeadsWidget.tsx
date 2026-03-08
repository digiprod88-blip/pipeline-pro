import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function HotLeadsWidget() {
  const { data: hotLeads } = useQuery({
    queryKey: ["hot-leads-priority"],
    queryFn: async () => {
      // Get contacts with high scores, ordered by score desc
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company, lead_score, quality, value, updated_at")
        .order("lead_score", { ascending: false })
        .limit(10);
      if (error) throw error;

      // For each contact, check last message/activity time
      const enriched = await Promise.all(
        (contacts || []).map(async (c) => {
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("created_at")
            .eq("contact_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const lastContact = lastMsg?.[0]?.created_at;
          const hoursSinceContact = lastContact
            ? (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60)
            : 999;

          return { ...c, lastContact, hoursSinceContact };
        })
      );

      // Filter: score > 0 and not contacted in last 24h
      return enriched
        .filter((c) => c.lead_score > 0 && c.hoursSinceContact > 24)
        .slice(0, 5);
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-destructive";
    if (score >= 40) return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-destructive" />
          Priority Leads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(!hotLeads || hotLeads.length === 0) && (
          <p className="text-sm text-muted-foreground">All leads are up to date ✓</p>
        )}
        {hotLeads?.map((lead) => (
          <div key={lead.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-xs font-bold">
                <span className={getScoreColor(lead.lead_score)}>{lead.lead_score}</span>
              </div>
              <div>
                <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
                {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {lead.lastContact
                  ? formatDistanceToNow(new Date(lead.lastContact), { addSuffix: true })
                  : "Never"}
              </div>
              <Badge variant={lead.quality === "hot" ? "hot" : lead.quality === "warm" ? "warm" : "cold"} className="text-xs capitalize">
                {lead.quality}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
