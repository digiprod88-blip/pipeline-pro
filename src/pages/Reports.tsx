import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { TrendingUp, Users, DollarSign, BarChart3, Calendar, Webhook, Plus, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, isAfter, startOfWeek } from "date-fns";
import { motion } from "framer-motion";
import { ConversionFunnel } from "@/components/reports/ConversionFunnel";
import { RevenueChart } from "@/components/reports/RevenueChart";
import { ROIDashboard } from "@/components/reports/ROIDashboard";

const COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--accent-foreground))"];

export default function Reports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState("30");
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookName, setWebhookName] = useState("");

  const sinceDate = subDays(new Date(), parseInt(dateRange));

  const { data: contacts } = useQuery({
    queryKey: ["report-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*, pipeline_stages(name)");
      if (error) throw error;
      return data;
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["report-stages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipeline_stages").select("*").order("position");
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["report-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: webhookKeys } = useQuery({
    queryKey: ["webhook-keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("webhook_keys").select("*, pipelines(name), pipeline_stages(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createWebhook = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("webhook_keys").insert({ user_id: user.id, name: webhookName.trim() });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["webhook-keys"] }); setWebhookDialogOpen(false); setWebhookName(""); toast.success("Webhook URL created"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["webhook-keys"] }); toast.success("Webhook deleted"); },
  });

  const filteredContacts = contacts?.filter((c) => isAfter(new Date(c.created_at), sinceDate)) ?? [];
  const totalLeads = filteredContacts.filter((c) => c.status === "lead").length;
  const totalCustomers = filteredContacts.filter((c) => c.status === "customer").length;
  const conversionRate = filteredContacts.length > 0 ? ((totalCustomers / filteredContacts.length) * 100).toFixed(1) : "0";
  const totalValue = filteredContacts.reduce((sum, c) => sum + (Number(c.value) || 0), 0);

  // Stage distribution
  const stageData = stages?.map((stage) => ({
    name: stage.name,
    count: contacts?.filter((c) => c.stage_id === stage.id).length ?? 0,
  })) ?? [];

  // Quality distribution
  const qualityData = [
    { name: "Hot", value: filteredContacts.filter((c) => c.quality === "hot").length, color: "hsl(var(--hot))" },
    { name: "Warm", value: filteredContacts.filter((c) => c.quality === "warm").length, color: "hsl(var(--warm))" },
    { name: "Cold", value: filteredContacts.filter((c) => c.quality === "cold").length, color: "hsl(var(--cold))" },
  ].filter((d) => d.value > 0);

  // Source distribution
  const sourceMap = new Map<string, number>();
  filteredContacts.forEach((c) => { sourceMap.set(c.source || "Unknown", (sourceMap.get(c.source || "Unknown") || 0) + 1); });
  const sourceData = Array.from(sourceMap.entries()).map(([name, count]) => ({ name, count }));

  // Daily leads trend
  const days = Math.min(parseInt(dateRange), 30);
  const trendData = Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - 1 - i);
    return {
      name: format(date, "MMM d"),
      leads: contacts?.filter((c) => format(new Date(c.created_at), "yyyy-MM-dd") === format(date, "yyyy-MM-dd")).length ?? 0,
    };
  });

  // Conversion Funnel data
  const funnelSteps = stages && contacts ? stages.map((stage, i) => ({
    label: stage.name,
    count: contacts.filter((c) => c.stage_id === stage.id).length,
    color: stage.color || COLORS[i % COLORS.length],
  })) : [];

  // Revenue trend (weekly)
  const revenueData = (() => {
    if (!orders?.length) return [];
    const filtered = orders.filter((o) => isAfter(new Date(o.created_at), sinceDate) && o.status !== "cancelled");
    const weekMap = new Map<string, { revenue: number; orders: number }>();
    filtered.forEach((o) => {
      const week = format(startOfWeek(new Date(o.created_at)), "MMM d");
      const curr = weekMap.get(week) || { revenue: 0, orders: 0 };
      curr.revenue += Number(o.amount) || 0;
      curr.orders += 1;
      weekMap.set(week, curr);
    });
    return Array.from(weekMap.entries()).map(([name, data]) => ({ name, ...data }));
  })();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookBaseUrl = `${supabaseUrl}/functions/v1/webhook-lead?key=`;

  const statCards = [
    { label: "New Leads", value: totalLeads, icon: Users },
    { label: "Conversions", value: totalCustomers, icon: TrendingUp },
    { label: "Conversion Rate", value: `${conversionRate}%`, icon: BarChart3 },
    { label: "Pipeline Value", value: `$${totalValue.toLocaleString()}`, icon: DollarSign },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">In-depth analytics, ROI tracking & API integrations</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roi">ROI Analytics</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                  </div>
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Funnel + Revenue Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionFunnel steps={funnelSteps} />
        <RevenueChart data={revenueData} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Leads Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Pipeline Stage Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stageData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Lead Quality Distribution</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            {qualityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={qualityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {qualityData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8">No data in selected period</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Lead Sources</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sourceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No source data in selected period</p>
            )}
          </CardContent>
        </Card>
      </div>
      </TabsContent>

      <TabsContent value="roi" className="mt-4">
        <ROIDashboard dateRange={dateRange} />
      </TabsContent>

      <TabsContent value="webhooks" className="space-y-6 mt-4">

      {/* Webhook Keys Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhook URLs
          </CardTitle>
          <Button size="sm" onClick={() => setWebhookDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Webhook
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Use these webhook URLs to capture leads from external tools.
            Send a POST with <code className="text-xs bg-secondary px-1 py-0.5 rounded">{"{ name, email, phone, source }"}</code>
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Webhook URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhookKeys?.map((wk) => (
                <TableRow key={wk.id}>
                  <TableCell className="font-medium text-sm">{wk.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-secondary px-2 py-1 rounded max-w-[300px] truncate block">{webhookBaseUrl}{wk.key}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(`${webhookBaseUrl}${wk.key}`); toast.success("Copied"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={wk.is_active ? "success" : "secondary"}>{wk.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteWebhook.mutate(wk.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!webhookKeys || webhookKeys.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No webhooks created yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Webhook URL</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={webhookName} onChange={(e) => setWebhookName(e.target.value)} placeholder="e.g. WordPress Contact Form" />
            </div>
            <p className="text-sm text-muted-foreground">A unique webhook URL will be generated for lead capture.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createWebhook.mutate()} disabled={!webhookName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>
      </Tabs>
    </div>
  );
}
