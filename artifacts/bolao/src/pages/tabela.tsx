import { useGetRanking, getGetRankingQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Trophy, Minus } from "lucide-react";

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

function InitialAvatar({ name, isMe }: { name: string; isMe: boolean }) {
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0",
        isMe
          ? "text-[#1a1200]"
          : "bg-white/8 text-white/60"
      )}
      style={isMe ? {
        background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
      } : {}}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function TabelaPage() {
  const { user } = useAuth();
  const { data: ranking, isLoading } = useGetRanking({
    query: { queryKey: getGetRankingQueryKey() },
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tabela do Bolão</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Classificação detalhada — estilo Campeonato Brasileiro</p>
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
            <div className="grid items-center border-b border-border px-4 py-2.5 bg-muted/30"
              style={{ gridTemplateColumns: "2rem 1.5rem 1fr 2.5rem 2.5rem 2.5rem 2.5rem 3rem" }}>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide text-center">#</span>
              <span />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Participante</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide text-center" title="Palpites em jogos encerrados">PJ</span>
              <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide text-center" title="Placar exato (5 pts)">AC</span>
              <span className="text-xs font-bold text-primary uppercase tracking-wide text-center" title="Vencedor certo (3 pts)">V</span>
              <span className="text-xs font-bold text-red-400/80 uppercase tracking-wide text-center" title="Errou (0 pts)">E</span>
              <span className="text-xs font-bold text-foreground uppercase tracking-wide text-center">PTS</span>
            </div>

            {/* Rows */}
            {ranking.map((entry, idx) => {
              const position = idx + 1;
              const isMe = entry.userId === user?.id;
              const erros = entry.totalPredictions - entry.exactScores - entry.correctResults;
              const total = ranking.length;

              return (
                <div
                  key={entry.userId}
                  className={cn(
                    "relative grid items-center px-4 py-3 border-b border-border last:border-0 transition-colors",
                    isMe ? "bg-primary/5" : "hover:bg-white/2"
                  )}
                  style={{ gridTemplateColumns: "2rem 1.5rem 1fr 2.5rem 2.5rem 2.5rem 2.5rem 3rem" }}
                >
                  <PositionBar position={position} total={total} />

                  {/* Position */}
                  <div className="text-sm font-semibold text-center tabular-nums">
                    <PositionBadge position={position} />
                  </div>

                  {/* Avatar */}
                  <InitialAvatar name={entry.name} isMe={isMe} />

                  {/* Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <p className={cn(
                      "text-sm font-semibold truncate",
                      isMe ? "text-primary" : "text-foreground"
                    )}>
                      {entry.name}
                      {isMe && <span className="text-xs ml-1.5 text-primary/60 font-normal">(você)</span>}
                    </p>
                  </div>

                  {/* PJ */}
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground tabular-nums">{entry.totalPredictions}</span>
                  </div>

                  {/* AC - exact scores */}
                  <div className="text-center">
                    <span className={cn(
                      "text-sm font-semibold tabular-nums",
                      entry.exactScores > 0 ? "text-yellow-400" : "text-muted-foreground/50"
                    )}>
                      {entry.exactScores}
                    </span>
                  </div>

                  {/* V - correct winner */}
                  <div className="text-center">
                    <span className={cn(
                      "text-sm font-semibold tabular-nums",
                      entry.correctResults > 0 ? "text-primary" : "text-muted-foreground/50"
                    )}>
                      {entry.correctResults}
                    </span>
                  </div>

                  {/* E - wrong */}
                  <div className="text-center">
                    <span className={cn(
                      "text-sm tabular-nums",
                      erros > 0 ? "text-red-400/80" : "text-muted-foreground/50"
                    )}>
                      {erros > 0 ? erros : <Minus className="w-3 h-3 mx-auto text-muted-foreground/30" />}
                    </span>
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
        )}

        {/* Column legend */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground/60">
          <span><strong className="text-muted-foreground">PJ</strong> = Palpites em jogos encerrados</span>
          <span><strong className="text-yellow-400">AC</strong> = Acertos (placar exato, 5pts)</span>
          <span><strong className="text-primary">V</strong> = Vencedor certo (3pts)</span>
          <span><strong className="text-red-400/80">E</strong> = Erros (0pts)</span>
          <span><strong className="text-foreground">PTS</strong> = Pontos totais</span>
        </div>
      </div>
    </Layout>
  );
}
