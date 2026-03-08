import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface AiResult {
  headline: string;
  subheadline: string;
  cta_text: string;
  sections: { title: string; content: string; type: string }[];
  meta_title: string;
  meta_description: string;
}

interface AiAssistantSidebarProps {
  onApply?: (result: AiResult) => void;
}

export function AiAssistantSidebar({ onApply }: AiAssistantSidebarProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-landing-page", {
        body: { prompt: prompt.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as AiResult);
      toast.success("Content generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate content");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const text = `# ${result.headline}\n${result.subheadline}\n\nCTA: ${result.cta_text}\n\n${result.sections.map(s => `## ${s.title}\n${s.content}`).join("\n\n")}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your landing page... e.g. 'A webinar registration page for a digital marketing course targeting small business owners'"
          className="min-h-[80px] text-sm"
        />
        <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full" size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {loading ? "Generating..." : "Generate Content"}
        </Button>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto space-y-3"
            >
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">Generated</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyAll}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {onApply && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onApply(result)}>
                      Apply
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Headline</p>
                  <p className="font-semibold">{result.headline}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">Subheadline</p>
                  <p>{result.subheadline}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">CTA</p>
                  <Badge>{result.cta_text}</Badge>
                </div>
                {result.sections.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-muted-foreground">{s.type}</p>
                    </div>
                    <p className="font-medium text-xs">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.content}</p>
                  </div>
                ))}
                <div className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground mb-1">SEO</p>
                  <p className="text-xs font-medium">{result.meta_title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{result.meta_description}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
