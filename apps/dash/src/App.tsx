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

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />
        <Route path="/health" element={<Health />} />
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
    </AuthProvider>
  );
}
