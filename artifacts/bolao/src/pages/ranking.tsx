import { useGetRanking, getGetRankingQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function PodiumBadge({ position }: { position: number }) {
  if (position === 1) return (
    <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
      <Trophy className="w-4 h-4 text-yellow-400" />
    </div>
  );
  if (position === 2) return (
    <div className="w-8 h-8 rounded-full bg-gray-400/20 border border-gray-400/30 flex items-center justify-center">
      <Medal className="w-4 h-4 text-gray-300" />
    </div>
  );
  if (position === 3) return (
    <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
      <Medal className="w-4 h-4 text-orange-400" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
      <span className="text-xs font-bold text-muted-foreground">{position}</span>
    </div>
  );
}

export default function RankingPage() {
  const { user } = useAuth();
  const { data: ranking, isLoading } = useGetRanking({
    query: { queryKey: getGetRankingQueryKey() },
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ranking</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Classificação geral do Bolão da Copa</p>
        </div>

        {/* Scoring guide */}
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

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {ranking?.map((entry, idx) => {
                const isMe = entry.userId === user?.id;
                const position = idx + 1;
                return (
                  <div
                    key={entry.userId}
                    className={cn(
                      "px-5 py-4 flex items-center gap-4 transition-colors",
                      isMe && "bg-primary/5 border-l-2 border-l-primary",
                      position <= 3 && !isMe && "bg-muted/10"
                    )}
                    data-testid={`ranking-row-${entry.userId}`}
                  >
                    <PodiumBadge position={position} />

                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-sm text-foreground truncate", isMe && "text-primary")}>
                        {entry.name}
                        {isMe && <span className="text-xs ml-1.5 text-primary/70">(você)</span>}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {entry.totalPredictions} palpites
                        </span>
                        <span>{entry.exactScores} exatos</span>
                        <span>{entry.correctResults} certos</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={cn("text-xl font-black tabular-nums", position === 1 ? "text-yellow-400" : position === 2 ? "text-gray-300" : position === 3 ? "text-orange-400" : "text-foreground")}>
                        {entry.totalPoints}
                      </p>
                      <p className="text-xs text-muted-foreground">pts</p>
                    </div>
                  </div>
                );
              })}
              {!ranking?.length && (
                <div className="px-5 py-12 text-center">
                  <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma pontuação ainda.</p>
                  <p className="text-sm text-muted-foreground mt-1">Os pontos aparecem quando os jogos encerrarem.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
