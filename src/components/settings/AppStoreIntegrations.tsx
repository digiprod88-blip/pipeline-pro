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
  MessageCircle, Facebook, Instagram, Brain, Check, X, QrCode, Key, RefreshCw, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const INTEGRATIONS_META = [
  { id: "whatsapp", name: "WhatsApp Web", description: "Connect WhatsApp to send/receive messages directly from CRM", icon: MessageCircle },
  { id: "facebook", name: "Facebook Pages", description: "Connect Facebook Lead Forms to capture leads automatically", icon: Facebook },
  { id: "instagram", name: "Instagram", description: "Connect Instagram DMs and lead forms", icon: Instagram },
  { id: "openai", name: "AI Assistant", description: "AI-powered content generation and smart responses (built-in)", icon: Brain },
];

export function AppStoreIntegrations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [facebookOpen, setFacebookOpen] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);
  const [whatsappToken, setWhatsappToken] = useState("");

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
    if (id === "whatsapp") setWhatsappOpen(true);
    else if (id === "facebook") setFacebookOpen(true);
    else if (id === "instagram") setInstagramOpen(true);
    else if (id === "openai") {
      // AI is built-in via Lovable AI, just mark as connected
      upsertConnection.mutate({ integrationId: "openai", connected: true, config: { provider: "lovable-ai" } });
      toast.success("AI Assistant activated! Built-in AI features are now enabled.");
    }
  };

  const handleDisconnect = (id: string) => {
    upsertConnection.mutate({ integrationId: id, connected: false });
    toast.success("Disconnected successfully");
  };

  const connectWhatsApp = () => {
    if (!whatsappToken.trim()) { toast.error("Please enter your WhatsApp token"); return; }
    upsertConnection.mutate({ integrationId: "whatsapp", connected: true, config: { token: whatsappToken } });
    setWhatsappOpen(false);
    setWhatsappToken("");
    toast.success("WhatsApp connected!");
  };

  const connectFacebook = () => {
    // Meta OAuth is not available in this platform - store as manual config
    upsertConnection.mutate({ integrationId: "facebook", connected: true, config: { method: "webhook" } });
    setFacebookOpen(false);
    toast.success("Facebook connected! Configure webhook in Lead Mapping tab.");
  };

  const connectInstagram = () => {
    upsertConnection.mutate({ integrationId: "instagram", connected: true, config: { method: "webhook" } });
    setInstagramOpen(false);
    toast.success("Instagram connected!");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATIONS_META.map((integration) => {
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
                      {connected && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          <Check className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
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
                {!connected && (
                  <Button size="sm" className="w-full" onClick={() => handleConnect(integration.id)}>Connect</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* WhatsApp Dialog */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />Connect WhatsApp</DialogTitle>
            <DialogDescription>Scan QR code or enter API token</DialogDescription>
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
              <Label htmlFor="wa-token">WhatsApp Business API Token</Label>
              <Input id="wa-token" type="password" placeholder="Enter your WhatsApp token..." value={whatsappToken} onChange={(e) => setWhatsappToken(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Get your token from <a href="https://developers.facebook.com/docs/whatsapp" target="_blank" rel="noreferrer" className="text-primary hover:underline">Meta for Developers <ExternalLink className="h-3 w-3 inline" /></a>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>Cancel</Button>
            <Button onClick={connectWhatsApp}>Connect</Button>
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
                <li>1. Set up a webhook in your Meta developer account</li>
                <li>2. Point it to your CRM webhook URL (see Lead Mapping tab)</li>
                <li>3. Map lead form fields to CRM fields</li>
              </ul>
            </div>
            <Button className="w-full" onClick={connectFacebook}>
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
            <Button className="w-full" onClick={connectInstagram}>
              <Instagram className="h-4 w-4 mr-2" />Mark as Connected
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
