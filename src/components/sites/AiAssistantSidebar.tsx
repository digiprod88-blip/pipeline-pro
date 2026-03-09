import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { PageBlock, BlockType } from "./PageBuilder";

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
  blocks?: PageBlock[];
  onUpdateBlocks?: (blocks: PageBlock[]) => void;
}

// Parse AI edit commands and modify blocks accordingly
function processEditCommand(prompt: string, blocks: PageBlock[]): PageBlock[] | null {
  const lower = prompt.toLowerCase();

  // Change heading/text color
  const colorMatch = lower.match(/change.*(?:heading|headline|title).*color.*to\s+(\w+)/i)
    || lower.match(/make.*(?:heading|headline|title).*(\w+)\s*color/i);
  if (colorMatch) {
    const color = colorMatch[1];
    return blocks.map(b => ({
      ...b,
      advanced: { ...b.advanced, customCss: `${b.advanced?.customCss || ""}\ncolor: ${color};`.trim() },
    }));
  }

  // Add a features section
  if (lower.includes("add") && lower.includes("feature")) {
    const colMatch = lower.match(/(\d+)[\s-]*column/);
    const cols = colMatch ? parseInt(colMatch[1]) : 3;
    const content: Record<string, string> = { title: "Our Features" };
    for (let i = 1; i <= cols; i++) {
      content[`feature${i}`] = `Feature ${i}`;
      content[`desc${i}`] = `Description for feature ${i}`;
    }
    const newBlock: PageBlock = {
      id: crypto.randomUUID(),
      type: "features",
      content,
    };
    return [...blocks, newBlock];
  }

  // Add CTA section
  if (lower.includes("add") && (lower.includes("cta") || lower.includes("call to action"))) {
    const newBlock: PageBlock = {
      id: crypto.randomUUID(),
      type: "cta",
      content: { headline: "Ready to get started?", subheadline: "Join thousands of happy customers", buttonText: "Start Free Trial" },
    };
    return [...blocks, newBlock];
  }

  // Add testimonials section
  if (lower.includes("add") && lower.includes("testimonial")) {
    const newBlock: PageBlock = {
      id: crypto.randomUUID(),
      type: "testimonials",
      content: { title: "What our customers say", name1: "John Doe", quote1: "Amazing product!", name2: "Jane Smith", quote2: "Highly recommended!" },
    };
    return [...blocks, newBlock];
  }

  // Add hero section
  if (lower.includes("add") && lower.includes("hero")) {
    const newBlock: PageBlock = {
      id: crypto.randomUUID(),
      type: "hero",
      content: { headline: "Your headline here", subheadline: "Supporting text", buttonText: "Get Started" },
    };
    return [...blocks, newBlock];
  }

  // Remove last block
  if (lower.includes("remove") && lower.includes("last")) {
    return blocks.slice(0, -1);
  }

  // Change button text
  const btnMatch = lower.match(/change.*button.*text.*to\s+"?([^"]+)"?/i);
  if (btnMatch) {
    const newText = btnMatch[1].trim();
    return blocks.map(b => {
      if (b.content.buttonText !== undefined) {
        return { ...b, content: { ...b.content, buttonText: newText } };
      }
      return b;
    });
  }

  // Change headline text
  const headlineMatch = lower.match(/change.*(?:heading|headline).*to\s+"?([^"]+)"?/i);
  if (headlineMatch) {
    const newText = headlineMatch[1].trim();
    return blocks.map(b => {
      if (b.content.headline !== undefined) {
        return { ...b, content: { ...b.content, headline: newText } };
      }
      return b;
    });
  }

  return null; // Couldn't parse
}

export function AiAssistantSidebar({ onApply, blocks, onUpdateBlocks }: AiAssistantSidebarProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [mode, setMode] = useState<"generate" | "edit">("generate");

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

  const handleEdit = () => {
    if (!prompt.trim() || !blocks || !onUpdateBlocks) return;
    const updated = processEditCommand(prompt.trim(), blocks);
    if (updated) {
      onUpdateBlocks(updated);
      toast.success("Page updated via AI command!");
      setPrompt("");
    } else {
      toast.error("Couldn't understand that command. Try: 'Add a 3-column feature section' or 'Change heading color to blue'");
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
        {blocks && onUpdateBlocks && (
          <div className="flex gap-1 mt-2">
            <Button variant={mode === "generate" ? "default" : "outline"} size="sm" className="text-xs h-7"
              onClick={() => setMode("generate")}>Generate</Button>
            <Button variant={mode === "edit" ? "default" : "outline"} size="sm" className="text-xs h-7"
              onClick={() => setMode("edit")}><Wand2 className="h-3 w-3 mr-1" />Edit Page</Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mode === "edit" 
            ? "e.g. 'Change the heading color to blue' or 'Add a 3-column feature section'" 
            : "Describe your landing page..."}
          className="min-h-[80px] text-sm"
        />
        {mode === "edit" ? (
          <Button onClick={handleEdit} disabled={!prompt.trim()} className="w-full" size="sm">
            <Wand2 className="h-4 w-4 mr-2" />
            Apply Edit
          </Button>
        ) : (
          <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full" size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? "Generating..." : "Generate Content"}
          </Button>
        )}

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
