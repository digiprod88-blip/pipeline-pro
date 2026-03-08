import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, BookOpen, Trophy, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LearningJourney() {
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("client_contact_id").eq("user_id", user.id).single();
      return data;
    },
  });

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["lms-enrollments", profile?.client_contact_id],
    queryFn: async () => {
      if (!profile?.client_contact_id) return [];
      const { data, error } = await supabase
        .from("lms_enrollments")
        .select("*")
        .eq("contact_id", profile.client_contact_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.client_contact_id,
  });

  const statusIcon = (status: string) => {
    if (status === "completed") return <Trophy className="h-4 w-4 text-warning" />;
    if (status === "enrolled") return <BookOpen className="h-4 w-4 text-primary" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge variant="success" className="text-xs">Completed</Badge>;
    if (status === "enrolled") return <Badge variant="default" className="text-xs">In Progress</Badge>;
    return <Badge variant="secondary" className="text-xs">{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4" /> My Learning Journey
        </CardTitle>
        <p className="text-xs text-muted-foreground">ADH CONNECT Integration</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>}

        {!isLoading && (!enrollments || enrollments.length === 0) && (
          <div className="rounded-lg bg-accent/50 border border-border p-4 text-center">
            <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">ADH CONNECT LMS</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your learning progress will appear here once you enroll in a course
            </p>
          </div>
        )}

        {enrollments?.map((enrollment: any) => (
          <div key={enrollment.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusIcon(enrollment.status)}
                <p className="text-sm font-medium">{enrollment.course_name}</p>
              </div>
              {statusBadge(enrollment.status)}
            </div>
            <Progress value={enrollment.progress_percent} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{enrollment.progress_percent}% complete</span>
              {enrollment.certificate_url && (
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" asChild>
                  <a href={enrollment.certificate_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Certificate
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
