import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isFuture, isToday } from "date-fns";
import { motion } from "framer-motion";

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [dueDate, setDueDate] = useState("");
  const [contactId, setContactId] = useState<string>("");

  const { data: tasks } = useQuery({
    queryKey: ["tasks", statusFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, contacts(first_name, last_name)")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "pending" | "in_progress" | "completed" | "overdue");
      }
      if (search) {
        query = query.ilike("title", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title,
        description: description || null,
        priority: priority as any,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        contact_id: contactId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDialogOpen(false);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setContactId("");
      toast.success("Task created");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "completed" ? "pending" : "completed";
      const { error } = await supabase
        .from("tasks")
        .update({
          status: newStatus as any,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const getTaskIcon = (task: any) => {
    if (task.status === "completed") return <CheckCircle2 className="h-5 w-5 text-success" />;
    if (task.due_date && isPast(new Date(task.due_date))) return <AlertCircle className="h-5 w-5 text-destructive" />;
    return <Clock className="h-5 w-5 text-warning" />;
  };

  const getTaskBadge = (task: any) => {
    if (task.status === "completed") return <Badge variant="success" className="text-xs">Done</Badge>;
    if (task.due_date && isPast(new Date(task.due_date))) return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    if (task.due_date && (isToday(new Date(task.due_date)) || isFuture(new Date(task.due_date))))
      return <Badge variant="warning" className="text-xs">Upcoming</Badge>;
    return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Manage follow-ups and to-dos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {tasks?.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card
              className={`transition-colors ${task.status === "completed" ? "opacity-60" : ""}`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <button onClick={() => toggleComplete.mutate({ id: task.id, currentStatus: task.status })}>
                  {getTaskIcon(task)}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === "completed" ? "line-through" : ""}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.contacts && (
                      <span className="text-xs text-muted-foreground">
                        {(task.contacts as any).first_name} {(task.contacts as any).last_name}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground">
                        • {format(new Date(task.due_date), "MMM d, h:mm a")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={task.priority === "high" ? "destructive" : task.priority === "low" ? "secondary" : "outline"} className="text-xs capitalize">
                    {task.priority}
                  </Badge>
                  {getTaskBadge(task)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {(!tasks || tasks.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tasks yet. Create one to get started.</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up with lead" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact (optional)</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createTask.mutate()} disabled={!title.trim()}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
