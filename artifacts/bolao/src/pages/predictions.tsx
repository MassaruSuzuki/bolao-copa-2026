import { useState } from "react";
import { useListMyPredictions, getListMyPredictionsQueryKey, useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function PredictionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: predictions, isLoading: loadingPreds } = useListMyPredictions({
    query: { queryKey: getListMyPredictionsQueryKey() },
  });
  const { data: matches, isLoading: loadingMatches } = useListMatches(undefined, {
    query: { queryKey: getListMatchesQueryKey() },
  });

  const isLoading = loadingPreds || loadingMatches;

  const matchById = new Map((matches ?? []).map((m) => [m.id, m]));

  const handleDelete = async (predId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(predId);
    try {
      const token = localStorage.getItem("bolao_token");
      const res = await fetch(`/api/predictions/${predId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir");
      toast({ title: "Palpite excluído" });
      qc.invalidateQueries({ queryKey: getListMyPredictionsQueryKey() });
      qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const myPredictions = (predictions ?? []).filter((p) => matchById.has(p.matchId));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Palpites</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {myPredictions.length > 0
              ? `${myPredictions.length} palpite${myPredictions.length > 1 ? "s" : ""} registrado${myPredictions.length > 1 ? "s" : ""}`
              : "Nenhum palpite registrado ainda"}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : myPredictions.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl p-12 text-center">
            <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum palpite ainda</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Acesse um jogo para fazer seu palpite</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPredictions.map((pred) => {
              const m = matchById.get(pred.matchId);
              if (!m) return null;
              const isOpen = m.status === "upcoming";
              const isDeleting = deletingId === pred.id;

              return (
                <Link key={pred.id} href={`/matches/${m.id}`}>
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

                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Meu palpite:</span>
                            <span className="font-bold text-foreground tabular-nums">
                              {pred.homeGoals} × {pred.awayGoals}
                            </span>
                          </div>
                          {m.status === "finished" && m.homeScore !== null && m.awayScore !== null && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Resultado:</span>
                              <span className="text-xs font-bold text-muted-foreground tabular-nums">
                                {m.homeScore} × {m.awayScore}
                              </span>
                            </div>
                          )}
                          {m.status === "live" && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Ao Vivo</Badge>}
                          {m.status === "finished" && <Badge variant="secondary" className="text-xs">Encerrado</Badge>}
                        </div>

                        {isOpen && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-red-400 flex-shrink-0"
                            onClick={(e) => handleDelete(pred.id, e)}
                            disabled={isDeleting}
                            title="Excluir palpite"
                          >
                            <Trash2 className={`w-4 h-4 ${isDeleting ? "animate-pulse" : ""}`} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
