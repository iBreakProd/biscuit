"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  const clearAuth = () => {
    localStorage.removeItem("biscuit_auth_token");
    setToken(null);
    setUser(null);
  };

  const logout = () => {
    clearAuth();
    router.push("/login");
  };

  useEffect(() => {
    const urlToken = searchParams.get("token");

    const tokenToValidate = urlToken ?? localStorage.getItem("biscuit_auth_token");

    if (!tokenToValidate) {
      setIsLoading(false);
      return;
    }

    // Validate token server-side via GET /auth/me (JWT check + DB user existence)
    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenToValidate}` },
    })
      .then(async res => {
        if (!res.ok) {
          // Token invalid or user deleted — clear and redirect
          clearAuth();
          if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/") {
            router.replace("/login");
          }
          return;
        }
        const data = await res.json();
        if (urlToken) {
          localStorage.setItem("biscuit_auth_token", urlToken);
          router.replace("/chat");
        }
        setToken(tokenToValidate);
        setUser(data.user);
      })
      .catch(() => {
        // Network error — still set token from storage so UI doesn't redirect on transient failures
        // The apiClient will catch 401s on actual API calls
        const storedToken = localStorage.getItem("biscuit_auth_token");
        if (storedToken) {
          setToken(storedToken);
          // Parse user from JWT payload as fallback
          try {
            const base64 = storedToken.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
            const decoded = JSON.parse(decodeURIComponent(atob(base64).split("").map(c =>
              "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
            ).join("")));
            if (decoded?.id && decoded?.email) {
              setUser({ id: decoded.id, email: decoded.email });
            }
          } catch { /* ignore */ }
        }
      })
      .finally(() => setIsLoading(false));
  }, [searchParams]);

  return (
    <AuthContext.Provider value={{ token, user, logout, isAuthenticated: !!token, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
