import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { setAuthTokenGetter, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface User {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "bolao_token";

function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setAuthTokenGetter(() => null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
  }, []);

  // Intercept all fetch calls — if any API response is 401, auto-logout
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && localStorage.getItem(TOKEN_KEY)) {
        logout();
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  const { data: meData, isLoading, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
      refetchInterval: 30_000,
    },
  });

  useEffect(() => {
    if (meData) {
      setUser(meData as User);
    }
  }, [meData]);

  // If /me returns an error while we have a token, the account was rejected/deleted — logout
  useEffect(() => {
    if (isError && token) {
      logout();
    }
  }, [isError, token, logout]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
  };

  const refreshUser = () => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading: !!token && isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { AuthProvider, useAuth };
export type { User };
