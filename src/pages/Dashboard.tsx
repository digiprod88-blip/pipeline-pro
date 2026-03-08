import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  Users,
  DollarSign,
  TrendingUp,
  CheckSquare,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isFuture, isToday } from "date-fns";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  delay = 0,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
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

  const overdueTasks = tasks?.filter(
    (t) => t.status !== "completed" && t.due_date && isPast(new Date(t.due_date))
  ) ?? [];
  const upcomingTasks = tasks?.filter(
    (t) => t.status !== "completed" && t.due_date && (isFuture(new Date(t.due_date)) || isToday(new Date(t.due_date)))
  ) ?? [];
  const completedTasks = tasks?.filter((t) => t.status === "completed") ?? [];

  const getTaskColor = (task: typeof tasks extends (infer T)[] | undefined ? T : never) => {
    if (task.status === "completed") return "success" as const;
    if (task.due_date && isPast(new Date(task.due_date))) return "destructive" as const;
    return "warning" as const;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your CRM activity</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Leads" value={totalLeads} icon={Users} description={`${hotLeads} hot leads`} delay={0} />
        <StatCard title="Customers" value={totalCustomers} icon={TrendingUp} delay={0.05} />
        <StatCard
          title="Pipeline Value"
          value={`$${pipelineValue.toLocaleString()}`}
          icon={DollarSign}
          delay={0.1}
        />
        <StatCard
          title="Open Tasks"
          value={overdueTasks.length + upcomingTasks.length}
          icon={CheckSquare}
          description={`${overdueTasks.length} overdue`}
          delay={0.15}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...overdueTasks, ...upcomingTasks].slice(0, 8).length === 0 && (
              <p className="text-sm text-muted-foreground">No pending follow-ups</p>
            )}
            {[...overdueTasks, ...upcomingTasks].slice(0, 8).map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  {task.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : task.due_date && isPast(new Date(task.due_date)) ? (
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
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(task.due_date), "MMM d")}
                    </span>
                  )}
                  <Badge variant={getTaskColor(task)} className="text-xs">
                    {task.status === "completed"
                      ? "Done"
                      : task.due_date && isPast(new Date(task.due_date))
                      ? "Overdue"
                      : "Upcoming"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Leads</CardTitle>
          </CardHeader>
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
                    {contact.company && (
                      <p className="text-xs text-muted-foreground">{contact.company}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {contact.value && Number(contact.value) > 0 && (
                    <span className="text-xs text-muted-foreground">${Number(contact.value).toLocaleString()}</span>
                  )}
                  <Badge
                    variant={contact.quality === "hot" ? "hot" : contact.quality === "warm" ? "warm" : "cold"}
                    className="text-xs capitalize"
                  >
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
