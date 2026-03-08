import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, Trophy, Lock } from "lucide-react";

export function LearningJourney() {
  const placeholder = [
    { title: "Foundation Module", status: "coming_soon", icon: BookOpen },
    { title: "Advanced Strategies", status: "locked", icon: Lock },
    { title: "Certification", status: "locked", icon: Trophy },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4" /> My Learning Journey
        </CardTitle>
        <p className="text-xs text-muted-foreground">ADH CONNECT Integration</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-accent/50 border border-border p-4 text-center">
          <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">ADH CONNECT LMS</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your learning progress will appear here once connected
          </p>
        </div>
        {placeholder.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border p-3 opacity-60"
          >
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {item.status === "coming_soon" ? "Coming Soon" : "Locked"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
