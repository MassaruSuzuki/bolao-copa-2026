import { useEffect, useRef } from "react";
import {
  useGetDashboard,
  getGetDashboardQueryKey,
  useGetLiveRanking,
  getGetLiveRankingQueryKey,
  useGetRanking,
  getGetRankingQueryKey,
  useListMatches,
  getListMatchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { AnimatedRankingList } from "@/components/AnimatedRankingList";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, Trophy, Zap, Radio } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import type { RankingEntry } from "@workspace/api-client-react";

function StatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Ao Vivo</Badge>;
  if (status === "finished") return <Badge className="bg-muted text-muted-foreground text-xs">Encerrado</Badge>;
  return <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Em Breve</Badge>;
}

function toLiveShape(entries: RankingEntry[] | undefined) {
  return (entries ?? []).map((e) => ({
    userId: e.userId,
    name: e.name,
    avatarUrl: (e as any).avatarUrl ?? null,
    basePoints: e.totalPoints,
    liveBonus: 0,
    projectedTotal: e.totalPoints,
    liveMatchId: null,
    predHome: null,
    predAway: null,
    currentHome: null,
    currentAway: null,
    proximity: null,
    hasPrediction: e.totalPredictions > 0,
  }));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() },
  });

  const { data: liveMatches } = useListMatches(
    { status: "live" },
    { query: { queryKey: getListMatchesQueryKey({ status: "live" }), refetchInterval: 10_000 } }
  );
  const hasLiveMatch = (liveMatches?.length ?? 0) > 0;

  const { data: baseRanking } = useGetRanking({
    query: { queryKey: getGetRankingQueryKey(), enabled: !hasLiveMatch },
  });

  const { data: liveRanking, isLoading: loadingLive } = useGetLiveRanking({
    query: {
      queryKey: getGetLiveRankingQueryKey(),
      enabled: hasLiveMatch,
      refetchInterval: 10_000,
    },
  });

  useEffect(() => {
    if (hasLiveMatch) {
      pollRef.current = setInterval(() => {
        qc.invalidateQueries({ queryKey: getGetLiveRankingQueryKey() });
      }, 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasLiveMatch, qc]);

  const rankingEntries = (hasLiveMatch ? (liveRanking ?? []) : toLiveShape(baseRanking)).slice(0, 5);
  const rankingLoading = hasLiveMatch ? loadingLive : false;

  const stats = [
    { label: "Participantes", value: data?.totalParticipants ?? 0, icon: Users, color: "text-blue-400" },
    { label: "Total de Jogos", value: data?.totalMatches ?? 0, icon: Calendar, color: "text-purple-400" },
    { label: "Jogos Ao Vivo", value: data?.liveMatches?.length ?? 0, icon: Zap, color: "text-red-400" },
    { label: "Encerrados", value: data?.finishedMatches ?? 0, icon: Trophy, color: "text-primary" },
  ];

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

          {/* Placar do Bolão */}
          <div className={`bg-card border rounded-xl overflow-hidden ${hasLiveMatch ? "border-primary/20" : "border-card-border"}`}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-foreground">Placar do Bolão</h2>
                {hasLiveMatch && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10">
                    <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
                    <span className="text-xs font-semibold text-red-400">AO VIVO</span>
                  </div>
                )}
              </div>
              <Link href="/ranking" className="text-xs text-primary hover:underline">Ver completo</Link>
            </div>

            {/* Live score mini-banners — one per live match, scrollable if many */}
            {hasLiveMatch && (liveMatches?.filter((m) => m.homeScore != null && m.awayScore != null) ?? []).length > 0 && (
              <div className="border-b border-border/50 overflow-y-auto" style={{ maxHeight: "9rem" }}>
                {liveMatches!.filter((m) => m.homeScore != null && m.awayScore != null).map((m) => (
                  <div key={m.id} className="px-4 py-2.5 flex items-center gap-2 border-b last:border-0 border-border/30"
                    style={{ background: "linear-gradient(135deg, rgba(201,162,39,0.07) 0%, rgba(201,162,39,0.02) 100%)" }}>
                    <Zap className="w-3.5 h-3.5 text-primary animate-pulse flex-shrink-0" />
                    <p className="text-xs font-semibold text-foreground">
                      {m.homeTeam}{" "}
                      <span className="text-primary tabular-nums font-black">
                        {m.homeScore} x {m.awayScore}
                      </span>{" "}
                      {m.awayTeam}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {rankingLoading ? (
              <div className="space-y-px">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-none" />)}
              </div>
            ) : rankingEntries.length > 0 ? (
              <AnimatedRankingList
                entries={rankingEntries}
                currentUserId={user?.id}
                isLive={hasLiveMatch}
                compact
              />
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma pontuação ainda</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
