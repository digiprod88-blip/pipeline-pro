import { cn } from "@/lib/utils";

interface LeadScoreBadgeProps {
  score: number;
  className?: string;
}

export default function LeadScoreBadge({ score, className }: LeadScoreBadgeProps) {
  const getVariant = () => {
    if (score >= 80) return "bg-destructive/15 text-destructive border-destructive/30";
    if (score >= 40) return "bg-warning/15 text-warning border-warning/30";
    if (score > 0) return "bg-muted text-muted-foreground border-border";
    return "bg-muted/50 text-muted-foreground/50 border-transparent";
  };

  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums min-w-[2rem]",
      getVariant(),
      className
    )}>
      {score}
    </span>
  );
}
