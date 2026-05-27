import { useEffect, useRef, useState } from "react";

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
import { Radio, Zap, Clock, Calendar, ChevronDown, ChevronUp, Youtube } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
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

interface LiveMatchCardProps {
  match: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    homeLogo?: string | null;
    awayLogo?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    youtubeUrl?: string | null;
  };
  rankingEntries: ReturnType<typeof toLiveShape>;
  currentUserId?: number;
  isFirst: boolean;
}

function LiveMatchCard({ match, rankingEntries, currentUserId, isFirst }: LiveMatchCardProps) {
  const [expanded, setExpanded] = useState(isFirst);
  const embedUrl = match.youtubeUrl ? getYoutubeEmbedUrl(match.youtubeUrl) : null;

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  const hasScore = match.homeScore != null && match.awayScore != null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(201,162,39,0.10) 0%, rgba(201,162,39,0.04) 100%)",
        border: "1px solid rgba(201,162,39,0.25)",
      }}
    >
      {/* Score bar — always visible, click to expand */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {match.homeLogo && (
            <img src={match.homeLogo} alt={match.homeTeam} className="w-9 h-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <span className="text-base font-bold text-foreground">{match.homeTeam}</span>
        </div>

        <div className="text-center px-4">
          {hasScore ? (
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-primary tabular-nums">{match.homeScore}</span>
              <span className="text-xl font-bold text-muted-foreground">×</span>
              <span className="text-3xl font-black text-primary tabular-nums">{match.awayScore}</span>
            </div>
          ) : (
            <span className="text-xl font-bold text-muted-foreground">vs</span>
          )}
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <Zap className="w-3 h-3 text-red-400 animate-pulse" />
            <span className="text-xs font-semibold text-red-400">Em andamento</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-foreground">{match.awayTeam}</span>
          {match.awayLogo && (
            <img src={match.awayLogo} alt={match.awayTeam} className="w-9 h-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="ml-2 text-muted-foreground/60">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-4 space-y-4 border-t border-white/5 pt-4">
              {embedUrl && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Youtube className="w-3.5 h-3.5 text-red-500" />
                    <span>Transmissão ao vivo</span>
                  </div>
                  <div
                    className="mx-auto rounded-xl overflow-hidden bg-black"
                    style={{ maxWidth: "600px", aspectRatio: "16/9" }}
                  >
                    <iframe
                      src={embedUrl}
                      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* Legend */}
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

              {/* Ranking */}
              <div className="bg-card border border-primary/20 rounded-xl overflow-hidden">
                <AnimatedRankingList
                  entries={rankingEntries}
                  currentUserId={currentUserId}
                  isLive={true}
                  liveScore={hasScore ? {
                    home: match.homeScore as number,
                    away: match.awayScore as number,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                  } : undefined}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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

  const rankingEntries = (hasLiveMatch ? (liveRanking ?? []) : toLiveShape(baseRanking)) as ReturnType<typeof toLiveShape>;
  const isLoading = loadingMatches || (hasLiveMatch ? loadingLive : false);

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

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* Live match cards — one per match, collapsible */}
        {!isLoading && hasLiveMatch && liveMatches?.map((match, idx) => (
          <LiveMatchCard
            key={match.id}
            match={match}
            rankingEntries={rankingEntries}
            currentUserId={user?.id}
            isFirst={idx === 0}
          />
        ))}

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

        {/* Static ranking when no live match */}
        {!hasLiveMatch && !isLoading && rankingEntries.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
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
