import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Kanban, CheckSquare, Settings, LogOut,
  Search, UserCog, BarChart3, FolderOpen, Zap, CalendarDays, Phone, ShoppingCart, Globe, Link2, Sparkles, Target, Send, Shield, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Pipeline", icon: Kanban, path: "/pipeline" },
  { label: "Contacts", icon: Users, path: "/contacts" },
  { label: "Groups", icon: FolderOpen, path: "/groups" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
  { label: "Workflows", icon: Zap, path: "/workflows" },
  { label: "Calendar", icon: CalendarDays, path: "/calendar" },
  { label: "Calls", icon: Phone, path: "/calls" },
  { label: "Shop", icon: ShoppingCart, path: "/shop" },
  { label: "Sites", icon: Globe, path: "/sites" },
  { label: "Links", icon: Link2, path: "/links" },
  { label: "Content Lab", icon: Sparkles, path: "/content-lab" },
  { label: "Segments", icon: Target, path: "/segments" },
  { label: "Social", icon: Send, path: "/social" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Audit & Security", icon: Shield, path: "/audit" },
  { label: "Team", icon: UserCog, path: "/team" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canInstall, install } = usePWAInstall();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <aside className="flex h-screen w-60 flex-col glass-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">P</span>
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground tracking-tight">Pipeline Pro</span>
        </div>
        <NotificationBell />
      </div>

      <div className="px-3 py-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search..." className="h-8 pl-8 text-xs bg-sidebar-accent border-sidebar-border rounded-lg" />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button variant="ghost" className="w-full justify-start gap-2.5 text-xs text-muted-foreground hover:text-foreground h-8" onClick={handleLogout}>
          <LogOut className="h-3.5 w-3.5" />Sign out
        </Button>
      </div>
    </aside>
  );
}
