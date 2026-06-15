import { useEffect, useMemo, useRef, useState } from "react";
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
  Clock,
} from "lucide-react";
import { isSameDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import type { RankingEntry } from "@workspace/api-client-react";

const BR_TIMEZONE = "America/Sao_Paulo";

function parseBrasiliaDate(matchDate?: string) {
  if (!matchDate) return null;

  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(matchDate);
  if (hasTimezone) return new Date(matchDate);

  return new Date(`${matchDate}-03:00`);
}

function formatBrasiliaDate(
  matchDate?: string,
  options?: Intl.DateTimeFormatOptions
) {
  const date = parseBrasiliaDate(matchDate);
  if (!date) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BR_TIMEZONE,
    ...options,
  }).format(date);
}

function formatBrasiliaShortDate(matchDate?: string) {
  return formatBrasiliaDate(matchDate, {
    day: "2-digit",
    month: "short",
  })
    .toUpperCase()
    .replace(".", "");
}

function formatCountdown(matchDate?: string) {
  const targetDate = parseBrasiliaDate(matchDate);
  if (!targetDate) return "00h 00m 00s";

  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return "Começando agora";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;

  return `${hours}h ${minutes}m ${seconds}s`;
}

function StatusBadge({
  status,
  matchDate,
}: {
  status: string;
  matchDate?: string;
}) {
  const gameDate = parseBrasiliaDate(matchDate);
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
  const [showRemainingGames, setShowRemainingGames] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

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

  const nextMatch = useMemo(() => {
    const now = Date.now();

    return [...(data?.upcomingMatches ?? [])]
      .filter((match) => {
        const matchTime = parseBrasiliaDate(match.matchDate)?.getTime();

        return (
          match.status === "upcoming" &&
          typeof matchTime === "number" &&
          matchTime > now
        );
      })
      .sort((a, b) => {
        const timeA = parseBrasiliaDate(a.matchDate)?.getTime() ?? 0;
        const timeB = parseBrasiliaDate(b.matchDate)?.getTime() ?? 0;

        return timeA - timeB;
      })[0];
  }, [data?.upcomingMatches, nowTick]);

  const featuredMatch = mainLiveMatch ?? nextMatch ?? null;
  const isFeaturedLive = featuredMatch?.status === "live";

  const totalMatches = data?.totalMatches ?? 0;
  const finishedMatches = data?.finishedMatches ?? 0;
  const remainingMatches = Math.max(totalMatches - finishedMatches, 0);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowRemainingGames((prev) => !prev);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

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
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (hasLiveMatch) {
      pollRef.current = setInterval(() => {
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        qc.invalidateQueries({ queryKey: getGetLiveRankingQueryKey() });
      }, 10_000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasLiveMatch, qc]);

  const rankingEntries = (
    hasLiveMatch ? liveRanking ?? [] : toLiveShape(baseRanking)
  ).slice(0, 8);

  const rankingLoading = hasLiveMatch ? loadingLive : false;

  const leaderPoints =
    rankingEntries.length > 0 ? getPoints(rankingEntries[0]) : 0;

  const leaders = rankingEntries.filter(
    (entry) => getPoints(entry) === leaderPoints
  );

  const otherPlaces = rankingEntries.filter(
    (entry) => getPoints(entry) !== leaderPoints
  );

  const stats = [
    {
      label: "Participantes",
      value: data?.totalParticipants ?? 0,
      icon: Users,
      color: "text-blue-400",
      animated: false,
    },
    {
      label: showRemainingGames ? "Jogos Restantes" : "Total de Jogos",
      value: showRemainingGames ? remainingMatches : totalMatches,
      icon: Calendar,
      color: "text-purple-400",
      animated: true,
    },
    {
      label: "Jogos Ao Vivo",
      value: allLiveMatches.length,
      icon: Zap,
      color: "text-red-400",
      animated: false,
    },
    {
      label: "Encerrados",
      value: finishedMatches,
      icon: Trophy,
      color: "text-primary",
      animated: false,
    },
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 md:p-6 space-y-6">
          <Skeleton className="h-8 w-48" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 md:h-24 rounded-xl" />
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
      <style>
        {`
          @keyframes dashboardFlipStat {
            0% {
              transform: rotateX(90deg) translateY(12px);
              opacity: 0;
            }

            45% {
              transform: rotateX(-10deg) translateY(0);
              opacity: 1;
            }

            100% {
              transform: rotateX(0deg) translateY(0);
              opacity: 1;
            }
          }

          .dashboard-flip-stat {
            animation: dashboardFlipStat 520ms ease-out;
            transform-origin: center;
          }
        `}
      </style>

      <div className="p-3 pb-24 md:p-6 md:pb-6 space-y-5 md:space-y-6">
        <div className="hidden md:block">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {stats.map(({ label, value, icon: Icon, color, animated }) => (
            <div
              key={label}
              className="bg-card border border-card-border rounded-xl p-3 md:p-4 overflow-hidden"
              data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}
            >
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <p
                  key={`label-${label}`}
                  className={`text-[10px] md:text-xs text-muted-foreground font-medium ${
                    animated ? "dashboard-flip-stat" : ""
                  }`}
                >
                  {label}
                </p>

                <Icon className={`w-4 h-4 ${color}`} />
              </div>

              <div className="h-7 md:h-8" style={{ perspective: "700px" }}>
                <p
                  key={`value-${label}-${value}`}
                  className={`text-lg md:text-2xl font-bold text-foreground tabular-nums ${
                    animated ? "dashboard-flip-stat" : ""
                  }`}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 md:px-5 py-3.5 md:py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-base md:text-sm text-foreground">
                  {isFeaturedLive ? "Ao Vivo" : "Próximo Jogo"}
                </h2>

                {featuredMatch && (
                  <>
                    {isFeaturedLive ? (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-xs animate-pulse">
                        ● AO VIVO
                      </Badge>
                    ) : (
                      <Badge className="bg-primary/20 text-primary border-primary/40 text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        PRÓXIMO JOGO
                      </Badge>
                    )}
                  </>
                )}
              </div>

              {featuredMatch ? (
                <div
  className="relative overflow-hidden px-4 py-5 md:px-6 md:py-8"
  style={{
    backgroundImage: `
      linear-gradient(
        rgba(0,0,0,0.70),
        rgba(0,0,0,0.70)
      ),
      url('/images/stadium-bg.jpg')
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }}
>
                  <div className="absolute inset-x-8 top-8 h-20 rounded-full bg-primary/15 blur-3xl" />
                  <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
                  <div className="absolute -right-20 bottom-0 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />

                  <div className="relative z-10">
                    {!isFeaturedLive && (
                      <div className="mb-4 md:mb-7 text-center">
                        <p className="text-[9px] md:text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                          Começa em
                        </p>

                        <p
                          key={nowTick}
                          className="mt-1 text-xl md:text-4xl font-black text-primary tabular-nums"
                        >
                          {formatCountdown(featuredMatch.matchDate)}
                        </p>
                      </div>
                    )}

                    <div className="md:hidden">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="flex min-w-0 flex-col items-center gap-2">
                          <div className="flex h-14 w-20 items-center justify-center rounded-xl bg-black/25 shadow-xl backdrop-blur-sm">
                            <img
                              src={featuredMatch.homeLogo ?? ""}
                              alt={featuredMatch.homeTeam}
                              className="h-12 w-16 rounded-lg object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>

                          <span className="line-clamp-2 text-center text-[11px] font-black uppercase text-white">
                            {featuredMatch.homeTeam}
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          {!isFeaturedLive && (
                            <>
                              <span className="text-[10px] font-bold tracking-[0.16em] text-white/55 uppercase">
                                {formatBrasiliaShortDate(
                                  featuredMatch.matchDate
                                )}
                              </span>

                              <span className="mt-0.5 mb-2 text-2xl font-black text-white">
                                {formatBrasiliaDate(featuredMatch.matchDate, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </>
                          )}

                          {isFeaturedLive &&
                          featuredMatch.homeScore != null &&
                          featuredMatch.awayScore != null ? (
                            <div className="flex items-center gap-2 rounded-xl bg-black/35 px-3 py-2 backdrop-blur-sm">
                              <span className="text-2xl font-black text-primary tabular-nums">
                                {featuredMatch.homeScore}
                              </span>

                              <span className="text-sm font-bold text-white/50">
                                ×
                              </span>

                              <span className="text-2xl font-black text-primary tabular-nums">
                                {featuredMatch.awayScore}
                              </span>
                            </div>
                          ) : (
                            <div className="rounded-xl bg-black/45 px-4 py-2 shadow-xl">
                              <span className="text-lg font-black text-white">
                                VS
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex min-w-0 flex-col items-center gap-2">
                          <div className="flex h-14 w-20 items-center justify-center rounded-xl bg-black/25 shadow-xl backdrop-blur-sm">
                            <img
                              src={featuredMatch.awayLogo ?? ""}
                              alt={featuredMatch.awayTeam}
                              className="h-12 w-16 rounded-lg object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          </div>

                          <span className="line-clamp-2 text-center text-[11px] font-black uppercase text-white">
                            {featuredMatch.awayTeam}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-10">
                      <div className="flex min-w-0 flex-col items-center gap-4">
                        <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-black/25 shadow-2xl backdrop-blur-sm">
                          <img
                            src={featuredMatch.homeLogo ?? ""}
                            alt={featuredMatch.homeTeam}
                            className="h-28 w-28 rounded-xl object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>

                        <span className="line-clamp-2 text-center text-lg font-black uppercase text-white">
                          {featuredMatch.homeTeam}
                        </span>
                      </div>

                      <div className="flex flex-col items-center">
                        {!isFeaturedLive && (
                          <>
                            <span className="text-sm font-bold tracking-[0.18em] text-white/55 uppercase">
                              {formatBrasiliaShortDate(
                                featuredMatch.matchDate
                              )}
                            </span>

                            <span className="mt-1 mb-4 text-4xl font-black text-white">
                              {formatBrasiliaDate(featuredMatch.matchDate, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </>
                        )}

                        {isFeaturedLive &&
                        featuredMatch.homeScore != null &&
                        featuredMatch.awayScore != null ? (
                          <div className="flex items-center gap-3 rounded-2xl bg-black/35 px-5 py-3 backdrop-blur-sm">
                            <span className="text-4xl font-black text-primary tabular-nums">
                              {featuredMatch.homeScore}
                            </span>

                            <span className="text-xl font-bold text-white/50">
                              ×
                            </span>

                            <span className="text-4xl font-black text-primary tabular-nums">
                              {featuredMatch.awayScore}
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-black/45 px-7 py-3 shadow-xl">
                            <span className="text-3xl font-black text-white">
                              VS
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-col items-center gap-4">
                        <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-black/25 shadow-2xl backdrop-blur-sm">
                          <img
                            src={featuredMatch.awayLogo ?? ""}
                            alt={featuredMatch.awayTeam}
                            className="h-28 w-28 rounded-xl object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>

                        <span className="line-clamp-2 text-center text-lg font-black uppercase text-white">
                          {featuredMatch.awayTeam}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 md:mt-8 flex justify-center">
                      <Link href="/ao-vivo">
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-black/30 px-5 md:px-6 py-2 md:py-2.5 text-xs font-bold text-primary shadow-[0_0_24px_rgba(201,162,39,0.18)] transition hover:bg-primary/10 cursor-pointer">
                          {isFeaturedLive
                            ? "Ver detalhes do jogo"
                            : "Ir para o jogo"}
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
                  <div className="relative z-10">
                    <p className="text-sm font-semibold text-white">
                      Nenhum jogo encontrado
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      Cadastre novos jogos no painel admin
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 md:px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm md:text-base text-foreground">
                  Próximos Jogos
                </h2>

                <Link
                  href="/matches"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Ver todos
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-border">
                {data?.upcomingMatches?.slice(0, 4).map((match) => (
                  <Link key={match.id} href={`/matches/${match.id}`}>
                    <div
                      className="px-4 md:px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      data-testid={`match-upcoming-${match.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs md:text-sm font-medium min-w-0">
                          <img
                            src={match.homeLogo ?? ""}
                            alt={match.homeTeam}
                            className="w-5 h-5 md:w-6 md:h-6 object-contain"
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
                            className="w-5 h-5 md:w-6 md:h-6 object-contain"
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

                      <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">
                        {formatBrasiliaDate(match.matchDate, {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
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
                  <div className="text-center mb-4">
                    <h4 className="text-sm font-bold text-yellow-400">
                      {leaders.length > 1
                        ? "Líderes do Bolão"
                        : "Líder do Bolão"}
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {leaders.map((entry) => (
                      <div
                        key={entry.userId}
                        className="flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/20 text-xl">
                            👑
                          </div>

                          <p className="truncate text-sm font-bold text-yellow-400">
                            {entry.name}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-black text-primary">
                            {getPoints(entry)}
                          </p>

                          <p className="text-xs text-muted-foreground">pts</p>
                        </div>
                      </div>
                    ))}
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
                            {leaders.length + index + 1}º
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