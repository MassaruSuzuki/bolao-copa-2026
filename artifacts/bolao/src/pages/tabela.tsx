import { useRef, useLayoutEffect, useEffect, useMemo } from "react";
import {
  useGetRanking,
  getGetRankingQueryKey,
  useListMatches,
  getListMatchesQueryKey,
} from "@workspace/api-client-react";
import { Layout, UserAvatar } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Trophy, Minus } from "lucide-react";

const COLS = "2rem 1fr 2.5rem 2.5rem 2.5rem 5rem";

const FLAG: Record<string, string> = {
  Brasil: "🇧🇷",
  Argentina: "🇦🇷",
  França: "🇫🇷",
  Alemanha: "🇩🇪",
  Espanha: "🇪🇸",
  Inglaterra: "🏴",
  Portugal: "🇵🇹",
  Itália: "🇮🇹",
  Holanda: "🇳🇱",
  Bélgica: "🇧🇪",
  Uruguai: "🇺🇾",
  Colômbia: "🇨🇴",
  México: "🇲🇽",
  EUA: "🇺🇸",
  Japão: "🇯🇵",
};

function flag(team: string) {
  return FLAG[team] ?? "🏳️";
}

function PositionBar({
  isLeader,
  isLast,
}: {
  isLeader: boolean;
  isLast: boolean;
}) {
  if (isLeader) {
    return (
      <div className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-yellow-400" />
    );
  }

  if (isLast) {
    return (
      <div className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-red-500/70" />
    );
  }

  return null;
}

function PositionBadge({
  position,
  isLeader,
}: {
  position: number;
  isLeader: boolean;
}) {
  if (isLeader) {
    return <span className="text-lg leading-none">👑</span>;
  }

  return <span className="text-muted-foreground">{position}</span>;
}

export default function TabelaPage() {
  const { user } = useAuth();

  const { data: ranking, isLoading } = useGetRanking({
    query: {
      queryKey: getGetRankingQueryKey(),
      refetchInterval: 10_000,
    },
  });

  const { data: finishedMatches } = useListMatches(
    { status: "finished" },
    {
      query: {
        queryKey: getListMatchesQueryKey({ status: "finished" }),
        refetchInterval: 10_000,
      },
    }
  );

  useListMatches(
    { status: "live" },
    {
      query: {
        queryKey: getListMatchesQueryKey({ status: "live" }),
        refetchInterval: 10_000,
      },
    }
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  const todayMatches = (finishedMatches ?? []).filter(
    (m) => m.matchDate.slice(0, 10) === todayStr
  );

  const sortedRanking = useMemo(() => {
    const sorted = [...(ranking ?? [])].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }

      return a.name.localeCompare(b.name, "pt-BR");
    });

    let lastPoints: number | null = null;
    let currentPosition = 0;

    return sorted.map((entry) => {
      if (entry.totalPoints !== lastPoints) {
        currentPosition += 1;
        lastPoints = entry.totalPoints;
      }

      return {
        ...entry,
        position: currentPosition,
      };
    });
  }, [ranking]);

  const lastPosition = sortedRanking.length
    ? sortedRanking[sortedRanking.length - 1].position
    : 0;

  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevPositions = useRef<Map<number, number>>(new Map());

  const recordPositions = () => {
    prevPositions.current.clear();

    nodeRefs.current.forEach((node, userId) => {
      if (node) {
        prevPositions.current.set(userId, node.getBoundingClientRect().top);
      }
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

        node.style.transition =
          "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)";
        node.style.transform = "translateY(0)";
      }
    });
  }, [sortedRanking]);

  useEffect(() => {
    recordPositions();
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Tabela do Bolão
          </h1>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500/20 text-sm">
              👑
            </div>
            <span>Líder do Bolão</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500/50" />
            <span>Lanterna</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-1">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : sortedRanking.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl px-5 py-12 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />

            <p className="text-muted-foreground">Nenhuma pontuação ainda</p>

            <p className="text-sm text-muted-foreground/70 mt-1">
              Os dados aparecem quando os jogos encerrarem.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {todayMatches.length > 0 && (
              <div
                className="grid items-center px-4 pt-2 pb-0 gap-x-3 bg-muted/20"
                style={{ gridTemplateColumns: COLS }}
              >
                <div />
                <div />

                <div className="col-span-4 flex items-center justify-center gap-3 pb-1 border-b border-border/40">
                  {todayMatches.map((m) => (
                    <span
                      key={m.id}
                      className="flex items-center gap-1 text-sm leading-none"
                      title={`${m.homeTeam} × ${m.awayTeam}`}
                    >
                      <span>{flag(m.homeTeam)}</span>
                      <span className="text-muted-foreground/50 text-xs font-bold">
                        ×
                      </span>
                      <span>{flag(m.awayTeam)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div
              className="grid items-center border-b border-border px-4 py-2.5 bg-muted/30 gap-x-3"
              style={{ gridTemplateColumns: COLS }}
            >
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide text-center">
                #
              </span>

              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Participante
              </span>

              <span
                className="text-xs font-bold text-yellow-400 uppercase tracking-wide text-center"
                title="Placar exato"
              >
                AC
              </span>

              <span
                className="text-xs font-bold text-primary uppercase tracking-wide text-center"
                title="Vencedor ou empate"
              >
                V
              </span>

              <span
                className="text-xs font-bold text-red-400/80 uppercase tracking-wide text-center"
                title="Errou"
              >
                E
              </span>

              <span className="text-xs font-bold text-foreground uppercase tracking-wide text-center">
                PTS
              </span>
            </div>

            <div className="relative">
              {sortedRanking.map((entry) => {
                const position = entry.position;
                const isMe = entry.userId === user?.id;
                const isLeader = position === 1;
                const isLast = position === lastPosition && !isLeader;

                const erros =
                  entry.totalPredictions -
                  entry.exactScores -
                  entry.correctResults;

                return (
                  <div
                    key={entry.userId}
                    ref={(el) => {
                      if (el) {
                        nodeRefs.current.set(entry.userId, el);
                      } else {
                        nodeRefs.current.delete(entry.userId);
                      }
                    }}
                    className={cn(
                      "relative grid items-center px-4 py-3 border-b border-border last:border-0 will-change-transform gap-x-3",
                      isLeader && "bg-yellow-500/5",
                      isMe ? "bg-primary/5" : "hover:bg-white/[0.02]"
                    )}
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <PositionBar isLeader={isLeader} isLast={isLast} />

                    <div className="text-sm font-semibold text-center tabular-nums">
                      <PositionBadge position={position} isLeader={isLeader} />
                    </div>

                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        name={entry.name}
                        avatarUrl={
                          (entry as { avatarUrl?: string | null }).avatarUrl
                        }
                        size={7}
                        textSize="xs"
                      />

                      <p
                        className={cn(
                          "text-sm font-semibold truncate",
                          isLeader && "text-yellow-400",
                          isMe && !isLeader ? "text-primary" : "text-foreground"
                        )}
                      >
                        {entry.name}

                        {isMe && (
                          <span className="text-xs ml-1.5 text-primary/60 font-normal">
                            (você)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="text-center">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          entry.exactScores > 0
                            ? "text-yellow-400"
                            : "text-muted-foreground/50"
                        )}
                      >
                        {entry.exactScores}
                      </span>
                    </div>

                    <div className="text-center">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          entry.correctResults > 0
                            ? "text-primary"
                            : "text-muted-foreground/50"
                        )}
                      >
                        {entry.correctResults}
                      </span>
                    </div>

                    <div className="text-center">
                      {erros > 0 ? (
                        <span className="text-sm tabular-nums text-red-400/80">
                          {erros}
                        </span>
                      ) : (
                        <Minus className="w-3 h-3 mx-auto text-muted-foreground/30" />
                      )}
                    </div>

                    <div className="flex items-center justify-center">
                      <span
                        className={cn(
                          "text-base font-black tabular-nums",
                          isLeader
                            ? "text-yellow-400"
                            : isMe
                              ? "text-primary"
                              : "text-foreground"
                        )}
                      >
                        {entry.totalPoints}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground/60">
          <span>
            <strong className="text-yellow-400">AC</strong> = Placar exato
          </span>

          <span>
            <strong className="text-primary">V</strong> = Acertou vencedor ou
            empate
          </span>

          <span>
            <strong className="text-red-400/80">E</strong> = Errou
          </span>

          <span>
            <strong className="text-foreground">PTS</strong> = Pontuação total
          </span>
        </div>
      </div>
    </Layout>
  );
}