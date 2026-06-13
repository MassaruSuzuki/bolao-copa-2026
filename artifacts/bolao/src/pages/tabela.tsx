import { useRef, useLayoutEffect, useEffect, useMemo, useState } from "react";
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

const COLS = "2rem 1fr 9.5rem 2.5rem 2.5rem 2.5rem 5rem";

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
  USA: "🇺🇸",
  Japão: "🇯🇵",
  Paraguay: "🇵🇾",
  Paraguai: "🇵🇾",
};

function flag(team: string) {
  return FLAG[team] ?? "🏳️";
}

function teamCode(team: string) {
  return team
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 3)
    .toUpperCase();
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

  if (position === 2) return <span className="text-lg leading-none">🥈</span>;
  if (position === 3) return <span className="text-lg leading-none">🥉</span>;

  return <span className="text-muted-foreground">{position}</span>;
}

function TodayCube({
  items,
}: {
  items: {
    label: string;
    points: number;
  }[];
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) {
    return <Minus className="w-3 h-3 mx-auto text-muted-foreground/25" />;
  }

  const item = items[index];

  return (
    <div className="flex justify-center [perspective:700px]">
      <span
        key={`${item.label}-${item.points}-${index}`}
        className="inline-flex animate-[cubeFlip_650ms_ease-in-out] items-center justify-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-black leading-none whitespace-nowrap [transform-origin:center_center]"
      >
        <span className="text-muted-foreground">{item.label}</span>
        <span className="text-emerald-400">▲</span>
        <span className="text-emerald-400 tabular-nums">{item.points}</span>
      </span>
    </div>
  );
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

  const { data: liveMatches } = useListMatches(
    { status: "live" },
    {
      query: {
        queryKey: getListMatchesQueryKey({ status: "live" }),
        refetchInterval: 10_000,
      },
    }
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const hasLiveMatch = (liveMatches ?? []).length > 0;

  const todayMatches = useMemo(() => {
    return [...(finishedMatches ?? [])]
      .filter((m) => m.matchDate.slice(0, 10) === todayStr)
      .sort(
        (a, b) =>
          new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
      );
  }, [finishedMatches, todayStr]);

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
      <style>
        {`
          @keyframes cubeFlip {
            0% {
              transform: rotateX(-90deg) translateY(8px);
              opacity: 0;
            }

            55% {
              transform: rotateX(12deg) translateY(0);
              opacity: 1;
            }

            100% {
              transform: rotateX(0deg) translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>

      <div className="p-4 md:p-6 space-y-6">
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
              <Skeleton key={i} className="h-24 md:h-14 rounded-xl" />
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
          <>
            <div className="hidden md:block bg-card border border-card-border rounded-xl overflow-hidden">
              {!hasLiveMatch && todayMatches.length > 0 && (
                <div
                  className="grid items-center px-4 pt-2 pb-0 gap-x-3 bg-muted/20"
                  style={{ gridTemplateColumns: COLS }}
                >
                  <div />
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
                  className="text-xs font-bold text-muted-foreground uppercase tracking-wide text-center"
                  title="Pontuação conquistada hoje"
                >
                  Hoje
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

                  const todayGain =
                    (entry as { todayGain?: number }).todayGain ?? 0;

                  const todayItems =
                    !hasLiveMatch && todayGain > 0
                      ? todayMatches.map((match) => ({
                          label: `(${teamCode(match.homeTeam)} x ${teamCode(
                            match.awayTeam
                          )})`,
                          points: todayGain,
                        }))
                      : [];

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
                            isMe && !isLeader
                              ? "text-primary"
                              : "text-foreground"
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
                        <TodayCube items={todayItems} />
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

            <div className="md:hidden space-y-3">
              {sortedRanking.map((entry) => {
                const position = entry.position;
                const isMe = entry.userId === user?.id;
                const isLeader = position === 1;
                const isLast = position === lastPosition && !isLeader;

                const erros =
                  entry.totalPredictions -
                  entry.exactScores -
                  entry.correctResults;

                const todayGain =
                  (entry as { todayGain?: number }).todayGain ?? 0;

                const todayItems =
                  !hasLiveMatch && todayGain > 0
                    ? todayMatches.map((match) => ({
                        label: `(${teamCode(match.homeTeam)} x ${teamCode(
                          match.awayTeam
                        )})`,
                        points: todayGain,
                      }))
                    : [];

                return (
                  <div
                    key={entry.userId}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border bg-card p-4",
                      isLeader
                        ? "border-yellow-500/35 bg-yellow-500/5"
                        : isLast
                          ? "border-red-500/25"
                          : "border-card-border",
                      isMe && !isLeader && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <PositionBar isLeader={isLeader} isLast={isLast} />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-black">
                          <PositionBadge
                            position={position}
                            isLeader={isLeader}
                          />
                        </div>

                        <UserAvatar
                          name={entry.name}
                          avatarUrl={
                            (entry as { avatarUrl?: string | null }).avatarUrl
                          }
                          size={9}
                          textSize="sm"
                        />

                        <div className="min-w-0">
                          <p
                            className={cn(
                              "truncate text-sm font-black",
                              isLeader && "text-yellow-400",
                              isMe && !isLeader
                                ? "text-primary"
                                : "text-foreground"
                            )}
                          >
                            {entry.name}
                            {isMe && (
                              <span className="ml-1 text-xs font-normal text-primary/70">
                                (você)
                              </span>
                            )}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {isLeader
                              ? "Líder do Bolão"
                              : isLast
                                ? "Lanterna"
                                : `${position}º colocado`}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-2xl font-black tabular-nums leading-none",
                            isLeader
                              ? "text-yellow-400"
                              : isMe
                                ? "text-primary"
                                : "text-foreground"
                          )}
                        >
                          {entry.totalPoints}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">
                          pts
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          Hoje
                        </span>

                        <TodayCube items={todayItems} />
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-lg bg-background/50 px-2 py-2">
                          <p className="text-[10px] font-bold uppercase text-yellow-400">
                            AC
                          </p>
                          <p className="mt-1 text-base font-black tabular-nums text-yellow-400">
                            {entry.exactScores}
                          </p>
                        </div>

                        <div className="rounded-lg bg-background/50 px-2 py-2">
                          <p className="text-[10px] font-bold uppercase text-primary">
                            V
                          </p>
                          <p className="mt-1 text-base font-black tabular-nums text-primary">
                            {entry.correctResults}
                          </p>
                        </div>

                        <div className="rounded-lg bg-background/50 px-2 py-2">
                          <p className="text-[10px] font-bold uppercase text-red-400/80">
                            E
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-base font-black tabular-nums",
                              erros > 0
                                ? "text-red-400/80"
                                : "text-muted-foreground/40"
                            )}
                          >
                            {erros}
                          </p>
                        </div>

                        <div className="rounded-lg bg-background/50 px-2 py-2">
                          <p className="text-[10px] font-bold uppercase text-foreground">
                            PTS
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-base font-black tabular-nums",
                              isLeader
                                ? "text-yellow-400"
                                : isMe
                                  ? "text-primary"
                                  : "text-foreground"
                            )}
                          >
                            {entry.totalPoints}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground/60">
          <span>
            <strong className="text-muted-foreground">Hoje</strong> = Pontos
            conquistados nos jogos encerrados hoje
          </span>

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