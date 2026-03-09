import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Layout, Zap, Star, MessageSquare, Type, Image, FormInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PageBlock, BlockType } from "./PageBuilder";

const BLOCK_ICONS: Record<BlockType, React.ElementType> = {
  hero: Layout,
  features: Zap,
  cta: Star,
  testimonials: MessageSquare,
  text: Type,
  image: Image,
  popup_form: FormInput,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero Section",
  features: "Features",
  cta: "Call to Action",
  testimonials: "Testimonials",
  text: "Text Block",
  image: "Image + Text",
  popup_form: "Popup Form",
};

function BlockPreview({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return (
        <div className="text-center py-6 px-4">
          <h2 className="text-lg font-bold text-foreground">{block.content.headline}</h2>
          <p className="text-sm text-muted-foreground mt-1">{block.content.subheadline}</p>
          <div className="mt-3">
            <span className="inline-block px-4 py-1.5 bg-primary text-primary-foreground text-xs rounded-md">
              {block.content.buttonText}
            </span>
          </div>
        </div>
      );
    case "features":
      return (
        <div className="py-4 px-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{block.content.title}</h3>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center">
                <div className="h-8 w-8 mx-auto rounded-full bg-accent mb-1.5" />
                <p className="text-xs font-medium text-foreground">{block.content[`feature${i}`]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{block.content[`desc${i}`]}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="text-center py-5 px-4 bg-accent/30 rounded-md">
          <h3 className="text-sm font-bold text-foreground">{block.content.headline}</h3>
          <p className="text-xs text-muted-foreground mt-1">{block.content.subheadline}</p>
          <span className="inline-block mt-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs rounded-md">
            {block.content.buttonText}
          </span>
        </div>
      );
    case "testimonials":
      return (
        <div className="py-4 px-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{block.content.title}</h3>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="p-3 bg-accent/30 rounded-md">
                <p className="text-xs italic text-muted-foreground">"{block.content[`quote${i}`]}"</p>
                <p className="text-xs font-medium text-foreground mt-2">— {block.content[`name${i}`]}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "text":
      return (
        <div className="py-4 px-4">
          <h3 className="text-sm font-semibold text-foreground">{block.content.heading}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{block.content.body}</p>
        </div>
      );
    case "image":
      return (
        <div className="py-4 px-4 flex gap-4 items-center">
          <div className="h-16 w-24 bg-accent rounded-md shrink-0 flex items-center justify-center">
            <Image className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{block.content.heading}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{block.content.body}</p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

interface SortableBlockProps {
  block: PageBlock;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function SortableBlock({ block, isSelected, onSelect, onRemove }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = BLOCK_ICONS[block.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card transition-all cursor-pointer",
        isSelected ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-muted-foreground/40",
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={onSelect}
    >
      {/* Block Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{BLOCK_LABELS[block.type]}</span>
        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Block Preview */}
      <BlockPreview block={block} />
    </div>
  );
}
