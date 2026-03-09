import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Store, CreditCard, IndianRupee, DollarSign, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function ShopSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["shop-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({
    shop_name: "", logo_url: "", banner_url: "", currency: "INR",
    payment_gateway: "none", razorpay_key_id: "", stripe_publishable_key: "",
    gst_number: "", terms_text: "",
  });

  // Sync form when settings load
  useEffect(() => {
    if (settings) {
      setForm({
        shop_name: settings.shop_name || "",
        logo_url: settings.logo_url || "",
        banner_url: settings.banner_url || "",
        currency: settings.currency || "INR",
        payment_gateway: settings.payment_gateway || "none",
        razorpay_key_id: settings.razorpay_key_id || "",
        stripe_publishable_key: settings.stripe_publishable_key || "",
        gst_number: settings.gst_number || "",
        terms_text: settings.terms_text || "",
      });
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id, shop_name: form.shop_name,
        logo_url: form.logo_url || null, banner_url: form.banner_url || null,
        currency: form.currency, payment_gateway: form.payment_gateway,
        razorpay_key_id: form.razorpay_key_id || null,
        stripe_publishable_key: form.stripe_publishable_key || null,
        gst_number: form.gst_number || null, terms_text: form.terms_text || null,
      };
      if (settings?.id) {
        const { error } = await supabase.from("shop_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shop_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-settings"] });
      toast.success("Shop settings saved!");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Shop Settings</CardTitle>
        <CardDescription>Configure your shop branding and payment gateways</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="branding" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="legal">Legal</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Shop Name</Label>
                <Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} placeholder="My Awesome Shop" />
              </div>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR"><span className="flex items-center gap-2"><IndianRupee className="h-3 w-3" /> INR (₹)</span></SelectItem>
                    <SelectItem value="USD"><span className="flex items-center gap-2"><DollarSign className="h-3 w-3" /> USD ($)</span></SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://example.com/logo.png" />
              {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded border" />}
            </div>
            <div className="space-y-2">
              <Label>Banner URL</Label>
              <Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://example.com/banner.jpg" />
              {form.banner_url && <img src={form.banner_url} alt="Banner" className="h-24 w-full object-cover rounded border" />}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="space-y-2">
              <Label>Active Payment Gateway</Label>
              <Select value={form.payment_gateway} onValueChange={(v) => setForm({ ...form, payment_gateway: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Manual)</SelectItem>
                  <SelectItem value="razorpay">Razorpay (India)</SelectItem>
                  <SelectItem value="stripe">Stripe (International)</SelectItem>
                  <SelectItem value="both">Both (Auto-detect)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Razorpay</span>
                  {form.razorpay_key_id ? <Badge variant="secondary" className="text-xs"><Check className="h-3 w-3 mr-1" />Connected</Badge> : <Badge variant="secondary" className="text-xs">Not configured</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Key ID (Publishable)</Label>
                  <Input value={form.razorpay_key_id} onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })} placeholder="rzp_live_..." className="text-sm" />
                </div>
                <p className="text-xs text-muted-foreground">Get keys from <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer" className="text-primary underline">Razorpay Dashboard</a></p>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Stripe</span>
                  {form.stripe_publishable_key ? <Badge variant="secondary" className="text-xs"><Check className="h-3 w-3 mr-1" />Connected</Badge> : <Badge variant="secondary" className="text-xs">Not configured</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Publishable Key</Label>
                  <Input value={form.stripe_publishable_key} onChange={(e) => setForm({ ...form, stripe_publishable_key: e.target.value })} placeholder="pk_live_..." className="text-sm" />
                </div>
                <p className="text-xs text-muted-foreground">Get keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-primary underline">Stripe Dashboard</a></p>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span>Secret keys should be added via backend settings for security.</span>
            </div>
          </TabsContent>

          <TabsContent value="legal" className="space-y-4">
            <div className="space-y-2">
              <Label>GST/Tax Number</Label>
              <Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea value={form.terms_text} onChange={(e) => setForm({ ...form, terms_text: e.target.value })} placeholder="Enter your shop terms..." rows={6} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
