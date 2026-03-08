import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import ContactGroups from "./pages/ContactGroups";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import TeamManagement from "./pages/TeamManagement";
import Reports from "./pages/Reports";
import Workflows from "./pages/Workflows";
import CalendarPage from "./pages/CalendarPage";
import CallManagement from "./pages/CallManagement";
import Shop from "./pages/Shop";
import Sites from "./pages/Sites";
import Links from "./pages/Links";
import ContentLab from "./pages/ContentLab";
import ClientPortal from "./pages/portal/ClientPortal";
import BookingPage from "./pages/BookingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="/groups" element={<ContactGroups />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/calls" element={<CallManagement />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/sites" element={<Sites />} />
            <Route path="/links" element={<Links />} />
            <Route path="/team" element={<TeamManagement />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <ClientPortal />
              </ProtectedRoute>
            }
          />
          <Route path="/book/:userId" element={<BookingPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
