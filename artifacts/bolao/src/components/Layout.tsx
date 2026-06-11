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
  Radio,
  TableProperties,
  BookOpen,

} from "lucide-react";
import { cn } from "@/lib/utils";

function UserAvatar({ name, avatarUrl, size = 8, textSize = "xs" }: { name?: string; avatarUrl?: string | null; size?: number; textSize?: string }) {
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  const sizeClass = `w-${size} h-${size}`;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 text-${textSize} font-black`}
      style={{ background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)", color: "#1a1200" }}
    >
      {initials}
    </div>
  );
}

export { UserAvatar };

const navItems = [
  { href: "/ao-vivo", label: "Ao Vivo", icon: Radio },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
 
  { href: "/matches", label: "Jogos", icon: Calendar },
  { href: "/predictions", label: "Meus Palpites", icon: Target },
  { href: "/tabela", label: "Tabela do Bolão", icon: TableProperties },
  { href: "/rules", label: "Regras", icon: BookOpen },
];

// Mobile tabs shown in bottom bar
const mainMobileItems = [
  { href: "/ao-vivo", label: "Ao Vivo", icon: Radio },
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/matches", label: "Jogos", icon: Calendar },
 
  { href: "/predictions", label: "Palpites", icon: Target },
  { href: "/tabela", label: "Tabela", icon: TableProperties },
  { href: "/rules", label: "Regras", icon: BookOpen },
];


interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  

  const sidebarItems = user?.isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: Shield }]
    : navItems;



  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-64 fixed top-0 left-0 h-full z-30 border-r"
        style={{
          background: "hsl(220,20%,5%)",
          borderColor: "rgba(201,162,39,0.12)",
        }}
      >
        <Link href="/dashboard">
          <div
            className="flex items-center gap-3 px-5 py-4 border-b cursor-pointer hover:bg-white/5 transition-colors"
            style={{ borderColor: "rgba(201,162,39,0.10)" }}
          >
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 blur-md opacity-50 rounded-full" style={{ background: "rgba(201,162,39,0.4)" }} />
              <img src="/logo-copa.png" alt="Copa" className="relative w-10 h-auto" style={{ filter: "drop-shadow(0 0 8px rgba(201,162,39,0.6))" }} />
            </div>
            <div>
              <p className="font-black text-sm text-white tracking-tight">Bolão da Copa</p>
              <p className="text-xs font-medium" style={{ color: "rgba(201,162,39,0.7)" }}>FIFA World Cup 2026</p>
            </div>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-0.5" data-testid="nav-sidebar">
          {sidebarItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            const isLive = href === "/ao-vivo";
            return (
              <Link key={href} href={href}>
                <div
                  data-testid={`nav-item-${href.slice(1)}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer",
                    active ? "text-[#1a1200]" : "text-white/60 hover:text-white/90"
                  )}
                  style={active ? {
                    background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                    boxShadow: "0 2px 12px rgba(201,162,39,0.3)",
                  } : {}}
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", isLive && !active && "text-red-400")} />
                  <span className="flex-1">{label}</span>
                  {isLive && !active && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: "rgba(201,162,39,0.10)" }}>
          <Link href="/profile">
            <div className="flex items-center gap-3 px-3 py-2 mb-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
              <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} size={8} textSize="xs" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-white/40 truncate">Editar perfil</p>
              </div>
            </div>
          </Link>
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

      {/* ── Mobile Top Header ── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 border-b"
        style={{
          background: "rgba(8,9,13,0.97)",
          backdropFilter: "blur(16px)",
          borderColor: "rgba(201,162,39,0.12)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard">
            <div className="flex items-center gap-2">
              <img
                src="/logo-copa.png"
                alt="Copa"
                className="w-7 h-auto"
                style={{ filter: "drop-shadow(0 0 6px rgba(201,162,39,0.5))" }}
              />
              <span className="font-black text-sm text-white">Bolão da Copa</span>
            </div>
          </Link>
          <Link href="/profile">
            <div className="cursor-pointer">
              <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} size={8} textSize="xs" />
            </div>
          </Link>
        </div>
      </div>

    
{/* ── Mobile Bottom Tab Bar ── */}
<nav
  className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t overflow-x-auto"
  style={{
    background: "rgba(8,9,13,0.97)",
    backdropFilter: "blur(16px)",
    borderColor: "rgba(201,162,39,0.12)",
    paddingBottom: "env(safe-area-inset-bottom)",
  }}
  data-testid="nav-bottom"
>
  <div className="flex min-w-max">
    {mainMobileItems.map(({ href, label, icon: Icon }) => {
      const active = location === href || location.startsWith(href + "/");

      return (
        <Link key={href} href={href} className="min-w-[78px]">
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 px-3 relative transition-colors",
              active ? "text-primary" : "text-white/40 hover:text-white/70"
            )}
            data-testid={`nav-item-mobile-${href.slice(1)}`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {active && (
                <span
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: "hsl(43,74%,52%)" }}
                />
              )}
            </div>
            <span className={cn("text-[10px] font-medium leading-tight whitespace-nowrap", active && "font-semibold")}>
              {label}
            </span>
          </div>
        </Link>
      );
    })}
  </div>
</nav>

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-64 min-h-screen">
        <div className="mt-14 md:mt-0 pb-20 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
