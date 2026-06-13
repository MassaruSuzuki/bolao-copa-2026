import { memo, useMemo, useState } from "react";

import {
  useGetLiveRanking,
  getGetLiveRankingQueryKey,
  useGetRanking,
  getGetRankingQueryKey,
  useListMatches,
  getListMatchesQueryKey,
  type RankingEntry,
} from "@workspace/api-client-react";

import { Layout } from "@/components/Layout";
import { AnimatedRankingList } from "@/components/AnimatedRankingList";
import { MatchChat } from "@/components/MatchChat";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

import {
  Radio,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  Trophy,
} from "lucide-react";

type LiveMatch = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

type LiveRankingEntry = {
  userId: number;
  name: string;
  basePoints: number;
  liveBonus: number;
  projectedTotal: number;
  liveMatchId: number | null;
  predHome: number | null;
  predAway: number | null;
  currentHome: number | null;
  currentAway: number | null;
  proximity: number | null;
  hasPrediction: boolean;
};

function toLiveShape(entries: RankingEntry[] | undefined): LiveRankingEntry[] {
  return (entries ?? []).map((entry) => ({
    userId: entry.userId,
    name: entry.name,
    basePoints: entry.totalPoints,
    liveBonus: 0,
    projectedTotal: entry.totalPoints,
    liveMatchId: null,
    predHome: null,
    predAway: null,
    currentHome: null,
    currentAway: null,
    proximity: null,
    hasPrediction: entry.totalPredictions > 0,
  }));
}

function sortRanking(entries: LiveRankingEntry[]) {
  return [...entries].sort((a, b) => {
    const pointsA = a.projectedTotal ?? a.basePoints ?? 0;
    const pointsB = b.projectedTotal ?? b.basePoints ?? 0;

    if (pointsB !== pointsA) {
      return pointsB - pointsA;
    }

    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function ScoreLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span>🟡🟡🟡🟡🟡 Placar exato (+3pts)</span>
      <span>🟡🟡🟡🟡⚫ Vencedor ou empate (+1pt)</span>
      <span>🔴⚫⚫⚫⚫ Errou</span>
    </div>
  );
}

const LiveMatchCard = memo(
  function LiveMatchCard({
    match,
    rankingEntries,
    currentUserId,
    isFirst,
  }: {
    match: LiveMatch;
    rankingEntries: LiveRankingEntry[];
    currentUserId?: number;
    isFirst: boolean;
  }) {
    const [expanded, setExpanded] = useState(isFirst);
    const [rankingExpanded, setRankingExpanded] = useState(true);

    const hasScore = match.homeScore != null && match.awayScore != null;

    return (
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(201,162,39,0.10) 0%, rgba(201,162,39,0.04) 100%)",
          border: "1px solid rgba(201,162,39,0.25)",
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-white/5"
        >
          <div className="flex flex-1 items-center gap-3">
            {match.homeLogo && (
              <img
                src={match.homeLogo}
                alt={match.homeTeam}
                className="h-9 w-9 object-contain"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            )}

            <span className="text-left text-base font-bold text-foreground">
              {match.homeTeam}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center px-4 text-center">
            {hasScore ? (
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-3xl font-black text-primary">
                  {match.homeScore}
                </span>

                <span className="text-xl font-bold text-muted-foreground">
                  ×
                </span>

                <span className="tabular-nums text-3xl font-black text-primary">
                  {match.awayScore}
                </span>
              </div>
            ) : (
              <span className="text-xl font-bold text-muted-foreground">vs</span>
            )}

            <div className="mt-1 flex items-center justify-center gap-1">
              <Zap className="h-3 w-3 animate-pulse text-red-400" />

              <span className="text-xs font-semibold text-red-400">
                Em andamento
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="text-right text-base font-bold text-foreground">
              {match.awayTeam}
            </span>

            {match.awayLogo && (
              <img
                src={match.awayLogo}
                alt={match.awayTeam}
                className="h-9 w-9 object-contain"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            )}

            <div className="ml-2 text-muted-foreground/60">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>
        </button>

        <div className={cn("space-y-4 p-4", !expanded && "hidden")}>
          <div className="overflow-hidden rounded-xl border border-primary/20 bg-card">
            <MatchChat matchId={match.id} isLive />
          </div>

          <div className="overflow-hidden rounded-xl border border-primary/20 bg-card">
            <button
              type="button"
              onClick={() => setRankingExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between border-b border-border px-4 py-3 transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>

                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">
                    Ranking da Partida
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Participantes e pontuação ao vivo
                  </p>
                </div>
              </div>

              {rankingExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <div className={cn("space-y-3 p-3", !rankingExpanded && "hidden")}>
              <ScoreLegend />

              <div className="overflow-hidden rounded-lg border border-white/5">
                <AnimatedRankingList
                  entries={rankingEntries}
                  currentUserId={currentUserId}
                  isLive
                  liveScore={
                    hasScore
                      ? {
                          home: match.homeScore as number,
                          away: match.awayScore as number,
                          homeTeam: match.homeTeam,
                          awayTeam: match.awayTeam,
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.match.id === next.match.id &&
    prev.match.homeScore === next.match.homeScore &&
    prev.match.awayScore === next.match.awayScore &&
    prev.rankingEntries === next.rankingEntries &&
    prev.currentUserId === next.currentUserId &&
    prev.isFirst === next.isFirst
);

export default function AoVivoPage() {
  const { user } = useAuth();

  const { data: liveMatches, isLoading: loadingMatches } = useListMatches(
    { status: "live" },
    {
      query: {
        queryKey: getListMatchesQueryKey({ status: "live" }),
        staleTime: 5_000,
        refetchInterval: 10_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
      },
    }
  );

  const hasLiveMatch = (liveMatches?.length ?? 0) > 0;

  const { data: baseRanking } = useGetRanking({
    query: {
      queryKey: getGetRankingQueryKey(),
      enabled: !hasLiveMatch,
      staleTime: 30_000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
  });

  const { data: liveRanking } = useGetLiveRanking({
    query: {
      queryKey: getGetLiveRankingQueryKey(),
      enabled: hasLiveMatch,
      staleTime: 5_000,
      refetchInterval: 10_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
  });

  const rankingEntries = useMemo(() => {
    const entries = hasLiveMatch
      ? ((liveRanking ?? []) as LiveRankingEntry[])
      : toLiveShape(baseRanking);

    return sortRanking(entries);
  }, [hasLiveMatch, liveRanking, baseRanking]);

  const isInitialLoading = loadingMatches && !liveMatches;

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Radio
                className={cn(
                  "h-6 w-6",
                  hasLiveMatch
                    ? "animate-pulse text-red-400"
                    : "text-muted-foreground"
                )}
              />

              Ao Vivo
            </h1>

            <p className="mt-0.5 text-sm text-muted-foreground">
              {hasLiveMatch
                ? "Jogo em andamento — chat e ranking da partida"
                : "Nenhum jogo em andamento no momento"}
            </p>
          </div>

          {hasLiveMatch && (
            <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />

              <span className="text-xs font-semibold text-red-400">
                AO VIVO
              </span>
            </div>
          )}
        </div>

        {isInitialLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {hasLiveMatch &&
          liveMatches?.map((match, index) => (
            <LiveMatchCard
              key={match.id}
              match={match}
              rankingEntries={rankingEntries}
              currentUserId={user?.id}
              isFirst={index === 0}
            />
          ))}

        {!hasLiveMatch && !isInitialLoading && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />

            <p className="font-medium text-muted-foreground">
              Nenhum jogo ao vivo agora
            </p>

            <p className="mt-1 text-sm text-muted-foreground/60">
              A classificação abaixo é a atual com base nos jogos encerrados
            </p>
          </div>
        )}

        {!hasLiveMatch && !isInitialLoading && rankingEntries.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-card-border bg-card">
            <AnimatedRankingList
              entries={rankingEntries}
              currentUserId={user?.id}
              isLive={false}
              liveScore={undefined}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}