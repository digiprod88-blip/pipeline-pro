import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface TaskCommentsProps {
  taskId: string;
}

export default function TaskComments({ taskId }: TaskCommentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  const { data: comments } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, profiles(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        user_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      setContent("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Team Notes ({comments?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {comments?.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-secondary/50 p-2.5 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs">
                  {(comment.profiles as any)?.full_name || "Team"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(comment.created_at), "MMM d, HH:mm")}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">{comment.content}</p>
            </div>
          ))}
          {(!comments || comments.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-2">No notes yet</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a note..."
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && content.trim()) addComment.mutate();
            }}
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => addComment.mutate()}
            disabled={!content.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
