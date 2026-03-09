import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Shield, UserPlus, Bot, Zap, Download, Eye, Lock } from "lucide-react";
import { toast } from "sonner";

export default function TeamManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("staff");
  const [inviteAsClient, setInviteAsClient] = useState(false);
  const [aiStaffEnabled, setAiStaffEnabled] = useState(false);

  const { data: currentRole } = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("user_roles").select("*").eq("user_id", user.id).single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const isAdmin = currentRole?.role === "admin";

  const { data: aiConnection } = useQuery({
    queryKey: ["ai-staff-connection", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("integration_connections")
        .select("*").eq("user_id", user.id).eq("integration_id", "ai_staff").maybeSingle();
      if (data) setAiStaffEnabled(data.is_connected);
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const toggleAiStaff = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user) throw new Error("Not authenticated");
      if (aiConnection) {
        await supabase.from("integration_connections").update({ is_connected: enabled, connected_at: enabled ? new Date().toISOString() : null }).eq("id", aiConnection.id);
      } else {
        await supabase.from("integration_connections").insert({
          user_id: user.id, integration_id: "ai_staff", is_connected: enabled,
          connected_at: enabled ? new Date().toISOString() : null,
        });
      }
    },
    onSuccess: (_, enabled) => {
      setAiStaffEnabled(enabled);
      queryClient.invalidateQueries({ queryKey: ["ai-staff-connection"] });
      toast.success(enabled ? "AI Staff enabled — auto-responses active" : "AI Staff disabled");
    },
  });

  const { data: members } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles, error } = await supabase.from("user_roles").select("*, profiles!inner(full_name, avatar_url, user_id)");
      if (error) throw error;
      return roles;
    },
    enabled: isAdmin,
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("user_roles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["team-members"] }); toast.success("Member updated"); },
    onError: (e) => toast.error(e.message),
  });

  const inviteStaff = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setInviteOpen(false); setEmail(""); setPassword(""); setFullName(""); setRole("staff");
      toast.success("Staff member invited successfully!");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div><h1 className="text-2xl font-semibold">Team Management</h1><p className="text-sm text-muted-foreground">Admin access required</p></div>
        </div>
        <Card><CardContent className="py-8 text-center text-muted-foreground">You need admin privileges to manage team members.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Team Management</h1><p className="text-sm text-muted-foreground">Manage staff accounts and permissions</p></div>
        <div className="flex gap-2">
          <Button onClick={() => { setInviteAsClient(false); setInviteOpen(true); }}><UserPlus className="h-4 w-4 mr-2" />Invite Staff</Button>
          <Button variant="outline" onClick={() => { setInviteAsClient(true); setInviteOpen(true); }}><UserPlus className="h-4 w-4 mr-2" />Invite Client</Button>
        </div>
      </div>

      {/* AI Staff Card */}
      <Card className="border-dashed border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  AI Staff <Badge variant="outline" className="text-[10px]"><Zap className="h-3 w-3 mr-1" />Beta</Badge>
                </CardTitle>
                <CardDescription className="text-xs">Auto-respond to WhatsApp messages using AI</CardDescription>
              </div>
            </div>
            <Switch checked={aiStaffEnabled} onCheckedChange={(checked) => toggleAiStaff.mutate(checked)} />
          </div>
        </CardHeader>
        {aiStaffEnabled && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              AI Staff will automatically generate and send contextual replies to incoming WhatsApp messages using your content library and contact history.
            </p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Team Members & Permissions</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead className="text-center"><span className="flex items-center gap-1 justify-center"><Eye className="h-3 w-3" />Hide Phone</span></TableHead>
                <TableHead className="text-center"><span className="flex items-center gap-1 justify-center"><Lock className="h-3 w-3" />Hide Finance</span></TableHead>
                <TableHead className="text-center"><span className="flex items-center gap-1 justify-center"><Download className="h-3 w-3" />No Export</span></TableHead>
                <TableHead className="text-center"><span className="flex items-center gap-1 justify-center"><Eye className="h-3 w-3" />Read-Only Funnel</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => {
                const profile = member.profiles as any;
                const isCurrentUser = member.user_id === user?.id;
                const memberAny = member as any;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">{profile?.full_name?.[0] ?? "?"}</div>
                        <p className="text-sm font-medium">{profile?.full_name ?? "Unknown"}{isCurrentUser && <span className="text-muted-foreground ml-1">(you)</span>}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={member.role} onValueChange={(val) => updateRole.mutate({ id: member.id, updates: { role: val } })} disabled={isCurrentUser}>
                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={member.pipeline_access} onValueChange={(val) => updateRole.mutate({ id: member.id, updates: { pipeline_access: val } })} disabled={isCurrentUser}>
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full Access</SelectItem>
                          <SelectItem value="view">View Only</SelectItem>
                          <SelectItem value="create">Create Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center"><Switch checked={member.hide_phone} onCheckedChange={(checked) => updateRole.mutate({ id: member.id, updates: { hide_phone: checked } })} disabled={isCurrentUser} /></TableCell>
                    <TableCell className="text-center"><Switch checked={member.hide_finance} onCheckedChange={(checked) => updateRole.mutate({ id: member.id, updates: { hide_finance: checked } })} disabled={isCurrentUser} /></TableCell>
                    <TableCell className="text-center"><Switch checked={memberAny.disable_export || false} onCheckedChange={(checked) => updateRole.mutate({ id: member.id, updates: { disable_export: checked } })} disabled={isCurrentUser} /></TableCell>
                    <TableCell className="text-center"><Switch checked={memberAny.read_only_funnel || false} onCheckedChange={(checked) => updateRole.mutate({ id: member.id, updates: { read_only_funnel: checked } })} disabled={isCurrentUser} /></TableCell>
                  </TableRow>
                );
              })}
              {(!members || members.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No team members found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{inviteAsClient ? "Invite Client" : "Invite Staff Member"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@company.com" /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => inviteStaff.mutate()} disabled={!email || !password || password.length < 6}>Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
