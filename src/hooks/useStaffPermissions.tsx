import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface StaffPermissions {
  role: string;
  hide_finance: boolean;
  hide_phone: boolean;
  pipeline_access: string;
  isAdmin: boolean;
  isStaff: boolean;
  isClient: boolean;
  canViewFinance: boolean;
  canViewPhone: boolean;
}

export function useStaffPermissions(): StaffPermissions & { isLoading: boolean } {
  const { user } = useAuth();

  const { data: roleData, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const role = roleData?.role || "viewer";
  const hide_finance = roleData?.hide_finance || false;
  const hide_phone = roleData?.hide_phone || false;
  const pipeline_access = roleData?.pipeline_access || "full";

  const isAdmin = role === "admin";
  const isStaff = role === "staff" || role === "admin";
  const isClient = role === "client";

  // Admins can always see everything
  const canViewFinance = isAdmin || !hide_finance;
  const canViewPhone = isAdmin || !hide_phone;

  return {
    role,
    hide_finance,
    hide_phone,
    pipeline_access,
    isAdmin,
    isStaff,
    isClient,
    canViewFinance,
    canViewPhone,
    isLoading,
  };
}
