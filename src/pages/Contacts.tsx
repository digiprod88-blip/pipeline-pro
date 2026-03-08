import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AddContactDialog } from "@/components/contacts/AddContactDialog";
import { format } from "date-fns";

export default function Contacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", search, qualityFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*, pipeline_stages(name, color)")
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
      }
      if (qualityFilter !== "all") {
        query = query.eq("quality", qualityFilter as "cold" | "warm" | "hot");
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "lead" | "customer");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact deleted");
    },
  });

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      toast.error("CSV must have a header row and at least one data row");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const firstNameIdx = headers.findIndex((h) => h.includes("first") || h === "name");
    const lastNameIdx = headers.findIndex((h) => h.includes("last"));
    const emailIdx = headers.findIndex((h) => h.includes("email"));
    const phoneIdx = headers.findIndex((h) => h.includes("phone"));
    const companyIdx = headers.findIndex((h) => h.includes("company"));

    if (firstNameIdx === -1) {
      toast.error("CSV must have a 'first_name' or 'name' column");
      return;
    }

    const contacts = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return {
        user_id: user.id,
        first_name: cols[firstNameIdx] || "Unknown",
        last_name: lastNameIdx >= 0 ? cols[lastNameIdx] || null : null,
        email: emailIdx >= 0 ? cols[emailIdx] || null : null,
        phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null,
        company: companyIdx >= 0 ? cols[companyIdx] || null : null,
        pipeline_id: "00000000-0000-0000-0000-000000000001",
      };
    });

    const { error } = await supabase.from("contacts").insert(contacts);
    if (error) {
      toast.error("Failed to import: " + error.message);
    } else {
      toast.success(`Imported ${contacts.length} contacts`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setCsvDialogOpen(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">{contacts?.length ?? 0} total contacts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={qualityFilter} onValueChange={setQualityFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Quality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quality</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts?.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${contact.status === "customer" ? "bg-success" : "bg-destructive"}`} />
                    {contact.first_name} {contact.last_name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{contact.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{contact.company ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={contact.status === "customer" ? "success" : "secondary"} className="capitalize text-xs">
                    {contact.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {contact.quality && (
                    <Badge
                      variant={contact.quality === "hot" ? "hot" : contact.quality === "warm" ? "warm" : "cold"}
                      className="capitalize text-xs"
                    >
                      {contact.quality}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {contact.pipeline_stages && (
                    <span className="text-xs text-muted-foreground">
                      {(contact.pipeline_stages as any).name}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {contact.value && Number(contact.value) > 0
                    ? `$${Number(contact.value).toLocaleString()}`
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(contact.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteContact.mutate(contact.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!contacts || contacts.length === 0) && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No contacts found. Add your first contact to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pipelineId="00000000-0000-0000-0000-000000000001"
      />

      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with columns: name/first_name, last_name, email, phone, company
            </p>
            <Input type="file" accept=".csv" onChange={handleCsvImport} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
