import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, Trophy, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Ao Vivo</Badge>;
  if (status === "finished") return <Badge className="bg-muted text-muted-foreground text-xs">Encerrado</Badge>;
  return <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Em Breve</Badge>;
}

export default function DashboardPage() {
  const { data, isLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  const stats = [
    { label: "Participantes", value: data?.totalParticipants ?? 0, icon: Users, color: "text-blue-400" },
    { label: "Total de Jogos", value: data?.totalMatches ?? 0, icon: Calendar, color: "text-purple-400" },
    { label: "Jogos Ao Vivo", value: data?.liveMatches?.length ?? 0, icon: Zap, color: "text-red-400" },
    { label: "Encerrados", value: data?.finishedMatches ?? 0, icon: Trophy, color: "text-primary" },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão geral do Bolão da Copa</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-card-border rounded-xl p-4" data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Live & Upcoming Matches */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm text-foreground">Próximos Jogos</h2>
              <Link href="/matches" className="text-xs text-primary hover:underline">Ver todos</Link>
            </div>
            <div className="divide-y divide-border">
              {data?.liveMatches?.map((m) => (
                <Link key={m.id} href={`/matches/${m.id}`}>
                  <div className="px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors" data-testid={`match-live-${m.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <img src={m.homeLogo ?? ""} alt={m.homeTeam} className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <span>{m.homeTeam}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span>{m.awayTeam}</span>
                        <img src={m.awayLogo ?? ""} alt={m.awayTeam} className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                    {(m.homeScore !== null && m.awayScore !== null) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{m.homeScore} x {m.awayScore}</p>
                    )}
                  </div>
                </Link>
              ))}
              {data?.upcomingMatches?.slice(0, 4 - (data?.liveMatches?.length ?? 0)).map((m) => (
                <Link key={m.id} href={`/matches/${m.id}`}>
                  <div className="px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors" data-testid={`match-upcoming-${m.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <img src={m.homeLogo ?? ""} alt={m.homeTeam} className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <span>{m.homeTeam}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span>{m.awayTeam}</span>
                        <img src={m.awayLogo ?? ""} alt={m.awayTeam} className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(m.matchDate), "dd MMM, HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </Link>
              ))}
              {(!data?.liveMatches?.length && !data?.upcomingMatches?.length) && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum jogo disponível</div>
              )}
            </div>
          </div>

          {/* Mini Ranking */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm text-foreground">Ranking</h2>
              <Link href="/ranking" className="text-xs text-primary hover:underline">Ver completo</Link>
            </div>
            <div className="divide-y divide-border">
              {data?.topRanking?.map((entry, idx) => (
                <div key={entry.userId} className="px-5 py-3 flex items-center gap-3" data-testid={`ranking-entry-${entry.userId}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0 ? "bg-yellow-500/20 text-yellow-400" :
                    idx === 1 ? "bg-gray-400/20 text-gray-300" :
                    idx === 2 ? "bg-orange-500/20 text-orange-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">{entry.totalPredictions} palpites</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{entry.totalPoints}</p>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </div>
                </div>
              ))}
              {!data?.topRanking?.length && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma pontuação ainda</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
