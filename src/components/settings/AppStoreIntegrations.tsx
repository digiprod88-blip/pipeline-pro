import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  MessageCircle, 
  Facebook, 
  Instagram, 
  Brain, 
  Check, 
  X, 
  QrCode,
  Key,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  connected: boolean;
  status?: string;
}

export function AppStoreIntegrations() {
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [facebookOpen, setFacebookOpen] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);
  const [openaiOpen, setOpenaiOpen] = useState(false);
  
  const [whatsappToken, setWhatsappToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  
  // Simulated connection states (would come from DB in production)
  const [connections, setConnections] = useState({
    whatsapp: false,
    facebook: false,
    instagram: false,
    openai: false,
  });

  const integrations: Integration[] = [
    {
      id: "whatsapp",
      name: "WhatsApp Web",
      description: "Connect WhatsApp to send/receive messages directly from CRM",
      icon: MessageCircle,
      connected: connections.whatsapp,
      status: connections.whatsapp ? "Connected" : undefined,
    },
    {
      id: "facebook",
      name: "Facebook Pages",
      description: "Connect Facebook Lead Forms to capture leads automatically",
      icon: Facebook,
      connected: connections.facebook,
      status: connections.facebook ? "2 forms mapped" : undefined,
    },
    {
      id: "instagram",
      name: "Instagram",
      description: "Connect Instagram DMs and lead forms",
      icon: Instagram,
      connected: connections.instagram,
      status: connections.instagram ? "Connected" : undefined,
    },
    {
      id: "openai",
      name: "OpenAI / LLM",
      description: "Enable AI-powered content generation and smart responses",
      icon: Brain,
      connected: connections.openai,
      status: connections.openai ? "GPT-4 Active" : undefined,
    },
  ];

  const handleConnect = (id: string) => {
    switch (id) {
      case "whatsapp":
        setWhatsappOpen(true);
        break;
      case "facebook":
        setFacebookOpen(true);
        break;
      case "instagram":
        setInstagramOpen(true);
        break;
      case "openai":
        setOpenaiOpen(true);
        break;
    }
  };

  const handleDisconnect = (id: string) => {
    setConnections(prev => ({ ...prev, [id]: false }));
    toast.success(`${id.charAt(0).toUpperCase() + id.slice(1)} disconnected`);
  };

  const connectWhatsApp = () => {
    if (!whatsappToken.trim()) {
      toast.error("Please enter your WhatsApp token");
      return;
    }
    setConnections(prev => ({ ...prev, whatsapp: true }));
    setWhatsappOpen(false);
    setWhatsappToken("");
    toast.success("WhatsApp connected successfully!");
  };

  const connectFacebook = () => {
    // In production, this would open OAuth flow
    setConnections(prev => ({ ...prev, facebook: true }));
    setFacebookOpen(false);
    toast.success("Facebook connected! Go to Lead Mapping to configure forms.");
  };

  const connectInstagram = () => {
    setConnections(prev => ({ ...prev, instagram: true }));
    setInstagramOpen(false);
    toast.success("Instagram connected successfully!");
  };

  const connectOpenAI = () => {
    if (!openaiKey.trim()) {
      toast.error("Please enter your OpenAI API key");
      return;
    }
    setConnections(prev => ({ ...prev, openai: true }));
    setOpenaiOpen(false);
    setOpenaiKey("");
    toast.success("OpenAI connected! AI features are now active.");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${integration.connected ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${integration.connected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">{integration.name}</CardTitle>
                      {integration.connected && integration.status && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          <Check className="h-3 w-3 mr-1" />
                          {integration.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {integration.connected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDisconnect(integration.id)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  {integration.description}
                </p>
                {!integration.connected && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleConnect(integration.id)}
                  >
                    Connect
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* WhatsApp Connection Dialog */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Connect WhatsApp
            </DialogTitle>
            <DialogDescription>
              Scan QR code with your phone or enter API token
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* QR Code Placeholder */}
            <div className="border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center bg-muted/30">
              <QrCode className="h-24 w-24 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                QR Code scanning requires external WhatsApp API service
              </p>
              <Button variant="outline" size="sm" className="mt-2">
                <RefreshCw className="h-3 w-3 mr-1" />
                Generate QR Code
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or use token</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp-token">WhatsApp Business API Token</Label>
              <Input
                id="whatsapp-token"
                type="password"
                placeholder="Enter your WhatsApp token..."
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your token from{" "}
                <a href="https://developers.facebook.com/docs/whatsapp" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Meta for Developers <ExternalLink className="h-3 w-3 inline" />
                </a>
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>
              Cancel
            </Button>
            <Button onClick={connectWhatsApp}>
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Facebook Connection Dialog */}
      <Dialog open={facebookOpen} onOpenChange={setFacebookOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5" />
              Connect Facebook
            </DialogTitle>
            <DialogDescription>
              Connect your Facebook Pages to capture leads automatically
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Permissions Required:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• pages_show_list - View your Pages</li>
                <li>• pages_read_engagement - Read Page engagement</li>
                <li>• leads_retrieval - Access lead form data</li>
                <li>• pages_manage_metadata - Manage Page settings</li>
              </ul>
            </div>
            
            <Button className="w-full" onClick={connectFacebook}>
              <Facebook className="h-4 w-4 mr-2" />
              Continue with Facebook
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              You'll be redirected to Facebook to authorize access
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instagram Connection Dialog */}
      <Dialog open={instagramOpen} onOpenChange={setInstagramOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5" />
              Connect Instagram
            </DialogTitle>
            <DialogDescription>
              Connect Instagram to manage DMs and lead forms
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Requirements:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Instagram Business or Creator account</li>
                <li>• Connected to a Facebook Page</li>
              </ul>
            </div>
            
            <Button className="w-full" onClick={connectInstagram}>
              <Instagram className="h-4 w-4 mr-2" />
              Continue with Instagram
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* OpenAI Connection Dialog */}
      <Dialog open={openaiOpen} onOpenChange={setOpenaiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Connect OpenAI
            </DialogTitle>
            <DialogDescription>
              Enable AI-powered features with your OpenAI API key
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  OpenAI Platform <ExternalLink className="h-3 w-3 inline" />
                </a>
              </p>
            </div>
            
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Features Enabled:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• AI content generation for landing pages</li>
                <li>• Smart message suggestions</li>
                <li>• Automated lead scoring</li>
                <li>• Content Lab AI writer</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenaiOpen(false)}>
              Cancel
            </Button>
            <Button onClick={connectOpenAI}>
              <Key className="h-4 w-4 mr-2" />
              Save API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
