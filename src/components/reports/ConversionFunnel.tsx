import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface FunnelStep {
  label: string;
  count: number;
  color: string;
}

interface ConversionFunnelProps {
  steps: FunnelStep[];
}

export function ConversionFunnel({ steps }: ConversionFunnelProps) {
  const maxCount = Math.max(...steps.map((s) => s.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, i) => {
          const widthPct = Math.max((step.count / maxCount) * 100, 8);
          const conversionFromPrev = i > 0 && steps[i - 1].count > 0
            ? ((step.count / steps[i - 1].count) * 100).toFixed(0)
            : null;

          return (
            <div key={step.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{step.count}</span>
                  {conversionFromPrev && (
                    <span className="text-muted-foreground">({conversionFromPrev}%)</span>
                  )}
                </div>
              </div>
              <motion.div
                className="h-8 rounded-md"
                style={{ backgroundColor: step.color }}
                initial={{ width: 0 }}
                animate={{ width: `${widthPct}%` }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              />
            </div>
          );
        })}
        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No funnel data</p>
        )}
      </CardContent>
    </Card>
  );
}
