import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  Target,
  Trophy,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/matches", label: "Jogos", icon: Calendar },
  { href: "/predictions", label: "Meus Palpites", icon: Target },
  { href: "/ranking", label: "Ranking", icon: Trophy },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const allNavItems = user?.isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: Shield }]
    : navItems;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 fixed top-0 left-0 h-full z-30 border-r"
        style={{
          background: "hsl(220,20%,5%)",
          borderColor: "rgba(201,162,39,0.12)",
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{ borderColor: "rgba(201,162,39,0.10)" }}
        >
          <div className="relative flex-shrink-0">
            <div
              className="absolute inset-0 blur-md opacity-50 rounded-full"
              style={{ background: "rgba(201,162,39,0.4)" }}
            />
            <img
              src="/logo-copa.png"
              alt="Copa"
              className="relative w-10 h-auto"
              style={{ filter: "drop-shadow(0 0 8px rgba(201,162,39,0.6))" }}
            />
          </div>
          <div>
            <p className="font-black text-sm text-white tracking-tight">Bolão da Copa</p>
            <p className="text-xs font-medium" style={{ color: "rgba(201,162,39,0.7)" }}>FIFA World Cup 2026</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" data-testid="nav-sidebar">
          {allNavItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <div
                  data-testid={`nav-item-${href.slice(1)}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer",
                    active
                      ? "text-[#1a1200]"
                      : "text-white/60 hover:text-white/90"
                  )}
                  style={active ? {
                    background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                    boxShadow: "0 2px 12px rgba(201,162,39,0.3)",
                  } : {}}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div
          className="px-3 py-4 border-t"
          style={{ borderColor: "rgba(201,162,39,0.10)" }}
        >
          <div className="flex items-center gap-3 px-3 py-2 mb-1 rounded-xl hover:bg-white/5 transition-colors">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black"
              style={{
                background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                color: "#1a1200",
              }}
            >
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/40 hover:text-white/70 gap-2 mt-1"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 border-b"
        style={{
          background: "rgba(8,9,13,0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(201,162,39,0.12)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo-copa.png" alt="Copa" className="w-7 h-auto" style={{ filter: "drop-shadow(0 0 6px rgba(201,162,39,0.5))" }} />
            <span className="font-black text-sm text-white">Bolão da Copa</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
        {mobileOpen && (
          <div className="px-3 pb-3 space-y-0.5 border-t" style={{ borderColor: "rgba(201,162,39,0.10)" }}>
            {allNavItems.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link key={href} href={href}>
                  <div
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all"
                    style={active ? {
                      background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                      color: "#1a1200",
                    } : { color: "rgba(255,255,255,0.7)" }}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </div>
                </Link>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-white/40"
              onClick={logout}
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 min-h-screen">
        <div className="mt-14 md:mt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
