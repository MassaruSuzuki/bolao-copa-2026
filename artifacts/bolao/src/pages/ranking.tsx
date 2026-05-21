import { useEffect, useRef } from "react";
import {
  useGetRanking,
  getGetRankingQueryKey,
  useGetLiveRanking,
  getGetLiveRankingQueryKey,
  useListMatches,
  getListMatchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { AnimatedRankingList } from "@/components/AnimatedRankingList";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Zap, Radio } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { RankingEntry } from "@workspace/api-client-react";

// Convert base RankingEntry to LiveRankingEntry shape for the shared component
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

export default function RankingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: liveMatches } = useListMatches(
    { status: "live" },
    { query: { queryKey: getListMatchesQueryKey({ status: "live" }), refetchInterval: 10_000 } }
  );
  const hasLiveMatch = (liveMatches?.length ?? 0) > 0;
  const liveMatch = liveMatches?.[0];

  const { data: baseRanking, isLoading: loadingBase } = useGetRanking({
    query: { queryKey: getGetRankingQueryKey(), enabled: !hasLiveMatch },
  });

  const { data: liveRanking, isLoading: loadingLive } = useGetLiveRanking({
    query: {
      queryKey: getGetLiveRankingQueryKey(),
      enabled: hasLiveMatch,
      refetchInterval: 10_000,
    },
  });

  // Fast poll during live matches: every 10s refresh live ranking
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

  const isLoading = hasLiveMatch ? loadingLive : loadingBase;
  const entries = hasLiveMatch ? (liveRanking ?? []) : toLiveShape(baseRanking);

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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {hasLiveMatch ? "Classificação ao vivo — atualizando automaticamente" : "Classificação geral do Bolão da Copa"}
            </p>
          </div>
          {hasLiveMatch && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10">
              <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span className="text-xs font-semibold text-red-400">AO VIVO</span>
            </div>
          )}
        </div>

        {/* Live match score banner */}
        {hasLiveMatch && liveScoreInfo && (
          <div
            className="rounded-xl px-5 py-4 flex items-center justify-between"
            style={{
              background: "linear-gradient(135deg, rgba(201,162,39,0.08) 0%, rgba(201,162,39,0.03) 100%)",
              border: "1px solid rgba(201,162,39,0.2)",
            }}
          >
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-primary animate-pulse" />
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Placar atual</p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {liveScoreInfo.homeTeam}{" "}
                  <span className="text-primary tabular-nums text-lg font-black">
                    {liveScoreInfo.home} x {liveScoreInfo.away}
                  </span>{" "}
                  {liveScoreInfo.awayTeam}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              As posições mudam com o placar
            </p>
          </div>
        )}

        {/* Scoring guide (only when not live) */}
        {!hasLiveMatch && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pontuação</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-primary/10 rounded-lg py-2 px-3">
                <p className="text-xl font-black text-primary">5</p>
                <p className="text-xs text-muted-foreground">Placar exato</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg py-2 px-3">
                <p className="text-xl font-black text-yellow-400">3</p>
                <p className="text-xs text-muted-foreground">Vencedor certo</p>
              </div>
              <div className="bg-muted/50 rounded-lg py-2 px-3">
                <p className="text-xl font-black text-muted-foreground">0</p>
                <p className="text-xs text-muted-foreground">Errou tudo</p>
              </div>
            </div>
          </div>
        )}

        {/* Live legend */}
        {hasLiveMatch && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[0,1,2,3,4].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400" />)}
              </div>
              <span>Placar exato</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[0,1,2,3,4].map(i => <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < 4 ? "bg-primary" : "bg-muted-foreground/20")} />)}
              </div>
              <span>1 gol de distância</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[0,1,2,3,4].map(i => <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < 2 ? "bg-primary/70" : "bg-muted-foreground/20")} />)}
              </div>
              <span>Longe</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className={cn("bg-card border border-card-border rounded-xl overflow-hidden", hasLiveMatch && "border-primary/20")}>
            {entries.length > 0 ? (
              <AnimatedRankingList
                entries={entries}
                currentUserId={user?.id}
                isLive={hasLiveMatch}
                liveScore={liveScoreInfo}
              />
            ) : (
              <div className="px-5 py-12 text-center">
                <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma pontuação ainda.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os pontos aparecem quando os jogos encerrarem.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
