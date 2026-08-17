import { useEffect, useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { DashboardLayout } from "./components/DashboardLayout";
import API_BASE from "./api";

type User = {
  id: number;
  username: string;
  role: "ADMIN" | "USER";
  ledgerPermissions?: {
    columns: Record<string, boolean>;
  };
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔁 RESTORE SESSION ON REFRESH
  useEffect(() => {
    const restoreUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Session expired");

        const userData = await res.json();
        setUser(userData);

        // optional but useful
        localStorage.setItem("user", JSON.stringify(userData));
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreUser();
  }, []);

  // 🔑 LOGIN HANDLER
  const handleLogin = (data: { user: User }) => {
    setUser(data.user);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  // 🚪 LOGOUT HANDLER
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
  };

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <DashboardLayout user={user} onLogout={handleLogout} />;
}
