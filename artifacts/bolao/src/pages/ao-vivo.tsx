import { useEffect, useRef } from "react";
import {
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
import { Skeleton } from "@/components/ui/skeleton";
import { Radio, Zap, Clock, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RankingEntry } from "@workspace/api-client-react";

function toLiveShape(entries: RankingEntry[] | undefined) {
  return (entries ?? []).map((e) => ({
    userId: e.userId,
    name: e.name,
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

export default function AoVivoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: liveMatches, isLoading: loadingMatches } = useListMatches(
    { status: "live" },
    { query: { queryKey: getListMatchesQueryKey({ status: "live" }), refetchInterval: 10_000 } }
  );
  const { data: upcomingMatches } = useListMatches(
    { status: "upcoming" },
    { query: { queryKey: getListMatchesQueryKey({ status: "upcoming" }) } }
  );

  const hasLiveMatch = (liveMatches?.length ?? 0) > 0;
  const liveMatch = liveMatches?.[0];

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
        qc.invalidateQueries({ queryKey: getListMatchesQueryKey({ status: "live" }) });
      }, 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasLiveMatch, qc]);

  const entries = hasLiveMatch ? (liveRanking ?? []) : toLiveShape(baseRanking);
  const isLoading = loadingMatches || (hasLiveMatch ? loadingLive : false);

  const liveScoreInfo = liveMatch && liveMatch.homeScore != null && liveMatch.awayScore != null
    ? {
        home: liveMatch.homeScore as number,
        away: liveMatch.awayScore as number,
        homeTeam: liveMatch.homeTeam,
        awayTeam: liveMatch.awayTeam,
      }
    : undefined;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Radio className={cn("w-6 h-6", hasLiveMatch ? "text-red-400 animate-pulse" : "text-muted-foreground")} />
              Ao Vivo
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {hasLiveMatch
                ? "Jogo em andamento — ranking atualizado automaticamente"
                : "Nenhum jogo em andamento no momento"}
            </p>
          </div>
          {hasLiveMatch && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-400">AO VIVO</span>
            </div>
          )}
        </div>

        {/* Live match score card */}
        {hasLiveMatch && liveScoreInfo && (
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(201,162,39,0.10) 0%, rgba(201,162,39,0.04) 100%)",
              border: "1px solid rgba(201,162,39,0.25)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {liveMatch?.homeLogo && (
                  <img src={liveMatch.homeLogo} alt={liveScoreInfo.homeTeam} className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Placar atual</p>
                  <p className="text-lg font-bold text-foreground">
                    {liveScoreInfo.homeTeam}
                  </p>
                </div>
              </div>

              <div className="text-center px-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-primary tabular-nums">{liveScoreInfo.home}</span>
                  <span className="text-2xl font-bold text-muted-foreground">×</span>
                  <span className="text-4xl font-black text-primary tabular-nums">{liveScoreInfo.away}</span>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Zap className="w-3 h-3 text-red-400 animate-pulse" />
                  <span className="text-xs font-semibold text-red-400">Em andamento</span>
                </div>
              </div>

              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1 text-right">Placar atual</p>
                  <p className="text-lg font-bold text-foreground">
                    {liveScoreInfo.awayTeam}
                  </p>
                </div>
                {liveMatch?.awayLogo && (
                  <img src={liveMatch.awayLogo} alt={liveScoreInfo.awayTeam} className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* No live match state */}
        {!hasLiveMatch && !isLoading && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum jogo ao vivo agora</p>
            <p className="text-sm text-muted-foreground/60 mt-1">A classificação abaixo é a atual com base nos jogos encerrados</p>
            {upcomingMatches && upcomingMatches.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Próximos jogos</p>
                {upcomingMatches.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{m.homeTeam} vs {m.awayTeam}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{format(new Date(m.matchDate), "dd MMM, HH:mm", { locale: ptBR })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Live legend */}
        {hasLiveMatch && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[0,1,2,3,4].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400" />)}
              </div>
              <span>Placar exato (+5pts)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[0,1,2,3,4].map(i => <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < 4 ? "bg-primary" : "bg-muted-foreground/20")} />)}
              </div>
              <span>Vencedor certo (+3pts)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[0,1,2,3,4].map(i => <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < 1 ? "bg-red-500/60" : "bg-muted-foreground/20")} />)}
              </div>
              <span>Errou</span>
            </div>
          </div>
        )}

        {/* Ranking list */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : entries.length > 0 ? (
          <div className={cn(
            "bg-card border rounded-xl overflow-hidden",
            hasLiveMatch ? "border-primary/20" : "border-card-border"
          )}>
            <AnimatedRankingList
              entries={entries}
              currentUserId={user?.id}
              isLive={hasLiveMatch}
              liveScore={liveScoreInfo}
            />
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
