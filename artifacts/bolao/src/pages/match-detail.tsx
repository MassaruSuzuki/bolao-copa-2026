import { useParams, useLocation } from "wouter";
import { useGetMatch, getGetMatchQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Lock, Users } from "lucide-react";
import { useState } from "react";
import { useUpsertPrediction, getGetMatchQueryKey as getMatchKey, getListMyPredictionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

function calcPoints(predHome: number, predAway: number, realHome: number, realAway: number): number {
  if (predHome === realHome && predAway === realAway) return 5;
  const predWinner = predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";
  const realWinner = realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";
  if (predWinner === realWinner) return 3;
  return 0;
}

function MedalIcon({ position }: { position: number }) {
  if (position === 1) return <span className="text-base">🥇</span>;
  if (position === 2) return <span className="text-base">🥈</span>;
  if (position === 3) return <span className="text-base">🥉</span>;
  return <span className="w-5 h-5 flex items-center justify-center text-xs text-muted-foreground font-bold">{position}</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">Ao Vivo</Badge>;
  if (status === "finished") return <Badge variant="secondary">Encerrado</Badge>;
  return <Badge className="bg-primary/20 text-primary border-primary/30">Em Breve</Badge>;
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const matchId = parseInt(params.id ?? "0", 10);

  const { data: match, isLoading } = useGetMatch(matchId, {
    query: { enabled: !!matchId, queryKey: getGetMatchQueryKey(matchId) },
  });

  const myPred = match?.predictions?.find((p) => p.user.id === user?.id);

  const [homeGoals, setHomeGoals] = useState<string>(myPred?.homeGoals?.toString() ?? "");
  const [awayGoals, setAwayGoals] = useState<string>(myPred?.awayGoals?.toString() ?? "");

  const upsertMutation = useUpsertPrediction();

  const isLocked = !match || match.status !== "upcoming" || differenceInMinutes(new Date(match.matchDate), new Date()) <= 60;

  const handleSubmit = () => {
    const h = parseInt(homeGoals, 10);
    const a = parseInt(awayGoals, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast({ title: "Valores inválidos", description: "Insira gols válidos (0 ou mais)", variant: "destructive" });
      return;
    }
    upsertMutation.mutate(
      { data: { matchId, homeGoals: h, awayGoals: a } },
      {
        onSuccess: () => {
          toast({ title: "Palpite salvo!", description: `${match?.homeTeam} ${h} x ${a} ${match?.awayTeam}` });
          qc.invalidateQueries({ queryKey: getMatchKey(matchId) });
          qc.invalidateQueries({ queryKey: getListMyPredictionsQueryKey() });
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Erro ao salvar palpite";
          toast({ title: "Erro", description: message, variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!match) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">Jogo não encontrado.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-2xl">
        <button
          onClick={() => setLocation("/matches")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos jogos
        </button>

        {/* Match Hero */}
        <div className="bg-card border border-card-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <StatusBadge status={match.status} />
            <span className="text-xs text-muted-foreground">
              {format(new Date(match.matchDate), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
            </span>
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex flex-col items-center gap-2 flex-1">
              <img
                src={match.homeLogo ?? ""}
                alt={match.homeTeam}
                className="w-16 h-16 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <p className="font-bold text-foreground text-center">{match.homeTeam}</p>
            </div>

            <div className="flex flex-col items-center">
              {(match.status === "live" || match.status === "finished") ? (
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-foreground tabular-nums">{match.homeScore}</span>
                  <span className="text-2xl text-muted-foreground">x</span>
                  <span className="text-4xl font-black text-foreground tabular-nums">{match.awayScore}</span>
                </div>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">vs</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <img
                src={match.awayLogo ?? ""}
                alt={match.awayTeam}
                className="w-16 h-16 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <p className="font-bold text-foreground text-center">{match.awayTeam}</p>
            </div>
          </div>
        </div>

        {/* My Prediction Form */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Meu Palpite</h2>
            {isLocked && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
                {match.status === "live" ? "Jogo em andamento" : match.status === "finished" ? "Jogo encerrado" : "Prazo encerrado"}
              </div>
            )}
          </div>

          {isLocked ? (
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{match.homeTeam}</p>
                <div className="w-16 h-14 bg-muted/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{myPred?.homeGoals ?? "-"}</span>
                </div>
              </div>
              <span className="text-muted-foreground text-xl">x</span>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{match.awayTeam}</p>
                <div className="w-16 h-14 bg-muted/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{myPred?.awayGoals ?? "-"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">{match.homeTeam}</p>
                  <Input
                    type="number"
                    min="0"
                    max="99"
                    className="w-16 text-center text-xl font-bold h-14"
                    value={homeGoals}
                    onChange={(e) => setHomeGoals(e.target.value)}
                    data-testid="input-home-goals"
                  />
                </div>
                <span className="text-muted-foreground text-xl mt-5">x</span>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">{match.awayTeam}</p>
                  <Input
                    type="number"
                    min="0"
                    max="99"
                    className="w-16 text-center text-xl font-bold h-14"
                    value={awayGoals}
                    onChange={(e) => setAwayGoals(e.target.value)}
                    data-testid="input-away-goals"
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={upsertMutation.isPending}
                data-testid="button-save-prediction"
              >
                {upsertMutation.isPending ? "Salvando..." : myPred ? "Atualizar Palpite" : "Salvar Palpite"}
              </Button>
            </div>
          )}
        </div>

        {/* All Predictions — only visible when finished */}
        {match.status === "finished" && (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">Palpites dos Participantes</h2>
              <span className="ml-auto text-xs text-muted-foreground">{match.predictions?.length ?? 0} palpites</span>
            </div>
            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {(() => {
                  const sorted = [...(match.predictions ?? [])].map((p) => ({
                    ...p,
                    pts: calcPoints(p.homeGoals, p.awayGoals, match.homeScore!, match.awayScore!),
                  })).sort((a, b) => b.pts - a.pts);

                  return sorted.map((p, idx) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.06, layout: { duration: 0.4 } }}
                      className="px-5 py-3 flex items-center gap-3"
                      data-testid={`prediction-row-${p.userId}`}
                    >
                      <div className="w-6 flex items-center justify-center flex-shrink-0">
                        <MedalIcon position={idx + 1} />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{p.user.name.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">{p.user.name}</span>
                          {p.user.id === user?.id && (
                            <span className="text-xs text-primary">(você)</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Palpite: {p.homeGoals} × {p.awayGoals}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-lg font-black tabular-nums ${p.pts === 5 ? "text-primary" : p.pts === 3 ? "text-foreground" : "text-muted-foreground"}`}>
                          {p.pts}
                        </span>
                        <span className="text-xs text-muted-foreground ml-0.5">pts</span>
                      </div>
                    </motion.div>
                  ));
                })()}
              </AnimatePresence>
              {!match.predictions?.length && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nenhum palpite registrado.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
