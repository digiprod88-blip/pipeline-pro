import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { Plus, TrendingUp, DollarSign, Users, Target } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, isAfter } from "date-fns";
import { motion } from "framer-motion";

interface ROIDashboardProps {
  dateRange: string;
}

export function ROIDashboard({ dateRange }: ROIDashboardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [spendForm, setSpendForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), amount: "", platform: "meta", campaign_name: "" });

  const sinceDate = subDays(new Date(), parseInt(dateRange));

  const { data: adSpend } = useQuery({
    queryKey: ["ad-spend", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_spend")
        .select("*")
        .gte("date", format(sinceDate, "yyyy-MM-dd"))
        .order("date");
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["roi-contacts", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, created_at, source, value")
        .gte("created_at", sinceDate.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["roi-orders", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("amount, created_at, status")
        .gte("created_at", sinceDate.toISOString())
        .neq("status", "cancelled");
      if (error) throw error;
      return data;
    },
  });

  const addSpend = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ad_spend").insert({
        user_id: user!.id,
        date: spendForm.date,
        amount: parseFloat(spendForm.amount) || 0,
        platform: spendForm.platform,
        campaign_name: spendForm.campaign_name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-spend"] });
      setAddOpen(false);
      setSpendForm({ date: format(new Date(), "yyyy-MM-dd"), amount: "", platform: "meta", campaign_name: "" });
      toast.success("Spend logged");
    },
  });

  const totalSpend = adSpend?.reduce((s, a) => s + Number(a.amount), 0) || 0;
  const totalLeads = contacts?.length || 0;
  const totalRevenue = orders?.reduce((s, o) => s + Number(o.amount), 0) || 0;
  const cpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : "0";
  const roi = totalSpend > 0 ? (((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(1) : "0";

  // Chart data: group by date
  const chartMap = new Map<string, { spend: number; revenue: number; leads: number }>();
  adSpend?.forEach(a => {
    const key = a.date;
    const curr = chartMap.get(key) || { spend: 0, revenue: 0, leads: 0 };
    curr.spend += Number(a.amount);
    chartMap.set(key, curr);
  });
  contacts?.forEach(c => {
    const key = format(new Date(c.created_at), "yyyy-MM-dd");
    const curr = chartMap.get(key) || { spend: 0, revenue: 0, leads: 0 };
    curr.leads += 1;
    chartMap.set(key, curr);
  });
  orders?.forEach(o => {
    const key = format(new Date(o.created_at), "yyyy-MM-dd");
    const curr = chartMap.get(key) || { spend: 0, revenue: 0, leads: 0 };
    curr.revenue += Number(o.amount);
    chartMap.set(key, curr);
  });
  const chartData = Array.from(chartMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ name: format(new Date(date), "MMM d"), ...data }));

  const stats = [
    { label: "Total Ad Spend", value: `₹${totalSpend.toLocaleString()}`, icon: DollarSign, color: "text-destructive" },
    { label: "Cost Per Lead", value: `₹${cpl}`, icon: Target, color: "text-warning" },
    { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-success" },
    { label: "ROI", value: `${roi}%`, icon: TrendingUp, color: Number(roi) > 0 ? "text-success" : "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">ROI Analytics</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Log Ad Spend
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Revenue vs Ad Spend</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Bar dataKey="spend" name="Ad Spend" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Log ad spend to see ROI analytics</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Ad Spend</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Date</Label><Input type="date" value={spendForm.date} onChange={e => setSpendForm({ ...spendForm, date: e.target.value })} /></div>
            <div><Label>Amount (₹)</Label><Input type="number" value={spendForm.amount} onChange={e => setSpendForm({ ...spendForm, amount: e.target.value })} placeholder="500" /></div>
            <div><Label>Campaign Name (Optional)</Label><Input value={spendForm.campaign_name} onChange={e => setSpendForm({ ...spendForm, campaign_name: e.target.value })} placeholder="Summer Sale Campaign" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addSpend.mutate()} disabled={!spendForm.amount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
