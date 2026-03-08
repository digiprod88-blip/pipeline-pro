import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Send, Clock, Trash2, Facebook, Instagram, Twitter, CalendarDays, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";

const PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
  { id: "x", label: "X (Twitter)", icon: Twitter, color: "text-foreground" },
];

export default function SocialScheduler() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [contentLibOpen, setContentLibOpen] = useState(false);

  const [form, setForm] = useState({
    content: "",
    platforms: [] as string[],
    scheduled_at: "",
    image_url: "",
  });

  const { data: posts } = useQuery({
    queryKey: ["scheduled-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: contentLibrary } = useQuery({
    queryKey: ["content-library-for-scheduler"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_library")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("scheduled_posts").insert({
        user_id: user!.id,
        content: form.content,
        platforms: form.platforms,
        scheduled_at: form.scheduled_at,
        image_url: form.image_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      setOpen(false);
      setForm({ content: "", platforms: [], scheduled_at: "", image_url: "" });
      toast.success("Post scheduled!");
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      toast.success("Post deleted");
    },
  });

  const togglePlatform = (platform: string) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const pullFromLibrary = (item: any) => {
    const content = item.content;
    let text = "";
    if (content.variations?.[0]) {
      const v = content.variations[0];
      text = v.hook ? `${v.hook}\n\n${v.body}\n\n${v.hashtags || ""}` :
        v.primary_text ? `${v.headline}\n\n${v.primary_text}` :
        v.greeting ? `${v.greeting}\n\n${v.body}\n\n${v.cta}` :
        JSON.stringify(v);
    }
    setForm(prev => ({ ...prev, content: text.trim() }));
    setContentLibOpen(false);
    toast.success("Content pulled from library!");
  };

  const dayPosts = posts?.filter(p => isSameDay(new Date(p.scheduled_at), selectedDate)) || [];
  const upcomingPosts = posts?.filter(p => new Date(p.scheduled_at) >= new Date()) || [];

  const platformIcon = (platformId: string) => {
    const p = PLATFORMS.find(pl => pl.id === platformId);
    if (!p) return null;
    const Icon = p.icon;
    return <Icon className={`h-3 w-3 ${p.color}`} />;
  };

  return (
    <div className="p-6 space-y-6">
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Send className="h-6 w-6 text-primary" /> Social Media Scheduler
          </h1>
          <p className="text-muted-foreground text-sm">Schedule posts across Facebook, Instagram & X</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Post</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Schedule Post</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Content</Label>
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setContentLibOpen(true)}>
                    <FileText className="h-3 w-3 mr-1" /> Pull from Content Lab
                  </Button>
                </div>
                <Textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="Write your post content..."
                  rows={4}
                />
              </div>

              <div>
                <Label>Platforms</Label>
                <div className="flex gap-3 mt-2">
                  {PLATFORMS.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={form.platforms.includes(p.id)}
                        onCheckedChange={() => togglePlatform(p.id)}
                      />
                      <p.icon className={`h-4 w-4 ${p.color}`} />
                      <span className="text-sm">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Schedule Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </div>

              <div>
                <Label>Image URL (optional)</Label>
                <Input
                  value={form.image_url}
                  onChange={e => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <Button
                className="w-full"
                onClick={() => createPost.mutate()}
                disabled={!form.content || form.platforms.length === 0 || !form.scheduled_at}
              >
                Schedule Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content Library Picker */}
      <Dialog open={contentLibOpen} onOpenChange={setContentLibOpen}>
        <DialogContent className="max-w-md max-h-[60vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Select from Content Lab</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {contentLibrary?.map((item: any) => (
              <Card key={item.id} className="p-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => pullFromLibrary(item)}>
                <p className="text-sm font-medium">{item.title}</p>
                <Badge variant="outline" className="text-xs mt-1">{item.content_type}</Badge>
              </Card>
            ))}
            {(!contentLibrary || contentLibrary.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No content in library yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card>
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              modifiers={{
                hasPost: posts?.map(p => new Date(p.scheduled_at)) || [],
              }}
              modifiersClassNames={{
                hasPost: "bg-primary/20 font-bold",
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </h2>

          {dayPosts.length === 0 && (
            <p className="text-sm text-muted-foreground">No posts scheduled for this day</p>
          )}

          {dayPosts.map((post: any) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <p className="text-sm whitespace-pre-wrap">{post.content.slice(0, 200)}{post.content.length > 200 ? "..." : ""}</p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(post.scheduled_at), "HH:mm")}
                      </span>
                      <div className="flex gap-1">
                        {post.platforms?.map((p: string) => (
                          <span key={p}>{platformIcon(p)}</span>
                        ))}
                      </div>
                      <Badge
                        variant={post.status === "published" ? "success" : post.status === "failed" ? "destructive" : "outline"}
                        className="text-xs capitalize"
                      >
                        {post.status}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deletePost.mutate(post.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Upcoming posts summary */}
          {upcomingPosts && upcomingPosts.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">Upcoming Posts ({upcomingPosts.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingPosts.slice(0, 5).map((post: any) => (
                  <div key={post.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {post.platforms?.map((p: string) => (
                          <span key={p}>{platformIcon(p)}</span>
                        ))}
                      </div>
                      <span className="truncate max-w-[200px]">{post.content.slice(0, 50)}...</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(post.scheduled_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {(!posts || posts.length === 0) && (
        <Card className="p-12 text-center">
          <Send className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="font-semibold">No scheduled posts yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first social media post</p>
        </Card>
      )}
    </div>
  );
}
