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
import { Link2, Trash2, Users, Store, Map, Settings2, Variable, MessageCircle, Target } from "lucide-react";
import { toast } from "sonner";
import { AppStoreIntegrations } from "@/components/settings/AppStoreIntegrations";
import { LeadFormMapping } from "@/components/settings/LeadFormMapping";
import { DynamicVariables } from "@/components/settings/DynamicVariables";
import { WhatsAppQRConnection } from "@/components/settings/WhatsAppQRConnection";
import { MetaPixelSettings } from "@/components/settings/MetaPixelSettings";

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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
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
