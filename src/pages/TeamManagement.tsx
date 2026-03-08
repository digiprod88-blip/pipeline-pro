import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Shield, UserPlus, Trash2 } from "lucide-react";
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

  // Check if current user is admin
  const { data: currentRole } = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const isAdmin = currentRole?.role === "admin";

  // Get all team members
  const { data: members } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("*, profiles!inner(full_name, avatar_url, user_id)");
      if (error) throw error;
      return roles;
    },
    enabled: isAdmin,
  });

  // Update role
  const updateRole = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { role?: string; hide_phone?: boolean; pipeline_access?: string } }) => {
      const { error } = await supabase
        .from("user_roles")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Member updated");
    },
    onError: (e) => toast.error(e.message),
  });

  // Invite new staff (create account)
  const inviteStaff = useMutation({
    mutationFn: async () => {
      // Sign up the new user (auto-confirmed)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      // Note: the trigger will auto-assign 'staff' role
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setInviteOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("staff");
      toast.success("Staff member invited successfully!");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">Team Management</h1>
            <p className="text-sm text-muted-foreground">Admin access required</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You need admin privileges to manage team members.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team Management</h1>
          <p className="text-sm text-muted-foreground">Manage staff accounts and permissions</p>
        </div>
        <Button onClick={() => { setInviteAsClient(false); setInviteOpen(true); }}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Staff
        </Button>
        <Button variant="outline" onClick={() => { setInviteAsClient(true); setInviteOpen(true); }}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Client
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Pipeline Access</TableHead>
                <TableHead>Hide Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => {
                const profile = member.profiles as any;
                const isCurrentUser = member.user_id === user?.id;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                          {profile?.full_name?.[0] ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {profile?.full_name ?? "Unknown"}
                            {isCurrentUser && <span className="text-muted-foreground ml-1">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(val) =>
                          updateRole.mutate({ id: member.id, updates: { role: val } })
                        }
                        disabled={isCurrentUser}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.pipeline_access}
                        onValueChange={(val) =>
                          updateRole.mutate({ id: member.id, updates: { pipeline_access: val } })
                        }
                        disabled={isCurrentUser}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full Access</SelectItem>
                          <SelectItem value="view">View Only</SelectItem>
                          <SelectItem value="create">Create Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={member.hide_phone}
                        onCheckedChange={(checked) =>
                          updateRole.mutate({ id: member.id, updates: { hide_phone: checked } })
                        }
                        disabled={isCurrentUser}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!members || members.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No team members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inviteAsClient ? "Invite Client" : "Invite Staff Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => inviteStaff.mutate()} disabled={!email || !password || password.length < 6}>
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
