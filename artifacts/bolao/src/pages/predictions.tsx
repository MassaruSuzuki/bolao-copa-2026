import { useState } from "react";
import {
  useListMyPredictions,
  getListMyPredictionsQueryKey,
  useListMatches,
  getListMatchesQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target, Trash2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function PredictionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: predictions, isLoading: loadingPreds } = useListMyPredictions({
    query: {
      queryKey: getListMyPredictionsQueryKey(),
      refetchInterval: 10_000,
    },
  });

  const { data: matches, isLoading: loadingMatches } = useListMatches(
    undefined,
    {
      query: {
        queryKey: getListMatchesQueryKey(),
        refetchInterval: 10_000,
      },
    }
  );

  const isLoading = loadingPreds || loadingMatches;

  const matchById = new Map((matches ?? []).map((m) => [m.id, m]));

  const myPredictions = (predictions ?? [])
    .filter((p) => {
      const match = matchById.get(p.matchId);

      if (!match) return false;

      return match.status !== "finished";
    })
    .sort((a, b) => {
      const matchA = matchById.get(a.matchId);
      const matchB = matchById.get(b.matchId);

      if (!matchA || !matchB) return 0;

      return (
        new Date(matchA.matchDate).getTime() -
        new Date(matchB.matchDate).getTime()
      );
    });

  const handleDelete = async (predId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDeletingId(predId);

    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch(`/api/predictions/${predId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao excluir");
      }

      toast({
        title: "Palpite excluído",
      });

      qc.invalidateQueries({ queryKey: getListMyPredictionsQueryKey() });
      qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Layout>
      <div className="px-4 pt-4 pb-4 md:p-6 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Meus Palpites
          </h1>

          <p className="text-muted-foreground text-sm mt-0.5">
            {myPredictions.length > 0
              ? `${myPredictions.length} palpite${
                  myPredictions.length !== 1 ? "s" : ""
                } ativo${myPredictions.length !== 1 ? "s" : ""}`
              : "Nenhum palpite ativo"}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : myPredictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(201,162,39,0.08)",
                border: "1px solid rgba(201,162,39,0.15)",
              }}
            >
              <Target className="w-8 h-8 text-primary/60" />
            </div>

            <p className="font-semibold text-foreground mb-1">
              Nenhum palpite ativo
            </p>

            <p className="text-sm text-muted-foreground max-w-xs">
              Seus jogos encerrados ficam em{" "}
              <strong className="text-foreground">Jogos &gt; Encerrados</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {myPredictions.map((pred) => {
              const m = matchById.get(pred.matchId);

              if (!m) return null;

              const isOpen = m.status === "upcoming";
              const isDeleting = deletingId === pred.id;

              return (
                <Link key={pred.id} href={`/matches/${m.id}`}>
                  <div
                    className="bg-card border border-card-border rounded-2xl p-4 active:scale-[0.99] cursor-pointer transition-all"
                    data-testid={`my-prediction-${m.id}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {m.status === "live" && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 animate-pulse">
                            ● AO VIVO
                          </Badge>
                        )}

                        {m.status === "upcoming" && (
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                            Em Breve
                          </Badge>
                        )}
                      </div>

                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {format(new Date(m.matchDate), "dd MMM • HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                        <img
                          src={m.homeLogo ?? ""}
                          alt={m.homeTeam}
                          className="w-9 h-9 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />

                        <span className="text-xs font-semibold text-center leading-tight line-clamp-2 text-foreground">
                          {m.homeTeam}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                          style={{
                            background: "rgba(201,162,39,0.08)",
                            border: "1px solid rgba(201,162,39,0.15)",
                          }}
                        >
                          <span className="text-lg font-black text-foreground tabular-nums">
                            {pred.homeGoals}
                          </span>

                          <span className="text-xs text-muted-foreground/50 font-light">
                            ×
                          </span>

                          <span className="text-lg font-black text-foreground tabular-nums">
                            {pred.awayGoals}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                        <img
                          src={m.awayLogo ?? ""}
                          alt={m.awayTeam}
                          className="w-9 h-9 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />

                        <span className="text-xs font-semibold text-center leading-tight line-clamp-2 text-foreground">
                          {m.awayTeam}
                        </span>
                      </div>

                      {isOpen ? (
                        <button
                          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                          style={{
                            background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.15)",
                          }}
                          onClick={(e) => handleDelete(pred.id, e)}
                          disabled={isDeleting}
                          title="Excluir palpite"
                        >
                          <Trash2
                            className={`w-4 h-4 text-red-400 ${
                              isDeleting ? "animate-pulse" : ""
                            }`}
                          />
                        </button>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      )}
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