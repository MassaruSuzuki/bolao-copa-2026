import { useParams, useLocation } from "wouter";
import {
  useGetMatch,
  getGetMatchQueryKey,
  useUpsertPrediction,
  getListMyPredictionsQueryKey,
} from "@workspace/api-client-react";
import { Layout, UserAvatar } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Lock, Users, LockOpen } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

type MatchWithUnlock = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  matchDate: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  predictionUnlocked?: boolean;
  predictions?: Array<{
    id: number;
    userId: number;
    matchId: number;
    homeGoals: number;
    awayGoals: number;
    createdAt: string;
    updatedAt: string;
    user: {
      id: number;
      name: string;
      email: string;
      isAdmin: boolean;
      createdAt: string;
      avatarUrl?: string | null;
    };
  }>;
};

function calcPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return 3;

  const predWinner =
    predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";

  const realWinner =
    realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";

  if (predWinner === realWinner) return 1;

  return 0;
}

function MedalIcon({ position }: { position: number }) {
  if (position === 1) return <span className="text-base">🥇</span>;
  if (position === 2) return <span className="text-base">🥈</span>;
  if (position === 3) return <span className="text-base">🥉</span>;

  return (
    <span className="w-5 h-5 flex items-center justify-center text-xs text-muted-foreground font-bold">
      {position}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
        Ao Vivo
      </Badge>
    );
  }

  if (status === "finished") {
    return <Badge variant="secondary">Encerrado</Badge>;
  }

  return (
    <Badge className="bg-primary/20 text-primary border-primary/30">
      Em Breve
    </Badge>
  );
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const matchId = parseInt(params.id ?? "0", 10);

  const { data: rawMatch, isLoading } = useGetMatch(matchId, {
    query: {
      enabled: !!matchId,
      queryKey: getGetMatchQueryKey(matchId),
    },
  });

  const match = rawMatch as MatchWithUnlock | undefined;

  const myPred = match?.predictions?.find((p) => p.user.id === user?.id);

  const [homeGoals, setHomeGoals] = useState<string>("");
  const [awayGoals, setAwayGoals] = useState<string>("");

  const upsertMutation = useUpsertPrediction();

  const deadlineReached = match
    ? differenceInMinutes(new Date(match.matchDate), new Date()) <= 60
    : true;

  const isUnlockedByAdmin = match?.predictionUnlocked === true;

  const isLocked =
    !match ||
    match.status !== "upcoming" ||
    (deadlineReached && !isUnlockedByAdmin);

  const alreadyHasPrediction = !!myPred;

  const canCreatePrediction = !isLocked && !alreadyHasPrediction;

  const handleSubmit = () => {
    const h = parseInt(homeGoals, 10);
    const a = parseInt(awayGoals, 10);

    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast({
        title: "Valores inválidos",
        description: "Insira gols válidos (0 ou mais)",
        variant: "destructive",
      });
      return;
    }

    upsertMutation.mutate(
      {
        data: {
          matchId,
          homeGoals: h,
          awayGoals: a,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Palpite salvo!",
            description: `${match?.homeTeam} ${h} x ${a} ${match?.awayTeam}`,
          });

          qc.invalidateQueries({
            queryKey: getGetMatchQueryKey(matchId),
          });

          qc.invalidateQueries({
            queryKey: getListMyPredictionsQueryKey(),
          });

          setHomeGoals("");
          setAwayGoals("");
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Erro ao salvar palpite";

          toast({
            title: "Erro",
            description: message,
            variant: "destructive",
          });
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
        <div className="p-6 text-center text-muted-foreground">
          Jogo não encontrado.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <button
          onClick={() => setLocation("/matches")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar aos jogos
        </button>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={match.status} />

              {isUnlockedByAdmin && match.status === "upcoming" && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                  <LockOpen className="w-3 h-3" />
                  Palpites liberados
                </Badge>
              )}
            </div>

            <span className="text-xs text-muted-foreground">
              {format(new Date(match.matchDate), "dd 'de' MMMM, HH:mm", {
                locale: ptBR,
              })}
            </span>
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex flex-col items-center gap-2 flex-1">
              <img
                src={match.homeLogo ?? ""}
                alt={match.homeTeam}
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />

              <p className="font-bold text-foreground text-center">
                {match.homeTeam}
              </p>
            </div>

            <div className="flex flex-col items-center">
              {match.status === "live" || match.status === "finished" ? (
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-foreground tabular-nums">
                    {match.homeScore}
                  </span>

                  <span className="text-2xl text-muted-foreground">x</span>

                  <span className="text-4xl font-black text-foreground tabular-nums">
                    {match.awayScore}
                  </span>
                </div>
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">
                  vs
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
              <img
                src={match.awayLogo ?? ""}
                alt={match.awayTeam}
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />

              <p className="font-bold text-foreground text-center">
                {match.awayTeam}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="font-semibold text-foreground">Meu Palpite</h2>

            {isLocked && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
                {match.status === "live"
                  ? "Jogo em andamento"
                  : match.status === "finished"
                    ? "Jogo encerrado"
                    : "Prazo encerrado"}
              </div>
            )}

            {!isLocked && deadlineReached && isUnlockedByAdmin && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <LockOpen className="w-3.5 h-3.5" />
                Liberado pelo admin
              </div>
            )}
          </div>

          {alreadyHasPrediction ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {match.homeTeam}
                  </p>

                  <div className="w-16 h-14 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">
                      {myPred.homeGoals}
                    </span>
                  </div>
                </div>

                <span className="text-muted-foreground text-xl">×</span>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {match.awayTeam}
                  </p>

                  <div className="w-16 h-14 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">
                      {myPred.awayGoals}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Você já registrou seu palpite para esta partida.
              </p>
            </div>
          ) : isLocked ? (
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {match.homeTeam}
                </p>

                <div className="w-16 h-14 bg-muted/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">-</span>
                </div>
              </div>

              <span className="text-muted-foreground text-xl">×</span>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {match.awayTeam}
                </p>

                <div className="w-16 h-14 bg-muted/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">-</span>
                </div>
              </div>
            </div>
          ) : canCreatePrediction ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    {match.homeTeam}
                  </p>

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

                <span className="text-muted-foreground text-xl mt-5">×</span>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    {match.awayTeam}
                  </p>

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
                {upsertMutation.isPending ? "Salvando..." : "Salvar Palpite"}
              </Button>
            </div>
          ) : null}
        </div>

        {match.status === "finished" && (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />

              <h2 className="font-semibold text-foreground text-sm">
                Palpites dos Participantes
              </h2>

              <span className="ml-auto text-xs text-muted-foreground">
                {match.predictions?.length ?? 0} palpites
              </span>
            </div>

            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {(() => {
                  const sorted = [...(match.predictions ?? [])]
                    .map((p) => ({
                      ...p,
                      pts: calcPoints(
                        p.homeGoals,
                        p.awayGoals,
                        match.homeScore ?? 0,
                        match.awayScore ?? 0
                      ),
                    }))
                    .sort((a, b) => b.pts - a.pts);

                  return sorted.map((p, idx) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: idx * 0.06,
                        layout: { duration: 0.4 },
                      }}
                      className="px-5 py-3 flex items-center gap-3"
                      data-testid={`prediction-row-${p.userId}`}
                    >
                      <div className="w-6 flex items-center justify-center flex-shrink-0">
                        <MedalIcon position={idx + 1} />
                      </div>

                      <UserAvatar
                        name={p.user.name}
                        avatarUrl={p.user.avatarUrl}
                        size={8}
                        textSize="xs"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">
                            {p.user.name}
                          </span>

                          {p.user.id === user?.id && (
                            <span className="text-xs text-primary">(você)</span>
                          )}
                        </div>

                        <span className="text-sm font-bold text-muted-foreground tabular-nums">
                          {p.homeGoals} × {p.awayGoals}
                        </span>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span
                          className={`text-lg font-black tabular-nums ${
                            p.pts === 5
                              ? "text-primary"
                              : p.pts === 3
                                ? "text-foreground"
                                : "text-muted-foreground"
                          }`}
                        >
                          {p.pts}
                        </span>

                        <span className="text-xs text-muted-foreground ml-0.5">
                          pts
                        </span>
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