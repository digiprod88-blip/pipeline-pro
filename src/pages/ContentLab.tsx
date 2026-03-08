import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Copy, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const CONTENT_TYPES = [
  { value: "ad_copy", label: "Meta Ad Copy" },
  { value: "social_post", label: "Social Media Post" },
  { value: "email_subject", label: "Email Subject Lines" },
  { value: "whatsapp_template", label: "WhatsApp Template" },
];

export default function ContentLab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [productDesc, setProductDesc] = useState("");
  const [contentType, setContentType] = useState("ad_copy");
  const [tone, setTone] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const { data: library } = useQuery({
    queryKey: ["content-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_library")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveContent = useMutation({
    mutationFn: async (content: any) => {
      const { error } = await supabase.from("content_library").insert({
        user_id: user!.id,
        title: content.title,
        content_type: contentType,
        content: content,
        tags: [tone, contentType],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-library"] });
      toast.success("Saved to Content Library");
    },
  });

  const deleteContent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-library"] });
      toast.success("Deleted");
    },
  });

  const generateContent = async () => {
    if (!productDesc.trim()) {
      toast.error("Enter a product/service description");
      return;
    }
    setGenerating(true);

    const prompts: Record<string, string> = {
      ad_copy: `Generate 3 variations of Meta Ad copy for this product/service: "${productDesc}". Tone: ${tone}. For each variation provide: headline (max 40 chars), primary_text (max 125 chars), description (max 30 chars), and cta (call to action text). Return as JSON array with keys: headline, primary_text, description, cta.`,
      social_post: `Generate 3 social media post variations for: "${productDesc}". Tone: ${tone}. Each should have: hook (attention-grabbing first line), body (main content), hashtags (5 relevant hashtags). Return as JSON array with keys: hook, body, hashtags.`,
      email_subject: `Generate 5 email subject line variations for: "${productDesc}". Tone: ${tone}. Each should have: subject (the subject line), preview_text (email preview text). Return as JSON array with keys: subject, preview_text.`,
      whatsapp_template: `Generate 3 WhatsApp message template variations for: "${productDesc}". Tone: ${tone}. Each should have: greeting, body, cta. Keep messages concise. Return as JSON array with keys: greeting, body, cta.`,
    };

    try {
      const response = await supabase.functions.invoke("ai-content-gen", {
        body: { prompt: prompts[contentType], contentType },
      });

      if (response.error) throw response.error;
      setGeneratedContent({
        title: productDesc.slice(0, 50),
        type: contentType,
        variations: response.data.variations,
      });
    } catch (err: any) {
      toast.error("Generation failed: " + (err.message || "Unknown error"));
    } finally {
      setGenerating(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Content Laboratory
          </h1>
          <p className="text-sm text-muted-foreground">Generate ad copies, social posts & marketing content</p>
        </div>
        <Button variant="outline" onClick={() => setShowLibrary(true)}>
          <FileText className="h-4 w-4 mr-2" />Library ({library?.length || 0})
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Input Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Generate Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Content Type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual & Friendly</SelectItem>
                  <SelectItem value="urgent">Urgent / FOMO</SelectItem>
                  <SelectItem value="inspirational">Inspirational</SelectItem>
                  <SelectItem value="humorous">Humorous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product / Service Description</Label>
              <Textarea
                value={productDesc}
                onChange={e => setProductDesc(e.target.value)}
                placeholder="Describe your product, service, or offer..."
                rows={4}
              />
            </div>
            <Button className="w-full" onClick={generateContent} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {generating ? "Generating..." : "Generate Content"}
            </Button>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Generated Variations</CardTitle>
          </CardHeader>
          <CardContent>
            {!generatedContent && !generating && (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Enter a description and generate content</p>
              </div>
            )}
            {generating && (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                <p className="text-muted-foreground">AI is crafting your content...</p>
              </div>
            )}
            {generatedContent && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => saveContent.mutate(generatedContent)}>
                    Save to Library
                  </Button>
                </div>
                {generatedContent.variations?.map((v: any, i: number) => (
                  <Card key={i} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Variation {i + 1}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => copyText(JSON.stringify(v, null, 2))}>
                        <Copy className="h-3 w-3 mr-1" />Copy
                      </Button>
                    </div>
                    {Object.entries(v).map(([key, val]) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                        <p className="text-sm">{String(val)}</p>
                      </div>
                    ))}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Library Dialog */}
      <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Content Library</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {library?.map((item: any) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">{item.content_type}</Badge>
                      {item.tags?.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copyText(JSON.stringify(item.content, null, 2))}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteContent.mutate(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {(!library || library.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">No saved content yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
