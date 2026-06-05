import { useEffect, useRef, useState } from "react";
import {
  useGetRanking,
  getGetRankingQueryKey,
  useGetLiveRanking,
  getGetLiveRankingQueryKey,
  useListMatches,
  getListMatchesQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { AnimatedRankingList } from "@/components/AnimatedRankingList";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Zap, Radio, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
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

interface MatchParticipant {
  userId: number;
  name: string;
  avatarUrl: string | null;
  hasPrediction: boolean;
  predHome: number | null;
  predAway: number | null;
  points: number;
  proximity: number | null;
}

interface LiveMatchBreakdown {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  hasScore: boolean;
  participants: MatchParticipant[];
}

function useLiveMatchBreakdowns(enabled: boolean) {
  return useQuery<LiveMatchBreakdown[]>({
    queryKey: ["ranking-live-matches"],
    queryFn: async () => {
      const token = localStorage.getItem("bolao_token");
      const res = await fetch("/api/ranking/live-matches", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar breakdown");
      return res.json() as Promise<LiveMatchBreakdown[]>;
    },
    enabled,
    refetchInterval: 15_000,
    staleTime: 0,
  });
}

function pointsColor(pts: number, hasScore: boolean) {
  if (!hasScore) return "text-muted-foreground";
  if (pts === 3) return "text-yellow-400";
  if (pts === 1) return "text-primary";
  return "text-red-400";
}

function pointsLabel(pts: number, hasScore: boolean) {
  if (!hasScore) return "—";
  if (pts === 3) return "+3 exato!";
  if (pts === 1) return "+1 vencedor";
  return "0 pts";
}

function MatchBreakdownCard({ match, currentUserId, defaultOpen = false }: { match: LiveMatchBreakdown; currentUserId?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(201,162,39,0.2)" }}
    >
      {/* Clickable header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors hover:bg-white/5"
        style={{ background: "linear-gradient(135deg, rgba(201,162,39,0.10) 0%, rgba(201,162,39,0.04) 100%)" }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {match.homeLogo && (
            <img src={match.homeLogo} alt={match.homeTeam} className="w-7 h-7 object-contain flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <span className="font-bold text-sm text-foreground truncate">{match.homeTeam}</span>
        </div>

        <div className="text-center px-3 flex-shrink-0">
          {match.hasScore ? (
            <span className="text-xl font-black text-primary tabular-nums">
              {match.homeScore} × {match.awayScore}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground font-semibold">vs</span>
          )}
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <Zap className="w-3 h-3 text-red-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-red-400">AO VIVO</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="font-bold text-sm text-foreground truncate">{match.awayTeam}</span>
          {match.awayLogo && (
            <img src={match.awayLogo} alt={match.awayTeam} className="w-7 h-7 object-contain flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <ChevronDown
            className={cn("w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ml-1", open && "rotate-180")}
          />
        </div>
      </button>

      {/* Collapsible participants list */}
      {open && (
        <div className="divide-y divide-border border-t border-white/5">
          {match.participants.map((p, idx) => {
            const isMe = p.userId === currentUserId;
            return (
              <div
                key={p.userId}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  isMe && "bg-primary/5 border-l-2 border-l-primary"
                )}
              >
                <span className="text-xs font-bold text-muted-foreground w-5 text-center flex-shrink-0">
                  {p.hasPrediction ? idx + 1 : "—"}
                </span>

                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                  style={{ background: "rgba(201,162,39,0.15)", color: "hsl(43,74%,52%)" }}
                >
                  {p.name.slice(0, 2).toUpperCase()}
                </div>

                <p className={cn("text-sm font-medium flex-1 min-w-0 truncate", isMe ? "text-primary" : "text-foreground")}>
                  {p.name}
                  {isMe && <span className="text-xs ml-1 text-primary/60">(você)</span>}
                </p>

                {p.hasPrediction ? (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      palpite:{" "}
                      <span className="font-bold text-foreground tabular-nums">
                        {p.predHome} × {p.predAway}
                      </span>
                    </span>
                    <span className={cn("text-xs font-bold min-w-[70px] text-right", pointsColor(p.points, match.hasScore))}>
                      {pointsLabel(p.points, match.hasScore)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/50 italic flex-shrink-0">sem palpite</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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

  const { data: matchBreakdowns, isLoading: loadingBreakdowns } = useLiveMatchBreakdowns(hasLiveMatch);

  useEffect(() => {
    if (hasLiveMatch) {
      pollRef.current = setInterval(() => {
        qc.invalidateQueries({ queryKey: getGetLiveRankingQueryKey() });
        qc.invalidateQueries({ queryKey: ["ranking-live-matches"] });
      }, 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasLiveMatch, qc]);

  const isLoading = hasLiveMatch ? loadingLive : loadingBase;
  const entries = hasLiveMatch ? (liveRanking ?? []) : toLiveShape(baseRanking);

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

        {/* Scoring guide (only when not live) */}
        {!hasLiveMatch && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pontuação</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-primary/10 rounded-lg py-2 px-3">
                <p className="text-xl font-black text-primary">3</p>
                <p className="text-xs text-muted-foreground">Placar exato</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg py-2 px-3">
                <p className="text-xl font-black text-yellow-400">1</p>
                <p className="text-xs text-muted-foreground">Vencedor certo</p>
              </div>
              <div className="bg-muted/50 rounded-lg py-2 px-3">
                <p className="text-xl font-black text-muted-foreground">0</p>
                <p className="text-xs text-muted-foreground">Errou tudo</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Global ranking ── */}
        {hasLiveMatch && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Classificação geral (projetada)
            </h2>
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

        {/* ── Per-match breakdown (only during live) ── */}
        {hasLiveMatch && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Palpites por jogo
            </h2>

            {loadingBreakdowns ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : (matchBreakdowns ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum jogo ao vivo no momento.</p>
            ) : (
              (matchBreakdowns ?? []).map((match, idx) => (
                <MatchBreakdownCard
                  key={match.matchId}
                  match={match}
                  currentUserId={user?.id}
                  defaultOpen={idx === 0}
                />
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
