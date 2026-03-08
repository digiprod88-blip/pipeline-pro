import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Image, Music, Save, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface JournalVisionBoardProps {
  contactId: string;
}

export function JournalVisionBoard({ contactId }: JournalVisionBoardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [gratitudes, setGratitudes] = useState("");
  const [intentions, setIntentions] = useState("");
  const [reflections, setReflections] = useState("");

  const { data: todayEntry } = useQuery({
    queryKey: ["journal-today", contactId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_journals")
        .select("*")
        .eq("contact_id", contactId)
        .eq("entry_date", today)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setGratitudes(data.gratitudes || "");
        setIntentions(data.intentions || "");
        setReflections(data.reflections || "");
      }
      return data;
    },
    enabled: !!contactId,
  });

  const { data: pastEntries } = useQuery({
    queryKey: ["journal-past", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_journals")
        .select("*")
        .eq("contact_id", contactId)
        .neq("entry_date", today)
        .order("entry_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const { data: visionImages } = useQuery({
    queryKey: ["vision-board", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vision_board_images")
        .select("*")
        .eq("contact_id", contactId)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const saveJournal = useMutation({
    mutationFn: async () => {
      if (todayEntry) {
        const { error } = await supabase
          .from("client_journals")
          .update({ gratitudes, intentions, reflections, updated_at: new Date().toISOString() })
          .eq("id", todayEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_journals").insert({
          user_id: user!.id,
          contact_id: contactId,
          entry_date: today,
          gratitudes,
          intentions,
          reflections,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-today"] });
      queryClient.invalidateQueries({ queryKey: ["journal-past"] });
      toast.success("Journal saved!");
    },
    onError: () => toast.error("Failed to save"),
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const path = `${user!.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("vision-board").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("vision-board").getPublicUrl(path);
      const { error } = await supabase.from("vision_board_images").insert({
        user_id: user!.id,
        contact_id: contactId,
        image_url: urlData.publicUrl,
        position: (visionImages?.length ?? 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vision-board"] });
      toast.success("Image added to vision board!");
    },
    onError: () => toast.error("Upload failed"),
  });

  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vision_board_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vision-board"] });
      toast.success("Removed");
    },
  });

  return (
    <Tabs defaultValue="journal" className="space-y-4">
      <TabsList>
        <TabsTrigger value="journal" className="text-xs">
          <BookOpen className="h-3.5 w-3.5 mr-1" /> Daily Journal
        </TabsTrigger>
        <TabsTrigger value="vision" className="text-xs">
          <Image className="h-3.5 w-3.5 mr-1" /> Vision Board
        </TabsTrigger>
        <TabsTrigger value="audio" className="text-xs">
          <Music className="h-3.5 w-3.5 mr-1" /> Affirmations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="journal" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Today's Journal — {format(new Date(), "EEEE, MMM d")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-medium">🙏 Gratitudes</Label>
              <Textarea
                value={gratitudes}
                onChange={(e) => setGratitudes(e.target.value)}
                placeholder="What are you grateful for today?"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">🎯 Intentions</Label>
              <Textarea
                value={intentions}
                onChange={(e) => setIntentions(e.target.value)}
                placeholder="What do you intend to achieve today?"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">💭 Reflections</Label>
              <Textarea
                value={reflections}
                onChange={(e) => setReflections(e.target.value)}
                placeholder="End-of-day reflections..."
                className="mt-1"
                rows={3}
              />
            </div>
            <Button onClick={() => saveJournal.mutate()} disabled={saveJournal.isPending}>
              <Save className="h-4 w-4 mr-2" /> Save Journal
            </Button>
          </CardContent>
        </Card>

        {pastEntries && pastEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Past Entries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pastEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {format(new Date(entry.entry_date), "EEEE, MMM d, yyyy")}
                  </p>
                  {entry.gratitudes && <p className="text-sm">🙏 {entry.gratitudes}</p>}
                  {entry.intentions && <p className="text-sm">🎯 {entry.intentions}</p>}
                  {entry.reflections && <p className="text-sm">💭 {entry.reflections}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="vision">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">My Vision Board</CardTitle>
              <Label htmlFor="vision-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Image
                </div>
                <Input
                  id="vision-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage.mutate(file);
                  }}
                />
              </Label>
            </div>
          </CardHeader>
          <CardContent>
            {(!visionImages || visionImages.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Upload images that represent your goals and dreams ✨
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visionImages?.map((img) => (
                <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square">
                  <img
                    src={img.image_url}
                    alt={img.caption || "Vision"}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => deleteImage.mutate(img.id)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="audio">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="h-4 w-4" /> Daily Guided Affirmation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-6 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Music className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-medium">Morning Manifestation Audio</h3>
              <p className="text-sm text-muted-foreground">
                Your guided affirmation session will be available here. 
                Connect with your coach for access to premium audio content.
              </p>
              <div className="bg-muted rounded-full h-2 w-full">
                <div className="bg-primary/30 rounded-full h-2 w-0" />
              </div>
              <p className="text-xs text-muted-foreground">Coming Soon</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
