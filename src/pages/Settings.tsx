import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Trash2, Users, Store, Map, Settings2, Variable, MessageCircle, Target, Globe, Copy, CheckCircle, Webhook } from "lucide-react";
import { toast } from "sonner";
import { AppStoreIntegrations } from "@/components/settings/AppStoreIntegrations";
import { LeadFormMapping } from "@/components/settings/LeadFormMapping";
import { DynamicVariables } from "@/components/settings/DynamicVariables";
import { WhatsAppQRConnection } from "@/components/settings/WhatsAppQRConnection";
import { MetaPixelSettings } from "@/components/settings/MetaPixelSettings";
import { WebhooksSettings } from "@/components/settings/WebhooksSettings";

function DnsTestButton() {
  const [domain, setDomain] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<"success" | "fail" | null>(null);

  const testDns = async () => {
    if (!domain.trim()) return toast.error("Enter your domain first");
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(`https://dns.google/resolve?name=${domain.trim()}&type=A`);
      const data = await res.json();
      const answers = data.Answer ?? [];
      const pointsToLovable = answers.some((a: any) => a.data === "185.158.133.1");
      setResult(pointsToLovable ? "success" : "fail");
      if (pointsToLovable) toast.success("DNS is correctly pointing to this CRM!");
      else toast.error("DNS does not point to 185.158.133.1 yet. Please check your records.");
    } catch {
      setResult("fail");
      toast.error("Could not check DNS. Try again later.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <h3 className="text-sm font-semibold">Test DNS Connection</h3>
      <div className="flex gap-2">
        <Input placeholder="yourdomain.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="max-w-xs" />
        <Button variant="outline" onClick={testDns} disabled={testing}>
          {testing ? "Checking…" : "Test Connection"}
        </Button>
      </div>
      {result === "success" && (
        <div className="flex items-center gap-2 text-success text-sm"><CheckCircle className="h-4 w-4" />DNS verified — SSL will be provisioned automatically.</div>
      )}
      {result === "fail" && (
        <div className="flex items-center gap-2 text-destructive text-sm"><Globe className="h-4 w-4" />DNS not yet pointing correctly. Allow up to 72 hours for propagation.</div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: clientUsers } = useQuery({
    queryKey: ["client-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "client");
      if (error) throw error;

      const userIds = data.map((r) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, client_contact_id")
        .in("user_id", userIds);

      const contactIds = (profiles || [])
        .map((p) => p.client_contact_id)
        .filter(Boolean) as string[];

      let contactMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .in("id", contactIds);
        contacts?.forEach((c) => {
          contactMap[c.id] = `${c.first_name} ${c.last_name || ""}`.trim();
        });
      }

      return (profiles || []).map((p) => ({
        ...p,
        contactName: p.client_contact_id ? contactMap[p.client_contact_id] || "Unknown" : null,
      }));
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const linkContact = useMutation({
    mutationFn: async ({ userId, contactId }: { userId: string; contactId: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ client_contact_id: contactId })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-users"] });
      toast.success("Contact linked to client");
    },
  });

  const unlinkContact = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ client_contact_id: null })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-users"] });
      toast.success("Contact unlinked");
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage account, integrations & client access</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="general" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="domain" className="gap-1.5">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Domain</span>
          </TabsTrigger>
          <TabsTrigger value="appstore" className="gap-1.5">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">App Store</span>
          </TabsTrigger>
          <TabsTrigger value="leadmapping" className="gap-1.5">
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Leads</span>
          </TabsTrigger>
          <TabsTrigger value="variables" className="gap-1.5">
            <Variable className="h-4 w-4" />
            <span className="hidden sm:inline">Variables</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="pixel" className="gap-1.5">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Pixels</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Client Portal Users
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Users with the 'client' role can access the portal. Link them to a contact to show relevant data.
              </p>

              {(!clientUsers || clientUsers.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No client users yet. Assign the 'client' role to a user in Team Management.
                </p>
              )}

              {clientUsers?.map((client) => (
                <div
                  key={client.user_id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{client.full_name || "Unnamed User"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{client.user_id.slice(0, 8)}...</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {client.contactName ? (
                      <>
                        <Badge variant="outline" className="text-xs">
                          <Link2 className="h-3 w-3 mr-1" />
                          {client.contactName}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => unlinkContact.mutate(client.user_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Select
                        onValueChange={(contactId) =>
                          linkContact.mutate({ userId: client.user_id, contactId })
                        }
                      >
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue placeholder="Link to contact..." />
                        </SelectTrigger>
                        <SelectContent>
                          {contacts?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.first_name} {c.last_name} {c.email ? `(${c.email})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domain" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Custom Domain Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Point your custom domain to this CRM by adding the following DNS records at your domain registrar (e.g. Cloudflare, GoDaddy, Namecheap).
              </p>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Required DNS Records</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-border rounded-lg">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Name / Host</th>
                        <th className="text-left p-3 font-medium">Value / Points to</th>
                        <th className="text-left p-3 font-medium">TTL</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="p-3"><Badge variant="outline">A</Badge></td>
                        <td className="p-3 font-mono text-xs">@</td>
                        <td className="p-3 font-mono text-xs">185.158.133.1</td>
                        <td className="p-3 text-muted-foreground">Auto</td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText("185.158.133.1"); toast.success("IP copied"); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3"><Badge variant="outline">A</Badge></td>
                        <td className="p-3 font-mono text-xs">www</td>
                        <td className="p-3 font-mono text-xs">185.158.133.1</td>
                        <td className="p-3 text-muted-foreground">Auto</td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText("185.158.133.1"); toast.success("IP copied"); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3"><Badge variant="outline">TXT</Badge></td>
                        <td className="p-3 font-mono text-xs">_lovable</td>
                        <td className="p-3 font-mono text-xs break-all">lovable_verify=your-project-id</td>
                        <td className="p-3 text-muted-foreground">Auto</td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText("_lovable"); toast.success("Copied"); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Setup Steps</h3>
                <div className="space-y-2">
                  {[
                    "Log in to your domain registrar (Cloudflare, GoDaddy, Namecheap, etc.)",
                    "Navigate to DNS Management for your domain",
                    "Add the A records above for both @ (root) and www",
                    "Add the TXT record for domain verification",
                    "Wait for DNS propagation (up to 72 hours)",
                    "SSL certificate will be provisioned automatically",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Cloudflare Users</p>
                    <p>If using Cloudflare, set proxy status to <strong>DNS Only</strong> (grey cloud) for the A records to allow SSL provisioning.</p>
                  </div>
                </div>
              </div>

              <DnsTestButton />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appstore" className="mt-6">
          <AppStoreIntegrations />
        </TabsContent>

        <TabsContent value="leadmapping" className="mt-6">
          <LeadFormMapping />
        </TabsContent>

        <TabsContent value="variables" className="mt-6">
          <DynamicVariables />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <WhatsAppQRConnection />
        </TabsContent>

        <TabsContent value="pixel" className="mt-6">
          <MetaPixelSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
