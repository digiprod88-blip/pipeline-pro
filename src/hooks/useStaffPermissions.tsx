import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface StaffPermissions {
  role: string;
  hide_finance: boolean;
  hide_phone: boolean;
  disable_export: boolean;
  read_only_funnel: boolean;
  pipeline_access: string;
  isAdmin: boolean;
  isStaff: boolean;
  isClient: boolean;
  canViewFinance: boolean;
  canViewPhone: boolean;
  canExport: boolean;
  canEditFunnel: boolean;
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
  const disable_export = (roleData as any)?.disable_export || false;
  const read_only_funnel = (roleData as any)?.read_only_funnel || false;
  const pipeline_access = roleData?.pipeline_access || "full";

  const isAdmin = role === "admin";
  const isStaff = role === "staff" || role === "admin";
  const isClient = role === "client";

  const canViewFinance = isAdmin || !hide_finance;
  const canViewPhone = isAdmin || !hide_phone;
  const canExport = isAdmin || !disable_export;
  const canEditFunnel = isAdmin || !read_only_funnel;

  return {
    role,
    hide_finance,
    hide_phone,
    disable_export,
    read_only_funnel,
    pipeline_access,
    isAdmin,
    isStaff,
    isClient,
    canViewFinance,
    canViewPhone,
    canExport,
    canEditFunnel,
    isLoading,
  };
}
