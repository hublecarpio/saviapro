import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "../pages/Auth";
import Chat from "../pages/Chat";
import Starter from "../pages/Starter";
import Admin from "../pages/Admin";
import Tutor from "../pages/Tutor";
import NotFound from "../pages/NotFound";
import { ProtectedRoute } from "./ProtetectedRoute";
import AdminBeta from "@/pages/AdminBeta";
import { DashboardLayout } from "@/layout/DashboardLaout";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:conversationId"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route path="/starter" element={
            <ProtectedRoute>
              <Starter />
            </ProtectedRoute>} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <DashboardLayout>
                <AdminBeta />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/tutor" element={<Tutor />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
