import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  Users, DollarSign, TrendingUp, CheckSquare, AlertCircle, Clock, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isFuture, isToday, subDays } from "date-fns";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import HotLeadsWidget from "@/components/dashboard/HotLeadsWidget";
import LeadScoreBadge from "@/components/dashboard/LeadScoreBadge";

function StatCard({ title, value, icon: Icon, description, delay = 0 }: {
  title: string; value: string | number; icon: React.ElementType; description?: string; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const QUALITY_COLORS = { hot: "hsl(var(--hot))", warm: "hsl(var(--warm))", cold: "hsl(var(--cold))" };

export default function Dashboard() {
  const { user } = useAuth();

  const { data: contacts } = useQuery({
    queryKey: ["contacts-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*, contacts(first_name, last_name)");
      if (error) throw error;
      return data;
    },
  });

  const totalLeads = contacts?.filter((c) => c.status === "lead").length ?? 0;
  const totalCustomers = contacts?.filter((c) => c.status === "customer").length ?? 0;
  const pipelineValue = contacts?.reduce((sum, c) => sum + (Number(c.value) || 0), 0) ?? 0;
  const hotLeads = contacts?.filter((c) => c.quality === "hot").length ?? 0;

  const overdueTasks = tasks?.filter((t) => t.status !== "completed" && t.due_date && isPast(new Date(t.due_date))) ?? [];
  const upcomingTasks = tasks?.filter((t) => t.status !== "completed" && t.due_date && (isFuture(new Date(t.due_date)) || isToday(new Date(t.due_date)))) ?? [];

  // Lead trend data (last 14 days)
  const trendData = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dayStr = format(date, "MMM d");
    const count = contacts?.filter((c) => format(new Date(c.created_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")).length ?? 0;
    const value = contacts?.filter((c) => format(new Date(c.created_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")).reduce((s, c) => s + (Number(c.value) || 0), 0) ?? 0;
    return { name: dayStr, leads: count, value };
  });

  // Quality pie data
  const qualityData = [
    { name: "Hot", value: contacts?.filter((c) => c.quality === "hot").length ?? 0, color: QUALITY_COLORS.hot },
    { name: "Warm", value: contacts?.filter((c) => c.quality === "warm").length ?? 0, color: QUALITY_COLORS.warm },
    { name: "Cold", value: contacts?.filter((c) => c.quality === "cold").length ?? 0, color: QUALITY_COLORS.cold },
  ].filter((d) => d.value > 0);

  const conversionRate = contacts && contacts.length > 0 ? ((totalCustomers / contacts.length) * 100).toFixed(1) : "0";

  const getTaskColor = (task: any) => {
    if (task.status === "completed") return "success" as const;
    if (task.due_date && isPast(new Date(task.due_date))) return "destructive" as const;
    return "warning" as const;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your CRM activity</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Leads" value={totalLeads} icon={Users} description={`${hotLeads} hot leads`} delay={0} />
        <StatCard title="Customers" value={totalCustomers} icon={TrendingUp} description={`${conversionRate}% conversion`} delay={0.05} />
        <StatCard title="Pipeline Value" value={`$${pipelineValue.toLocaleString()}`} icon={DollarSign} delay={0.1} />
        <StatCard title="Open Tasks" value={overdueTasks.length + upcomingTasks.length} icon={CheckSquare} description={`${overdueTasks.length} overdue`} delay={0.15} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Lead Acquisition & Pipeline Value</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="leads" stroke="hsl(var(--primary))" fill="url(#leadGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="h-full">
            <CardHeader><CardTitle className="text-base">Lead Quality</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              {qualityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={qualityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4}>
                      {qualityData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8">No data yet</p>
              )}
              <div className="space-y-2 ml-2">
                {qualityData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Priority Leads */}
      <HotLeadsWidget />

      {/* Follow-ups & Recent Leads */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Follow-ups</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[...overdueTasks, ...upcomingTasks].slice(0, 8).length === 0 && (
              <p className="text-sm text-muted-foreground">No pending follow-ups</p>
            )}
            {[...overdueTasks, ...upcomingTasks].slice(0, 8).map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  {task.due_date && isPast(new Date(task.due_date)) ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Clock className="h-4 w-4 text-warning" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.contacts && (
                      <p className="text-xs text-muted-foreground">
                        {(task.contacts as any).first_name} {(task.contacts as any).last_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {task.due_date && <span className="text-xs text-muted-foreground">{format(new Date(task.due_date), "MMM d")}</span>}
                  <Badge variant={getTaskColor(task)} className="text-xs">
                    {task.due_date && isPast(new Date(task.due_date)) ? "Overdue" : "Upcoming"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Leads</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(!contacts || contacts.length === 0) && (
              <p className="text-sm text-muted-foreground">No contacts yet</p>
            )}
            {contacts?.slice(0, 8).map((contact) => (
              <div key={contact.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                    {contact.first_name[0]}{contact.last_name?.[0] ?? ""}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{contact.first_name} {contact.last_name}</p>
                    {contact.company && <p className="text-xs text-muted-foreground">{contact.company}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {contact.value && Number(contact.value) > 0 && (
                    <span className="text-xs text-muted-foreground">${Number(contact.value).toLocaleString()}</span>
                  )}
                  <Badge variant={contact.quality === "hot" ? "hot" : contact.quality === "warm" ? "warm" : "cold"} className="text-xs capitalize">
                    {contact.quality}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
