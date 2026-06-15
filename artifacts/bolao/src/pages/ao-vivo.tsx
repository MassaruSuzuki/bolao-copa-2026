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

    if (pointsB !== pointsA) return pointsB - pointsA;

    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function ScoreLegend() {
  return (
    <div className="space-y-1.5 text-[11px] text-muted-foreground">
      <p className="truncate">🟡🟡🟡🟡🟡 Placar exato (+3pts)</p>
      <p className="truncate">🟡🟡🟡🟡⚫ Vencedor ou empate (+1pt)</p>
      <p className="truncate">🔴⚫⚫⚫⚫ Errou</p>
    </div>
  );
}

function StaticRankingList({
  entries,
  currentUserId,
}: {
  entries: LiveRankingEntry[];
  currentUserId?: number;
}) {
  return (
    <div className="w-full max-w-full overflow-hidden divide-y divide-border">
      {entries.map((entry, index) => {
        const isCurrentUser = entry.userId === currentUserId;

        return (
          <div
            key={entry.userId}
            className={cn(
              "flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3",
              isCurrentUser && "bg-primary/10"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black text-muted-foreground">
                {index + 1}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {entry.name}
                </p>

                <p className="truncate text-xs text-muted-foreground">
                  {entry.hasPrediction
                    ? `Palpite: ${entry.predHome ?? "-"} x ${
                        entry.predAway ?? "-"
                      }`
                    : "sem palpite"}
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 text-right">
              <p className="text-lg font-black text-primary tabular-nums">
                {entry.liveBonus ?? 0}
              </p>

              <p className="text-[10px] text-muted-foreground">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LiveMatchCard = memo(function LiveMatchCard({
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
      className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(201,162,39,0.10) 0%, rgba(201,162,39,0.04) 100%)",
        border: "1px solid rgba(201,162,39,0.25)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 px-2.5 py-4"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {match.homeLogo && (
            <img
              src={match.homeLogo}
              alt={match.homeTeam}
              className="h-6 w-7 flex-shrink-0 object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}

          <span className="min-w-0 truncate text-left text-xs font-bold text-foreground">
            {match.homeTeam}
          </span>
        </div>

        <div className="flex flex-shrink-0 flex-col items-center justify-center text-center">
          {hasScore ? (
            <div className="flex items-center gap-1">
              <span className="tabular-nums text-2xl font-black text-primary">
                {match.homeScore}
              </span>

              <span className="text-sm font-bold text-muted-foreground">×</span>

              <span className="tabular-nums text-2xl font-black text-primary">
                {match.awayScore}
              </span>
            </div>
          ) : (
            <span className="text-base font-bold text-muted-foreground">vs</span>
          )}

          <div className="mt-1 flex items-center justify-center gap-1">
            <Zap className="h-3 w-3 flex-shrink-0 animate-pulse text-red-400" />

            <span className="text-[10px] font-semibold text-red-400">
              Ao vivo
            </span>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <span className="min-w-0 truncate text-right text-xs font-bold text-foreground">
            {match.awayTeam}
          </span>

          {match.awayLogo && (
            <img
              src={match.awayLogo}
              alt={match.awayTeam}
              className="h-6 w-7 flex-shrink-0 object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>

        <div className="flex-shrink-0 text-muted-foreground/60">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      <div className={cn("w-full min-w-0 space-y-4 p-2.5", !expanded && "hidden")}>
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-primary/20 bg-card [&_*]:max-w-full">
          <MatchChat matchId={match.id} isLive />
        </div>

        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-primary/20 bg-card">
          <button
            type="button"
            onClick={() => setRankingExpanded((prev) => !prev)}
            className="flex w-full min-w-0 items-center justify-between gap-2 border-b border-border px-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <Trophy className="h-4 w-4 text-primary" />
              </div>

              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-bold text-foreground">
                  Ranking da Partida
                </p>

                <p className="truncate text-xs text-muted-foreground">
                  {match.homeTeam} x {match.awayTeam}
                </p>
              </div>
            </div>

            {rankingExpanded ? (
              <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
          </button>

          <div className={cn("space-y-3 p-3", !rankingExpanded && "hidden")}>
            <ScoreLegend />

            <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-white/5">
              {rankingEntries.length > 0 ? (
                <StaticRankingList
                  entries={rankingEntries}
                  currentUserId={currentUserId}
                />
              ) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum participante pontuando neste jogo ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

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

  const baseRankingEntries = useMemo(() => {
    return sortRanking(toLiveShape(baseRanking));
  }, [baseRanking]);

  const liveRankingEntries = useMemo(() => {
    return sortRanking((liveRanking ?? []) as LiveRankingEntry[]);
  }, [liveRanking]);

  const isInitialLoading = loadingMatches && !liveMatches;

  return (
    <Layout>
      <div className="w-full min-w-0 max-w-full overflow-x-hidden px-3 py-4">
        <div className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden">
          <div className="flex w-full min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <Radio
                  className={cn(
                    "h-6 w-6 flex-shrink-0",
                    hasLiveMatch
                      ? "animate-pulse text-red-400"
                      : "text-muted-foreground"
                  )}
                />

                Ao Vivo
              </h1>

              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {hasLiveMatch
                  ? "Jogo em andamento — chat e ranking da partida"
                  : "Nenhum jogo em andamento no momento"}
              </p>
            </div>

            {hasLiveMatch && (
              <div className="flex flex-shrink-0 items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5">
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
            liveMatches?.map((match, index) => {
              const matchRankingEntries = sortRanking(
                liveRankingEntries.filter(
                  (entry) => entry.liveMatchId === match.id
                )
              );

              return (
                <LiveMatchCard
                  key={match.id}
                  match={match}
                  rankingEntries={matchRankingEntries}
                  currentUserId={user?.id}
                  isFirst={index === 0}
                />
              );
            })}

          {!hasLiveMatch && !isInitialLoading && (
            <div
              className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl p-6 text-center"
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

          {!hasLiveMatch && !isInitialLoading && baseRankingEntries.length > 0 && (
            <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-card-border bg-card">
              <StaticRankingList
                entries={baseRankingEntries}
                currentUserId={user?.id}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}