import { useRef, useLayoutEffect, useEffect } from "react";
import {
  useGetRanking,
  getGetRankingQueryKey,
  useListMatches,
  getListMatchesQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Trophy, Minus } from "lucide-react";

const COLS = "2rem 1fr 2.5rem 2.5rem 2.5rem 3rem";

function PositionBar({ position, total }: { position: number; total: number }) {
  if (position === 1) return <div className="w-1 h-full rounded-r-full bg-yellow-400 absolute left-0 top-0" />;
  if (position === 2) return <div className="w-1 h-full rounded-r-full bg-gray-300 absolute left-0 top-0" />;
  if (position === 3) return <div className="w-1 h-full rounded-r-full bg-orange-400 absolute left-0 top-0" />;
  if (position === total) return <div className="w-1 h-full rounded-r-full bg-red-500/70 absolute left-0 top-0" />;
  return null;
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return <span className="font-black text-yellow-400">{position}</span>;
  if (position === 2) return <span className="font-black text-gray-300">{position}</span>;
  if (position === 3) return <span className="font-black text-orange-400">{position}</span>;
  return <span className="text-muted-foreground">{position}</span>;
}

export default function TabelaPage() {
  const { user } = useAuth();

  const { data: ranking, isLoading } = useGetRanking({
    query: { queryKey: getGetRankingQueryKey(), refetchInterval: 10_000 },
  });

  // Watch for live matches so positions can update when a match finishes
  useListMatches(
    { status: "live" },
    { query: { queryKey: getListMatchesQueryKey({ status: "live" }), refetchInterval: 10_000 } }
  );

  // FLIP animation refs
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevPositions = useRef<Map<number, number>>(new Map());

  const recordPositions = () => {
    prevPositions.current.clear();
    nodeRefs.current.forEach((node, userId) => {
      if (node) prevPositions.current.set(userId, node.getBoundingClientRect().top);
    });
  };

  useLayoutEffect(() => {
    nodeRefs.current.forEach((node, userId) => {
      if (!node) return;
      const oldTop = prevPositions.current.get(userId);
      if (oldTop === undefined) return;
      const newTop = node.getBoundingClientRect().top;
      const deltaY = oldTop - newTop;
      if (Math.abs(deltaY) > 2) {
        node.style.transition = "none";
        node.style.transform = `translateY(${deltaY}px)`;
        node.getBoundingClientRect();
        node.style.transition = "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)";
        node.style.transform = "translateY(0)";
      }
    });
  }, [ranking]);

  useEffect(() => {
    recordPositions();
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tabela do Bolão</h1>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-yellow-400/80" />
            <span>1º Lugar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-300/60" />
            <span>2º Lugar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-400/60" />
            <span>3º Lugar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500/50" />
            <span>Lanterna</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-1">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : !ranking?.length ? (
          <div className="bg-card border border-card-border rounded-xl px-5 py-12 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma pontuação ainda</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Os dados aparecem quando os jogos encerrarem.</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {/* Table header */}
            <div
              className="grid items-center border-b border-border px-4 py-2.5 bg-muted/30 gap-x-3"
              style={{ gridTemplateColumns: COLS }}
            >
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide text-center">#</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Participante</span>
              <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide text-center" title="Placar exato (5 pts)">AC</span>
              <span className="text-xs font-bold text-primary uppercase tracking-wide text-center" title="Vencedor certo (3 pts)">V</span>
              <span className="text-xs font-bold text-red-400/80 uppercase tracking-wide text-center" title="Errou (0 pts)">E</span>
              <span className="text-xs font-bold text-foreground uppercase tracking-wide text-center">PTS</span>
            </div>

            {/* Rows */}
            <div className="relative">
              {ranking.map((entry, idx) => {
                const position = idx + 1;
                const isMe = entry.userId === user?.id;
                const erros = entry.totalPredictions - entry.exactScores - entry.correctResults;
                const total = ranking.length;

                return (
                  <div
                    key={entry.userId}
                    ref={(el) => {
                      if (el) nodeRefs.current.set(entry.userId, el);
                      else nodeRefs.current.delete(entry.userId);
                    }}
                    className={cn(
                      "relative grid items-center px-4 py-3 border-b border-border last:border-0 will-change-transform gap-x-3",
                      isMe ? "bg-primary/5" : "hover:bg-white/[0.02]"
                    )}
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <PositionBar position={position} total={total} />

                    {/* Position */}
                    <div className="text-sm font-semibold text-center tabular-nums">
                      <PositionBadge position={position} />
                    </div>

                    {/* Avatar + Name (combined flex cell) */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0",
                          isMe ? "text-[#1a1200]" : "bg-white/[0.08] text-white/60"
                        )}
                        style={isMe ? {
                          background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                        } : {}}
                      >
                        {entry.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className={cn(
                        "text-sm font-semibold truncate",
                        isMe ? "text-primary" : "text-foreground"
                      )}>
                        {entry.name}
                        {isMe && <span className="text-xs ml-1.5 text-primary/60 font-normal">(você)</span>}
                      </p>
                    </div>

                    {/* AC */}
                    <div className="text-center">
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        entry.exactScores > 0 ? "text-yellow-400" : "text-muted-foreground/50"
                      )}>
                        {entry.exactScores}
                      </span>
                    </div>

                    {/* V */}
                    <div className="text-center">
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        entry.correctResults > 0 ? "text-primary" : "text-muted-foreground/50"
                      )}>
                        {entry.correctResults}
                      </span>
                    </div>

                    {/* E */}
                    <div className="text-center">
                      {erros > 0
                        ? <span className="text-sm tabular-nums text-red-400/80">{erros}</span>
                        : <Minus className="w-3 h-3 mx-auto text-muted-foreground/30" />}
                    </div>

                    {/* PTS */}
                    <div className="text-center">
                      <span className={cn(
                        "text-base font-black tabular-nums",
                        position === 1 ? "text-yellow-400" :
                        position === 2 ? "text-gray-300" :
                        position === 3 ? "text-orange-400" :
                        isMe ? "text-primary" :
                        "text-foreground"
                      )}>
                        {entry.totalPoints}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Column legend */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground/60">
          <span><strong className="text-yellow-400">AC</strong> = Acertos (placar exato, 5pts)</span>
          <span><strong className="text-primary">V</strong> = Vencedor certo (3pts)</span>
          <span><strong className="text-red-400/80">E</strong> = Erros (0pts)</span>
          <span><strong className="text-foreground">PTS</strong> = Pontos totais</span>
        </div>
      </div>
    </Layout>
  );
}
