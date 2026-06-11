import { useEffect, useRef, useState } from "react";
import {
  useGetDashboard,
  getGetDashboardQueryKey,
  useGetLiveRanking,
  getGetLiveRankingQueryKey,
  useGetRanking,
  getGetRankingQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Calendar,
  Trophy,
  Zap,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import type { RankingEntry } from "@workspace/api-client-react";

function StatusBadge({
  status,
  matchDate,
}: {
  status: string;
  matchDate?: string;
}) {
  const gameDate = matchDate ? new Date(matchDate) : null;
  const isToday = gameDate ? isSameDay(gameDate, new Date()) : false;

  if (status === "live") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
        Ao Vivo
      </Badge>
    );
  }

  if (status === "finished") {
    return (
      <Badge className="bg-muted text-muted-foreground text-xs">
        Encerrado
      </Badge>
    );
  }

  if (isToday) {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
        Hoje
      </Badge>
    );
  }

  return (
    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
      Em Breve
    </Badge>
  );
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

function getPoints(entry: any) {
  return entry?.projectedTotal ?? entry?.basePoints ?? entry?.totalPoints ?? 0;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveIndex, setLiveIndex] = useState(0);

  const userName =
    user?.name ||
    (user as any)?.username ||
    (user as any)?.email?.split("@")[0] ||
    "usuário";

  const { data, isLoading } = useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
      refetchInterval: 5_000,
      refetchOnWindowFocus: true,
    },
  });

  const allLiveMatches = data?.liveMatches ?? [];
  const hasLiveMatch = allLiveMatches.length > 0;
  const hasMultipleLiveMatches = allLiveMatches.length > 1;
  const mainLiveMatch = allLiveMatches[liveIndex] ?? allLiveMatches[0] ?? null;

  useEffect(() => {
    if (liveIndex > 0 && liveIndex >= allLiveMatches.length) {
      setLiveIndex(0);
    }
  }, [liveIndex, allLiveMatches.length]);

  const { data: baseRanking } = useGetRanking({
    query: {
      queryKey: getGetRankingQueryKey(),
      enabled: !hasLiveMatch,
    },
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
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        qc.invalidateQueries({ queryKey: getGetLiveRankingQueryKey() });
      }, 10_000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasLiveMatch, qc]);

  const rankingEntries = (
    hasLiveMatch ? liveRanking ?? [] : toLiveShape(baseRanking)
  ).slice(0, 8);

  const rankingLoading = hasLiveMatch ? loadingLive : false;

  const firstPlace = rankingEntries[0];
  const secondPlace = rankingEntries[1];
  const thirdPlace = rankingEntries[2];
  const otherPlaces = rankingEntries.slice(3);

  const stats = [
    {
      label: "Participantes",
      value: data?.totalParticipants ?? 0,
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: "Total de Jogos",
      value: data?.totalMatches ?? 0,
      icon: Calendar,
      color: "text-purple-400",
    },
    {
      label: "Jogos Ao Vivo",
      value: allLiveMatches.length,
      icon: Zap,
      color: "text-red-400",
    },
    {
      label: "Encerrados",
      value: data?.finishedMatches ?? 0,
      icon: Trophy,
      color: "text-primary",
    },
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
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
          <p className="text-sm text-muted-foreground">
            Olá,{" "}
            <span className="font-semibold text-foreground">{userName}</span> 👋
          </p>

          <h1 className="text-2xl font-bold text-foreground mt-1">
            Dashboard
          </h1>

          <p className="text-muted-foreground text-sm mt-0.5">
            Visão geral do Bolão da Copa
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-card border border-card-border rounded-xl p-4"
              data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {label}
                </p>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>

              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-sm text-foreground text-center w-full">
                  Ao Vivo
                </h2>
              </div>

              {mainLiveMatch ? (
                <div
                  className="relative overflow-hidden p-6"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 20%, rgba(201,162,39,0.30) 0%, rgba(201,162,39,0.08) 34%, transparent 58%), linear-gradient(135deg, rgba(12,14,20,1) 0%, rgba(8,9,13,1) 55%, rgba(0,0,0,1) 100%)",
                  }}
                >
                  <div className="absolute inset-x-8 top-10 h-24 rounded-full bg-primary/20 blur-3xl" />
                  <div className="absolute -left-20 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
                  <div className="absolute -right-20 bottom-0 h-48 w-48 rounded-full bg-red-500/10 blur-3xl" />

                  <div className="relative z-10">
                    <div className="mb-6 flex items-center justify-between">
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-xs animate-pulse">
                        ● AO VIVO
                      </Badge>

                      <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-white/80 border border-white/10">
                        {mainLiveMatch.matchDate
                          ? format(new Date(mainLiveMatch.matchDate), "HH:mm", {
                              locale: ptBR,
                            })
                          : "Agora"}
                      </span>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5">
                      <div className="flex min-w-0 flex-col items-center gap-3">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/30 shadow-2xl backdrop-blur-sm">
                          <img
                            src={mainLiveMatch.homeLogo ?? ""}
                            alt={mainLiveMatch.homeTeam}
                            className="h-14 w-14 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>

                        <span className="line-clamp-2 text-center text-sm font-black uppercase text-white">
                          {mainLiveMatch.homeTeam}
                        </span>
                      </div>

                      <div className="flex flex-col items-center">
                        {mainLiveMatch.homeScore != null &&
                        mainLiveMatch.awayScore != null ? (
                          <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-black/35 px-5 py-3 backdrop-blur-sm">
                            <span className="text-4xl font-black text-primary tabular-nums">
                              {mainLiveMatch.homeScore}
                            </span>

                            <span className="text-xl font-bold text-white/50">
                              ×
                            </span>

                            <span className="text-4xl font-black text-primary tabular-nums">
                              {mainLiveMatch.awayScore}
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-primary/30 bg-black/35 px-6 py-3 backdrop-blur-sm">
                            <span className="text-3xl font-black text-white">
                              VS
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-col items-center gap-3">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/30 shadow-2xl backdrop-blur-sm">
                          <img
                            src={mainLiveMatch.awayLogo ?? ""}
                            alt={mainLiveMatch.awayTeam}
                            className="h-14 w-14 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>

                        <span className="line-clamp-2 text-center text-sm font-black uppercase text-white">
                          {mainLiveMatch.awayTeam}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-center">
                      <Link href="/ao-vivo">
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 py-2 text-xs font-bold text-primary shadow-[0_0_24px_rgba(201,162,39,0.18)] transition hover:bg-primary/15 cursor-pointer">
                          Ver detalhes do jogo
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                      </Link>
                    </div>

                    {hasMultipleLiveMatches && (
                      <div className="mt-5 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setLiveIndex((prev) =>
                              prev === 0 ? allLiveMatches.length - 1 : prev - 1
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 transition hover:bg-white/10 hover:text-white"
                          aria-label="Jogo ao vivo anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <span className="text-xs font-semibold text-white/60">
                          {liveIndex + 1} de {allLiveMatches.length} jogos ao
                          vivo
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setLiveIndex((prev) =>
                              prev === allLiveMatches.length - 1 ? 0 : prev + 1
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 transition hover:bg-white/10 hover:text-white"
                          aria-label="Próximo jogo ao vivo"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="relative overflow-hidden p-8 text-center"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 20%, rgba(201,162,39,0.22) 0%, rgba(201,162,39,0.06) 34%, transparent 58%), linear-gradient(135deg, rgba(12,14,20,1) 0%, rgba(8,9,13,1) 55%, rgba(0,0,0,1) 100%)",
                  }}
                >
                  <div className="absolute inset-x-8 top-8 h-20 rounded-full bg-primary/15 blur-3xl" />

                  <div className="relative z-10">
                    <p className="text-sm font-semibold text-white">
                      Nenhum jogo ao vivo agora
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      Acompanhe os próximos jogos abaixo
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm text-foreground">
                  Próximos Jogos
                </h2>

                <Link
                  href="/matches"
                  className="text-xs text-primary hover:underline"
                >
                  Ver todos
                </Link>
              </div>

              <div className="divide-y divide-border">
                {data?.upcomingMatches?.slice(0, 4).map((match) => (
                  <Link key={match.id} href={`/matches/${match.id}`}>
                    <div
                      className="px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      data-testid={`match-upcoming-${match.id}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm font-medium min-w-0">
                          <img
                            src={match.homeLogo ?? ""}
                            alt={match.homeTeam}
                            className="w-5 h-5 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />

                          <span className="truncate">{match.homeTeam}</span>
                          <span className="text-muted-foreground">vs</span>
                          <span className="truncate">{match.awayTeam}</span>

                          <img
                            src={match.awayLogo ?? ""}
                            alt={match.awayTeam}
                            className="w-5 h-5 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>

                        <StatusBadge
                          status={match.status}
                          matchDate={match.matchDate}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(match.matchDate), "dd MMM, HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </Link>
                ))}

                {!data?.upcomingMatches?.length && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Nenhum próximo jogo disponível
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className={`hidden md:block bg-card border rounded-xl overflow-hidden ${
              hasLiveMatch ? "border-primary/20" : "border-card-border"
            }`}
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Tabela do Bolão
              </h3>

              <Link
                href="/tabela"
                className="text-xs text-primary hover:underline"
              >
                Ver completo
              </Link>
            </div>

            {rankingLoading ? (
              <div className="space-y-px">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-none" />
                ))}
              </div>
            ) : rankingEntries.length > 0 ? (
              <>
                <div className="px-5 pt-6 pb-5 border-b border-border">
                  <div className="grid grid-cols-3 items-end gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-full h-20 rounded-t-xl border border-slate-500/30 bg-slate-500/15 flex flex-col items-center justify-center">
                        <span className="text-2xl">🥈</span>
                        <span className="text-xs font-bold text-slate-300 mt-1">
                          2º
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-foreground text-center truncate w-full">
                        {secondPlace?.name ?? "-"}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {getPoints(secondPlace)} pts
                      </p>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-full h-28 rounded-t-xl border border-yellow-500/40 bg-yellow-500/20 flex flex-col items-center justify-center shadow-[0_0_28px_rgba(234,179,8,0.15)]">
                        <span className="text-3xl">🏆</span>
                        <span className="text-xs font-bold text-yellow-400 mt-1">
                          1º
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-bold text-yellow-400 text-center truncate w-full">
                        {firstPlace?.name ?? "-"}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {getPoints(firstPlace)} pts
                      </p>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-full h-16 rounded-t-xl border border-orange-500/30 bg-orange-500/15 flex flex-col items-center justify-center">
                        <span className="text-2xl">🥉</span>
                        <span className="text-xs font-bold text-orange-400 mt-1">
                          3º
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-foreground text-center truncate w-full">
                        {thirdPlace?.name ?? "-"}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {getPoints(thirdPlace)} pts
                      </p>
                    </div>
                  </div>
                </div>

                {otherPlaces.length > 0 && (
                  <div className="divide-y divide-border">
                    {otherPlaces.map((entry, index) => (
                      <div
                        key={entry.userId}
                        className="px-5 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {index + 4}º
                          </div>

                          <p className="text-sm font-semibold text-foreground">
                            {entry.name}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">
                            {getPoints(entry)}
                          </p>

                          <p className="text-xs text-muted-foreground">pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma pontuação ainda
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}