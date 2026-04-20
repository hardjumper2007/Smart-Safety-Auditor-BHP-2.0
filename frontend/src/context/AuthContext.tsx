import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { apiUpdateAvatar } from "../services/api";

interface User {
  user_id: string;
  email: string;
  full_name: string;
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => Promise<void>;
  logout: () => Promise<void>;
  updateAvatar: (avatar: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStoredData = () => {
      try {
        const stored = localStorage.getItem("bhp_user");
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Błąd podczas ładowania danych użytkownika:", error);
        localStorage.removeItem("bhp_user");
      } finally {
        setLoading(false);
      }
    };

    loadStoredData();
  }, []);

  const login = async (userData: User) => {
    try {
      setUser(userData);
      localStorage.setItem("bhp_user", JSON.stringify(userData));
    } catch (error) {
      console.error("Błąd podczas logowania:", error);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      localStorage.removeItem("bhp_user");
    } catch (error) {
      console.error("Błąd podczas wylogowania:", error);
    }
  };

  const updateAvatar = async (avatar: string) => {
    if (!user) return;
    try {
      await apiUpdateAvatar(user.user_id, avatar);
      const updatedUser = { ...user, avatar };
      setUser(updatedUser);
      localStorage.setItem("bhp_user", JSON.stringify(updatedUser));
    } catch (error: any) {
      console.error("Błąd aktualizacji avatara:", error);
      throw new Error(
        error?.response?.data?.detail || "Nie udało się zmienić avatara",
      );
    }
  };

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      updateAvatar,
      loading,
    }),
    [user, loading],
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: 18,
          backgroundColor: "var(--color-bg)",
          color: "var(--color-text)",
        }}
      >
        Ładowanie...
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth musi być używane wewnątrz AuthProvider");
  }
  return context;
}
