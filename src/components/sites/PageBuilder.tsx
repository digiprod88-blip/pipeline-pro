import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Save, Eye, Plus, Type, Image, Star, MessageSquare, Layout, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { SortableBlock } from "./SortableBlock";

export type BlockType = "hero" | "features" | "cta" | "testimonials" | "text" | "image";

export interface PageBlock {
  id: string;
  type: BlockType;
  content: Record<string, string>;
}

const BLOCK_TEMPLATES: { type: BlockType; label: string; icon: React.ElementType; defaults: Record<string, string> }[] = [
  { type: "hero", label: "Hero Section", icon: Layout, defaults: { headline: "Your headline here", subheadline: "Supporting text that explains your value proposition", buttonText: "Get Started" } },
  { type: "features", label: "Features", icon: Zap, defaults: { title: "Features", feature1: "Feature One", desc1: "Description", feature2: "Feature Two", desc2: "Description", feature3: "Feature Three", desc3: "Description" } },
  { type: "cta", label: "Call to Action", icon: Star, defaults: { headline: "Ready to get started?", subheadline: "Join thousands of happy customers", buttonText: "Start Free Trial" } },
  { type: "testimonials", label: "Testimonials", icon: MessageSquare, defaults: { title: "What our customers say", name1: "John Doe", quote1: "This product changed everything!", name2: "Jane Smith", quote2: "Absolutely love it!" } },
  { type: "text", label: "Text Block", icon: Type, defaults: { heading: "Section Title", body: "Write your content here..." } },
  { type: "image", label: "Image + Text", icon: Image, defaults: { heading: "Visual Section", body: "Describe your image content", imageUrl: "" } },
];

interface PageBuilderProps {
  pageId: string;
  pageTitle: string;
  initialBlocks: PageBlock[];
  onSave: (blocks: PageBlock[]) => void;
  onBack: () => void;
  saving?: boolean;
}

export function PageBuilder({ pageId, pageTitle, initialBlocks, onSave, onBack, saving }: PageBuilderProps) {
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id);
        const newIndex = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const addBlock = (type: BlockType) => {
    const template = BLOCK_TEMPLATES.find((t) => t.type === type)!;
    const newBlock: PageBlock = {
      id: crypto.randomUUID(),
      type,
      content: { ...template.defaults },
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlock(newBlock.id);
    setShowPalette(false);
    toast.success(`${template.label} added`);
  };

  const updateBlockContent = (blockId: string, key: string, value: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, [key]: value } } : b))
    );
  };

  const removeBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedBlock === blockId) setSelectedBlock(null);
  };

  const selectedBlockData = blocks.find((b) => b.id === selectedBlock);

  return (
    <div className="flex h-full">
      {/* Main Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <h2 className="text-sm font-medium truncate max-w-[200px]">{pageTitle}</h2>
            <Badge variant="secondary" className="text-xs">{blocks.length} blocks</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPalette(!showPalette)}>
              <Plus className="h-4 w-4 mr-1" /> Add Block
            </Button>
            <Button size="sm" onClick={() => onSave(blocks)} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Block Palette */}
        <AnimatePresence>
          {showPalette && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border bg-muted/30 overflow-hidden"
            >
              <div className="p-4 grid grid-cols-3 md:grid-cols-6 gap-2">
                {BLOCK_TEMPLATES.map((t) => (
                  <button
                    key={t.type}
                    onClick={() => addBlock(t.type)}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-accent transition-colors text-xs"
                  >
                    <t.icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-foreground font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Layout className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">No blocks yet. Click "Add Block" to start building.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3 max-w-3xl mx-auto">
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedBlock === block.id}
                      onSelect={() => setSelectedBlock(block.id)}
                      onRemove={() => removeBlock(block.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Properties Panel */}
      <AnimatePresence>
        {selectedBlockData && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-l border-border bg-card overflow-hidden shrink-0"
          >
            <div className="w-[320px] h-full overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold capitalize">{selectedBlockData.type} Settings</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedBlock(null)}>✕</Button>
              </div>
              {Object.entries(selectedBlockData.content).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").replace(/(\d+)/g, " $1")}</label>
                  {value.length > 60 || key === "body" ? (
                    <Textarea
                      value={value}
                      onChange={(e) => updateBlockContent(selectedBlockData.id, key, e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                  ) : (
                    <Input
                      value={value}
                      onChange={(e) => updateBlockContent(selectedBlockData.id, key, e.target.value)}
                      className="text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
