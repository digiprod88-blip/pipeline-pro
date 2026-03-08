import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Users, Trash2, UserPlus, UserMinus, Search } from "lucide-react";
import { toast } from "sonner";

export default function ContactGroups() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  const { data: groups } = useQuery({
    queryKey: ["contact-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_groups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: groupMembers } = useQuery({
    queryKey: ["group-members", manageOpen],
    queryFn: async () => {
      if (!manageOpen) return [];
      const { data, error } = await supabase.from("contact_group_members").select("contact_id").eq("group_id", manageOpen);
      if (error) throw error;
      return data.map((m) => m.contact_id);
    },
    enabled: !!manageOpen,
  });

  const { data: allContacts } = useQuery({
    queryKey: ["all-contacts-for-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id, first_name, last_name, email, company").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: groupCounts } = useQuery({
    queryKey: ["group-member-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_group_members").select("group_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((m) => { counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
      return counts;
    },
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contact_groups").insert({
        name: name.trim(),
        description: description.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
      setCreateOpen(false);
      setName("");
      setDescription("");
      toast.success("Group created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("contact_group_members").delete().eq("group_id", id);
      const { error } = await supabase.from("contact_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-member-counts"] });
      toast.success("Group deleted");
    },
  });

  const toggleMember = useMutation({
    mutationFn: async ({ contactId, add }: { contactId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from("contact_group_members").insert({ group_id: manageOpen!, contact_id: contactId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contact_group_members").delete().eq("group_id", manageOpen!).eq("contact_id", contactId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", manageOpen] });
      queryClient.invalidateQueries({ queryKey: ["group-member-counts"] });
    },
  });

  const filteredContacts = allContacts?.filter((c) => {
    if (!contactSearch) return true;
    const s = contactSearch.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contact Groups</h1>
          <p className="text-sm text-muted-foreground">Segment contacts for targeted campaigns</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />New Group
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups?.map((group) => (
          <Card key={group.id} className="group">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{group.name}</CardTitle>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setManageOpen(group.id)}>
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteGroup.mutate(group.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {group.description && <p className="text-xs text-muted-foreground mb-2">{group.description}</p>}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">{groupCounts?.[group.id] ?? 0} contacts</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!groups || groups.length === 0) && (
          <p className="text-muted-foreground col-span-full text-center py-8">No groups yet. Create one to start segmenting contacts.</p>
        )}
      </div>

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Webinar Leads" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this group..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createGroup.mutate()} disabled={!name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={!!manageOpen} onOpenChange={(o) => !o && setManageOpen(null)}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Manage Members
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contacts..." value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} className="pl-8" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 max-h-[50vh]">
            {filteredContacts?.map((contact) => {
              const isMember = groupMembers?.includes(contact.id) ?? false;
              return (
                <div key={contact.id} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/50 cursor-pointer" onClick={() => toggleMember.mutate({ contactId: contact.id, add: !isMember })}>
                  <Checkbox checked={isMember} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.first_name} {contact.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email ?? contact.company ?? ""}</p>
                  </div>
                  {isMember && <Badge variant="success" className="text-xs shrink-0">Member</Badge>}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
