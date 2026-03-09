import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  MessageCircle, Facebook, Instagram, Brain, Check, X, QrCode, Key, ExternalLink, Radio,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const INTEGRATIONS_META = [
  { id: "whatsapp_web", name: "WhatsApp Web", description: "QR code based — for 1-to-1 chats with contacts", icon: MessageCircle, category: "whatsapp" },
  { id: "whatsapp_waba", name: "WhatsApp WABA", description: "Business API — for bulk campaigns & automated messages", icon: Radio, category: "whatsapp" },
  { id: "facebook", name: "Facebook Pages", description: "Connect Facebook Lead Forms to capture leads automatically", icon: Facebook, category: "social" },
  { id: "instagram", name: "Instagram", description: "Connect Instagram DMs and lead forms", icon: Instagram, category: "social" },
  { id: "ai_brain", name: "AI Brain (Lovable AI)", description: "Powered by Google Gemini & GPT-5 — Content generation & smart auto-replies", icon: Brain, category: "ai" },
];

export function AppStoreIntegrations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [whatsappWebOpen, setWhatsappWebOpen] = useState(false);
  const [wabaOpen, setWabaOpen] = useState(false);
  const [facebookOpen, setFacebookOpen] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);
  const [whatsappToken, setWhatsappToken] = useState("");
  const [wabaToken, setWabaToken] = useState("");
  const [wabaPhoneId, setWabaPhoneId] = useState("");

  const { data: connections } = useQuery({
    queryKey: ["integration-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      const map: Record<string, { is_connected: boolean; config: any }> = {};
      data.forEach((c: any) => { map[c.integration_id] = { is_connected: c.is_connected, config: c.config }; });
      return map;
    },
    enabled: !!user,
  });

  const upsertConnection = useMutation({
    mutationFn: async ({ integrationId, connected, config }: { integrationId: string; connected: boolean; config?: any }) => {
      const existing = connections?.[integrationId];
      if (existing) {
        const { error } = await supabase
          .from("integration_connections")
          .update({ is_connected: connected, config: config || {}, connected_at: connected ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
          .eq("user_id", user!.id)
          .eq("integration_id", integrationId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integration_connections")
          .insert({ user_id: user!.id, integration_id: integrationId, is_connected: connected, config: config || {}, connected_at: connected ? new Date().toISOString() : null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-connections"] });
    },
  });

  const isConnected = (id: string) => connections?.[id]?.is_connected || false;

  const handleConnect = (id: string) => {
    if (id === "whatsapp_web") setWhatsappWebOpen(true);
    else if (id === "whatsapp_waba") setWabaOpen(true);
    else if (id === "facebook") setFacebookOpen(true);
    else if (id === "instagram") setInstagramOpen(true);
    else if (id === "ai_brain") {
      upsertConnection.mutate({ integrationId: "ai_brain", connected: true, config: { provider: "lovable-ai" } });
      toast.success("AI Brain is always active — powered by Lovable AI");
    }
  };

  const handleDisconnect = (id: string) => {
    upsertConnection.mutate({ integrationId: id, connected: false });
    toast.success("Disconnected successfully");
  };

  return (
    <div className="space-y-4">
      {/* WhatsApp Section */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">WhatsApp Connections</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {INTEGRATIONS_META.filter(i => i.category === "whatsapp").map((integration) => {
            const Icon = integration.icon;
            const connected = isConnected(integration.id);
            return (
              <Card key={integration.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${connected ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`h-5 w-5 ${connected ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">{integration.name}</CardTitle>
                        {connected && <Badge variant="secondary" className="text-xs mt-1"><Check className="h-3 w-3 mr-1" />Connected</Badge>}
                      </div>
                    </div>
                    {connected && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDisconnect(integration.id)}>
                        <X className="h-3 w-3 mr-1" /> Disconnect
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3">{integration.description}</p>
                  {!connected && <Button size="sm" className="w-full" onClick={() => handleConnect(integration.id)}>Connect</Button>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Social & AI Section */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Social & AI</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {INTEGRATIONS_META.filter(i => i.category !== "whatsapp").map((integration) => {
            const Icon = integration.icon;
            const connected = isConnected(integration.id);
            return (
              <Card key={integration.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${connected ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`h-5 w-5 ${connected ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">{integration.name}</CardTitle>
                        {connected && <Badge variant="secondary" className="text-xs mt-1"><Check className="h-3 w-3 mr-1" />Connected</Badge>}
                      </div>
                    </div>
                    {connected && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDisconnect(integration.id)}>
                        <X className="h-3 w-3 mr-1" /> Disconnect
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3">{integration.description}</p>
                  {!connected && <Button size="sm" className="w-full" onClick={() => handleConnect(integration.id)}>Connect</Button>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* WhatsApp Web Dialog - QR Code */}
      <Dialog open={whatsappWebOpen} onOpenChange={setWhatsappWebOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />Connect WhatsApp Web</DialogTitle>
            <DialogDescription>For 1-to-1 conversations — scan QR or enter token</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center bg-muted/30">
              <QrCode className="h-24 w-24 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground text-center">Use the WhatsApp tab in Settings for QR scanning</p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or use token</span></div>
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Web Token</Label>
              <Input type="password" placeholder="Enter your token..." value={whatsappToken} onChange={(e) => setWhatsappToken(e.target.value)} />
            </div>
            <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
              <p className="text-xs text-warning font-medium">⚠️ WhatsApp Web is for personal chats only</p>
              <p className="text-xs text-muted-foreground mt-1">Do NOT use this for bulk messages. Use WhatsApp WABA instead to avoid number bans.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappWebOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              upsertConnection.mutate({ integrationId: "whatsapp_web", connected: true, config: { token: whatsappToken, type: "web" } });
              setWhatsappWebOpen(false); setWhatsappToken("");
              toast.success("WhatsApp Web connected!");
            }}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WABA Dialog */}
      <Dialog open={wabaOpen} onOpenChange={setWabaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Radio className="h-5 w-5" />Connect WhatsApp WABA</DialogTitle>
            <DialogDescription>Business API for bulk campaigns & automated messages</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>WABA Access Token</Label>
              <Input type="password" placeholder="Enter WABA access token..." value={wabaToken} onChange={(e) => setWabaToken(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input placeholder="e.g. 1234567890" value={wabaPhoneId} onChange={(e) => setWabaPhoneId(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Get these from <a href="https://developers.facebook.com/docs/whatsapp/cloud-api" target="_blank" rel="noreferrer" className="text-primary hover:underline">Meta Cloud API docs <ExternalLink className="h-3 w-3 inline" /></a>
            </p>
            <div className="rounded-lg bg-success/10 border border-success/20 p-3">
              <p className="text-xs text-success font-medium">✓ WABA is safe for bulk messaging</p>
              <p className="text-xs text-muted-foreground mt-1">Use this connection for workflow automations, webinar reminders, and campaign broadcasts.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWabaOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!wabaToken.trim()) { toast.error("Enter WABA token"); return; }
              upsertConnection.mutate({ integrationId: "whatsapp_waba", connected: true, config: { token: wabaToken, phone_number_id: wabaPhoneId, type: "waba" } });
              setWabaOpen(false); setWabaToken(""); setWabaPhoneId("");
              toast.success("WhatsApp WABA connected!");
            }}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Facebook Dialog */}
      <Dialog open={facebookOpen} onOpenChange={setFacebookOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Facebook className="h-5 w-5" />Connect Facebook</DialogTitle>
            <DialogDescription>Connect via webhook to capture leads automatically</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-2">How it works:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>1. Create a Facebook App at developers.facebook.com</li>
                <li>2. Set up a webhook pointing to your CRM webhook URL</li>
                <li>3. Subscribe to "leadgen" and "messages" events</li>
                <li>4. Map lead form fields in the Lead Mapping tab</li>
              </ul>
            </div>
            <div className="rounded-lg bg-info/10 border border-info/20 p-3">
              <p className="text-xs text-info font-medium">ℹ️ Full OAuth requires Meta App credentials</p>
              <p className="text-xs text-muted-foreground mt-1">Add your META_APP_ID and META_APP_SECRET in backend secrets to enable real-time lead & DM sync.</p>
            </div>
            <Button className="w-full" onClick={() => {
              upsertConnection.mutate({ integrationId: "facebook", connected: true, config: { method: "webhook" } });
              setFacebookOpen(false);
              toast.success("Facebook connected! Configure webhook in Lead Mapping tab.");
            }}>
              <Facebook className="h-4 w-4 mr-2" />Mark as Connected
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instagram Dialog */}
      <Dialog open={instagramOpen} onOpenChange={setInstagramOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Instagram className="h-5 w-5" />Connect Instagram</DialogTitle>
            <DialogDescription>Connect Instagram via Facebook Page integration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Requirements:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Instagram Business or Creator account</li>
                <li>• Connected to a Facebook Page</li>
                <li>• Configure webhook in Lead Mapping</li>
              </ul>
            </div>
            <Button className="w-full" onClick={() => {
              upsertConnection.mutate({ integrationId: "instagram", connected: true, config: { method: "webhook" } });
              setInstagramOpen(false);
              toast.success("Instagram connected!");
            }}>
              <Instagram className="h-4 w-4 mr-2" />Mark as Connected
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
