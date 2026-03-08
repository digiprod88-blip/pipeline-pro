import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .single();
      return data?.role ?? null;
    },
    enabled: !!user,
  });

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Client users: redirect to portal if not already there
  if (role === "client" && !location.pathname.startsWith("/portal")) {
    return <Navigate to="/portal" replace />;
  }

  // Non-client users: redirect away from portal
  if (role !== "client" && location.pathname.startsWith("/portal")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
