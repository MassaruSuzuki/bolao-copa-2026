import { useListMyPredictions, getListMyPredictionsQueryKey, useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target } from "lucide-react";

export default function PredictionsPage() {
  const { data: predictions, isLoading: loadingPreds } = useListMyPredictions({
    query: { queryKey: getListMyPredictionsQueryKey() },
  });
  const { data: matches, isLoading: loadingMatches } = useListMatches(undefined, {
    query: { queryKey: getListMatchesQueryKey() },
  });

  const isLoading = loadingPreds || loadingMatches;

  const predsByMatchId = new Map((predictions ?? []).map((p) => [p.matchId, p]));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Palpites</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Acompanhe seus palpites em todos os jogos</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {matches?.map((m) => {
              const pred = predsByMatchId.get(m.id);
              return (
                <Link key={m.id} href={`/matches/${m.id}`}>
                  <div
                    className="bg-card border border-card-border rounded-xl p-4 hover:bg-muted/20 cursor-pointer transition-colors"
                    data-testid={`my-prediction-${m.id}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                          <img src={m.homeLogo ?? ""} alt={m.homeTeam} className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <span>{m.homeTeam}</span>
                          <span className="text-muted-foreground">vs</span>
                          <span>{m.awayTeam}</span>
                          <img src={m.awayLogo ?? ""} alt={m.awayTeam} className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(m.matchDate), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        {pred ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Meu palpite:</span>
                            <span className="font-bold text-foreground tabular-nums">
                              {pred.homeGoals} x {pred.awayGoals}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs border-dashed">Sem palpite</Badge>
                        )}
                        {m.status === "finished" && pred && m.homeScore !== null && m.awayScore !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Placar:</span>
                            <span className="text-xs font-bold text-muted-foreground tabular-nums">
                              {m.homeScore} x {m.awayScore}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {!matches?.length && (
              <div className="bg-card border border-card-border rounded-xl p-12 text-center">
                <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum jogo disponível ainda</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
