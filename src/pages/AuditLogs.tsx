import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, Clock, User, Database, Edit, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

const ACTION_ICONS: Record<string, any> = {
  INSERT: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
};

export default function AuditLogs() {
  const [entityFilter, setEntityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", entityFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: loginHistory } = useQuery({
    queryKey: ["login-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      const map: Record<string, string> = {};
      data?.forEach(p => { map[p.user_id] = p.full_name || "Unknown"; });
      return map;
    },
  });

  const filteredLogs = logs?.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.entity_type?.toLowerCase().includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      log.entity_id?.toLowerCase().includes(term)
    );
  });

  const entityTypes = [...new Set(logs?.map(l => l.entity_type) || [])];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Security & Audit Logs
        </h1>
        <p className="text-muted-foreground text-sm">Track all system changes and login activity</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Audit Logs */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" /> Change Log
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      className="h-8 w-40 pl-7 text-xs"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tables</SelectItem>
                      {entityTypes.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {filteredLogs?.map((log: any) => {
                  const ActionIcon = ACTION_ICONS[log.action] || Edit;
                  return (
                    <div key={log.id} className="flex items-start gap-3 border-b border-border pb-2 last:border-0">
                      <div className={`mt-1 p-1.5 rounded-full ${
                        log.action === "DELETE" ? "bg-destructive/10" :
                        log.action === "INSERT" ? "bg-green-500/10" : "bg-primary/10"
                      }`}>
                        <ActionIcon className={`h-3 w-3 ${
                          log.action === "DELETE" ? "text-destructive" :
                          log.action === "INSERT" ? "text-green-600" : "text-primary"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">{log.entity_type}</Badge>
                          <Badge
                            variant={log.action === "DELETE" ? "destructive" : log.action === "INSERT" ? "success" : "secondary"}
                            className="text-xs"
                          >
                            {log.action}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            by {profiles?.[log.user_id] || log.user_id?.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {(!filteredLogs || filteredLogs.length === 0) && !isLoading && (
                  <p className="text-sm text-muted-foreground text-center py-8">No audit logs found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* 2FA Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" /> Two-Factor Auth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-accent/50 border border-border p-4 text-center">
                <Shield className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">2FA Coming Soon</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Two-factor authentication will add an extra layer of security to your account
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Login History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Login History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {loginHistory?.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between text-xs border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="font-medium capitalize">{entry.event_type}</p>
                      <p className="text-muted-foreground">{entry.device_info || "Unknown device"}</p>
                    </div>
                    <span className="text-muted-foreground">
                      {format(new Date(entry.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                ))}
                {(!loginHistory || loginHistory.length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4">No login records yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total changes tracked</span>
                <span className="font-medium">{logs?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tables monitored</span>
                <span className="font-medium">{entityTypes.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Login sessions</span>
                <span className="font-medium">{loginHistory?.length || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
