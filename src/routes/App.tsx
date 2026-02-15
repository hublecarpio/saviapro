import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "../pages/Auth";
import Chat from "../pages/Chat";
import Starter from "../pages/Starter";

import Tutor from "../pages/Tutor";
import TutorDashboard from "../pages/TutorDashboard";
import NotFound from "../pages/NotFound";
import MindMap from "../pages/MindMap";
import ResetPassword from "../pages/ResetPassword";
import { ProtectedRoute } from "./ProtetectedRoute";
import AdminBeta from "@/pages/AdminBeta";
import { DashboardLayout } from "@/layout/DashboardLayout";
import Prompt from "@/components/user/Prompt";
import RegisterUser from "@/components/user/RegisterUser";
import ListUser from "@/components/user/ListUser";
import InviteRegister from "@/pages/InviteRegister";
import { AdminConversationHistory } from "@/components/admin/AdminConversationHistory";
import { AuthProvider } from "@/providers/AuthProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/register/:token" element={<InviteRegister />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
            <Route
              path="/mindmap/:conversationId"
              element={
                <ProtectedRoute>
                  <MindMap />
                </ProtectedRoute>
              }
            />
            <Route path="/starter" element={
              <ProtectedRoute>
                <Starter />
              </ProtectedRoute>} />
            {/**admin */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Prompt />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/userlist" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <RegisterUser />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <ListUser />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/history" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <AdminConversationHistory />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            {/**end admin */}
            <Route path="/tutor/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <TutorDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/tutor" element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Tutor />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
