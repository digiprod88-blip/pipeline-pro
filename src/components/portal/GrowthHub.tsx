import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Target, Plus, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addDays } from "date-fns";

const DAILY_AFFIRMATIONS = [
  "I am worthy of success and abundance",
  "My potential is limitless",
  "I attract opportunities effortlessly",
  "I am becoming the best version of myself",
  "Every challenge strengthens me",
  "I radiate confidence and positivity",
  "My goals are within reach",
];

interface GrowthHubProps {
  contactId: string;
}

export function GrowthHub({ contactId }: GrowthHubProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: "", target_days: 30 });

  const { data: goals } = useQuery({
    queryKey: ["manifestation-goals", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manifestation_goals")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const addGoalMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("manifestation_goals").insert({
        user_id: user!.id,
        contact_id: contactId,
        title: newGoal.title,
        target_days: newGoal.target_days,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manifestation-goals"] });
      setNewGoal({ title: "", target_days: 30 });
      setShowAdd(false);
      toast.success("Goal created!");
    },
    onError: () => toast.error("Failed to create goal"),
  });

  const checkDayMutation = useMutation({
    mutationFn: async ({ goalId, dayNum, completed }: { goalId: string; dayNum: number; completed: number[] }) => {
      const newCompleted = completed.includes(dayNum)
        ? completed.filter((d) => d !== dayNum)
        : [...completed, dayNum];
      const { error } = await supabase
        .from("manifestation_goals")
        .update({ completed_days: newCompleted })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manifestation-goals"] }),
  });

  const todayAffirmation = DAILY_AFFIRMATIONS[new Date().getDay()];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Growth Hub
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Goal
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily Affirmation */}
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 text-center">
          <Sparkles className="h-5 w-5 mx-auto text-primary mb-2" />
          <p className="text-sm font-medium italic">"{todayAffirmation}"</p>
          <p className="text-xs text-muted-foreground mt-1">Today's Affirmation</p>
        </div>

        {/* Add Goal Form */}
        {showAdd && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <Label className="text-xs">Goal Title</Label>
              <Input
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                placeholder="e.g., Practice gratitude daily"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Duration (days)</Label>
              <Input
                type="number"
                value={newGoal.target_days}
                onChange={(e) => setNewGoal({ ...newGoal, target_days: Number(e.target.value) })}
                min={7}
                max={90}
                className="mt-1"
              />
            </div>
            <Button
              size="sm"
              onClick={() => addGoalMutation.mutate()}
              disabled={!newGoal.title || addGoalMutation.isPending}
            >
              Create Goal
            </Button>
          </div>
        )}

        {/* Goals List */}
        {(!goals || goals.length === 0) && !showAdd && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No goals yet. Set your first 30-day manifestation goal!
          </p>
        )}

        {goals?.map((goal: any) => {
          const completedDays: number[] = goal.completed_days || [];
          const progress = (completedDays.length / goal.target_days) * 100;
          const today = differenceInDays(new Date(), new Date(goal.start_date)) + 1;
          const displayDays = Math.min(goal.target_days, Math.max(today + 2, 7));

          return (
            <div key={goal.id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{goal.title}</h4>
                <Badge variant={progress >= 100 ? "success" : "secondary"} className="text-xs">
                  {completedDays.length}/{goal.target_days} days
                </Badge>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: displayDays }, (_, i) => i + 1).map((day) => {
                  const isCompleted = completedDays.includes(day);
                  const isToday = day === today;
                  const isFuture = day > today;
                  return (
                    <button
                      key={day}
                      disabled={isFuture}
                      onClick={() =>
                        checkDayMutation.mutate({
                          goalId: goal.id,
                          dayNum: day,
                          completed: completedDays,
                        })
                      }
                      className={`h-7 w-7 rounded text-xs font-medium flex items-center justify-center transition-colors ${
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : isToday
                          ? "border-2 border-primary text-primary"
                          : isFuture
                          ? "bg-muted text-muted-foreground/40"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : day}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Started {format(new Date(goal.start_date), "MMM d, yyyy")} · Ends{" "}
                {format(addDays(new Date(goal.start_date), goal.target_days - 1), "MMM d, yyyy")}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
