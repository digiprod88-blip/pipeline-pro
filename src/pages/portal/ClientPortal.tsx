import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, Clock, DollarSign, MessageSquare, LogOut, User,
  ArrowRight, FileText,
} from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function ClientPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, client_contact_id")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const contactId = profile?.client_contact_id;

  const { data: contact } = useQuery({
    queryKey: ["client-contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, pipeline_stages(name, color)")
        .eq("id", contactId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const { data: tasks } = useQuery({
    queryKey: ["client-tasks", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("contact_id", contactId!)
        .eq("visible_to_client", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const { data: orders } = useQuery({
    queryKey: ["client-orders", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(name)")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const { data: messages } = useQuery({
    queryKey: ["client-messages", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const totalTasks = tasks?.length ?? 0;
  const stageName = contact?.pipeline_stages
    ? (contact.pipeline_stages as any).name
    : "N/A";
  const stageColor = contact?.pipeline_stages
    ? (contact.pipeline_stages as any).color
    : null;

  if (!contactId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center p-8">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">Portal Not Configured</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your account hasn't been linked to a contact yet. Please reach out to your administrator.
          </p>
          <Button variant="outline" className="mt-4" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Client Portal</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {contact?.first_name} {contact?.last_name}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Status Card */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: stageColor ? `${stageColor}20` : "hsl(var(--secondary))" }}
                >
                  <ArrowRight className="h-5 w-5" style={{ color: stageColor || "hsl(var(--muted-foreground))" }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Stage</p>
                  <p className="text-lg font-semibold">{stageName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tasks Progress</p>
                  <p className="text-lg font-semibold">{completedTasks}/{totalTasks} completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-lg font-semibold">
                    ${orders?.filter((o) => o.status === "completed").reduce((s, o) => s + Number(o.amount), 0).toLocaleString() ?? "0"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />Project Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(!tasks || tasks.length === 0) && (
                <p className="text-sm text-muted-foreground">No tasks to show</p>
              )}
              {tasks?.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    {task.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Clock className="h-4 w-4 text-warning" />
                    )}
                    <div>
                      <p className={`text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : "font-medium"}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={task.status === "completed" ? "success" : task.status === "in_progress" ? "warning" : "secondary"}
                    className="text-xs capitalize"
                  >
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {(!messages || messages.length === 0) && (
                <p className="text-sm text-muted-foreground">No messages yet</p>
              )}
              {messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${
                    msg.direction === "inbound"
                      ? "bg-secondary ml-0 mr-8"
                      : "bg-primary/10 ml-8 mr-0"
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(msg.created_at), "MMM d, HH:mm")}
                    <span className="ml-2 capitalize">{msg.channel}</span>
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!orders || orders.length === 0) && (
              <p className="text-sm text-muted-foreground">No payments recorded</p>
            )}
            <div className="space-y-2">
              {orders?.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {(order as any).products?.name || "Payment"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(order.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {order.currency === "INR" ? "₹" : "$"}{Number(order.amount).toLocaleString()}
                    </span>
                    <Badge
                      variant={order.status === "completed" ? "success" : order.status === "pending" ? "warning" : "secondary"}
                      className="text-xs capitalize"
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
