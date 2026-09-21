import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { LoginCallback } from "./pages/LoginCallback";
import { Dashboard } from "./pages/Dashboard";
import { GuildManagement } from "./pages/GuildManagement";
import { Health } from "./pages/Health";
import { Unauthorized } from "./pages/Unauthorized";
import { NotFound } from "./pages/NotFound";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { Footer } from "./components/Footer";

export function App() {
  return (
    <AuthProvider>
      <div className="flex h-screen flex-col bg-discord-dark">
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/health" element={<Health />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/guilds/:guildId"
          element={
            <ProtectedRoute>
              <GuildManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/guilds/:guildId/:system"
          element={
            <ProtectedRoute>
              <GuildManagement />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
