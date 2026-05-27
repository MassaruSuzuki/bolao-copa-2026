import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useEffect } from "react";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import MatchesPage from "@/pages/matches";
import MatchDetailPage from "@/pages/match-detail";
import PredictionsPage from "@/pages/predictions";
import RankingPage from "@/pages/ranking";
import AoVivoPage from "@/pages/ao-vivo";
import TabelaPage from "@/pages/tabela";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, token } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token && !user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { token } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("bolao_token"));
  }, [token]);

  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/dashboard" component={() => <ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/matches" component={() => <ProtectedRoute><MatchesPage /></ProtectedRoute>} />
      <Route path="/matches/:id" component={() => <ProtectedRoute><MatchDetailPage /></ProtectedRoute>} />
      <Route path="/predictions" component={() => <ProtectedRoute><PredictionsPage /></ProtectedRoute>} />
      <Route path="/ranking" component={() => <ProtectedRoute><RankingPage /></ProtectedRoute>} />
      <Route path="/ao-vivo" component={() => <ProtectedRoute><AoVivoPage /></ProtectedRoute>} />
      <Route path="/tabela" component={() => <ProtectedRoute><TabelaPage /></ProtectedRoute>} />
      <Route path="/admin" component={() => <ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
