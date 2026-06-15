import { useMemo, useState } from "react";
import {
  useListMatches,
  getListMatchesQueryKey,
  useListMyPredictions,
  getListMyPredictionsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInMinutes, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

type MatchStatus = "upcoming" | "live" | "finished";

function StatusBadge({
  status,
  matchDate,
}: {
  status: string;
  matchDate: string;
}) {
  const matchIsToday = isToday(new Date(matchDate));

  if (status === "live") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse text-[10px] px-1.5 py-0">
        ● AO VIVO
      </Badge>
    );
  }

  if (status === "finished") {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        Encerrado
      </Badge>
    );
  }

  if (matchIsToday) {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
        Hoje
      </Badge>
    );
  }

  return (
    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
      Em Breve
    </Badge>
  );
}

function formatDeadlineTime(minutes: number) {
  if (minutes <= 0) return "0min";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h`;

  return `${mins}min`;
}

function DeadlineLabel({
  matchDate,
  status,
}: {
  matchDate: string;
  status: string;
}) {
  if (status !== "upcoming") return null;

  const minutesUntilMatch = differenceInMinutes(new Date(matchDate), new Date());
  const minutesUntilDeadline = minutesUntilMatch - 60;

  if (minutesUntilDeadline <= 0) {
    return (
      <div className="mb-3 flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5">
        <Clock3 className="h-3.5 w-3.5 text-red-400" />
        <span className="text-[11px] md:text-xs font-bold text-red-400 whitespace-nowrap">
          Prazo encerrado
        </span>
      </div>
    );
  }

  if (minutesUntilMatch <= 120) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3.5 py-1.5 shadow-[0_0_18px_rgba(250,204,21,0.12)]">
        <Clock3 className="h-3.5 w-3.5 text-yellow-400" />

        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="hidden md:inline text-[11px] font-bold uppercase tracking-wide text-yellow-400/80">
            Palpite fecha em
          </span>

          <span className="text-sm md:text-base font-black text-yellow-300 tabular-nums leading-none">
            {formatDeadlineTime(minutesUntilDeadline)}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export default function MatchesPage() {
  const [filter, setFilter] = useState<MatchStatus | "all">("all");

  const apiFilter = filter === "all" ? undefined : { status: filter };

  const { data: rawMatches, isLoading: loadingMatches } = useListMatches(
    apiFilter,
    {
      query: {
        queryKey: getListMatchesQueryKey(apiFilter),
        refetchInterval: 10_000,
      },
    }
  );

  const { data: myPredictions, isLoading: loadingPredictions } =
    useListMyPredictions({
      query: {
        queryKey: getListMyPredictionsQueryKey(),
        refetchInterval: 10_000,
      },
    });

  const predictedMatchIds = useMemo(() => {
    return new Set(
      (myPredictions ?? []).map((prediction) => prediction.matchId)
    );
  }, [myPredictions]);

  const matches = useMemo(() => {
    const baseMatches =
      filter === "all"
        ? (rawMatches ?? []).filter((match) => match.status === "upcoming")
        : rawMatches ?? [];

    return baseMatches.filter((match) => {
      if (match.status === "finished") return true;

      return !predictedMatchIds.has(match.id);
    });
  }, [filter, rawMatches, predictedMatchIds]);

  const filters: { label: string; value: MatchStatus | "all" }[] = [
    { label: "Todos", value: "all" },
    { label: "Em Breve", value: "upcoming" },
    { label: "Ao Vivo", value: "live" },
    { label: "Encerrados", value: "finished" },
  ];

  const isLoading = loadingMatches || loadingPredictions;

  return (
    <Layout>
      <div className="px-4 pt-4 pb-4 md:p-6 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Jogos
          </h1>

          <p className="text-muted-foreground text-sm mt-0.5">
            Faça seus palpites antes do prazo
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-none">
          {filters.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              data-testid={`filter-${value}`}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {matches.map((m) => {
              const hasScore = m.status === "live" || m.status === "finished";

              return (
                <Link key={m.id} href={`/matches/${m.id}`}>
                  <div
                    className="bg-card border border-card-border rounded-2xl p-4 hover:bg-muted/20 active:scale-[0.99] cursor-pointer transition-all"
                    data-testid={`match-card-${m.id}`}
                  >
                    <div className="flex items-center justify-start mb-3">
                      <StatusBadge status={m.status} matchDate={m.matchDate} />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <img
                          src={m.homeLogo ?? ""}
                          alt={m.homeTeam}
                          className="w-10 h-10 md:w-12 md:h-12 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />

                        <span className="text-xs md:text-sm font-semibold text-foreground text-center leading-tight line-clamp-2">
                          {m.homeTeam}
                        </span>
                      </div>

                      <div className="flex-shrink-0 flex flex-col items-center justify-center px-2">
                        {hasScore ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="text-center">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {format(new Date(m.matchDate), "dd MMM", {
                                  locale: ptBR,
                                })}
                              </p>

                              <p className="mt-0.5 text-base md:text-lg font-black text-foreground tabular-nums leading-none">
                                {format(new Date(m.matchDate), "HH:mm")}
                              </p>
                            </div>

                            <div
                              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                              style={{
                                background: "rgba(255,255,255,0.05)",
                              }}
                            >
                              <span className="text-2xl md:text-3xl font-black text-foreground tabular-nums">
                                {m.homeScore}
                              </span>

                              <span className="text-base text-muted-foreground/60 font-light">
                                ×
                              </span>

                              <span className="text-2xl md:text-3xl font-black text-foreground tabular-nums">
                                {m.awayScore}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <DeadlineLabel
                              matchDate={m.matchDate}
                              status={m.status}
                            />

                            <div className="text-center">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {format(new Date(m.matchDate), "dd MMM", {
                                  locale: ptBR,
                                })}
                              </p>

                              <p className="mt-0.5 text-xl md:text-2xl font-black text-foreground tabular-nums leading-none">
                                {format(new Date(m.matchDate), "HH:mm")}
                              </p>
                            </div>

                            <div
                              className="px-4 py-1.5 rounded-xl"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                              }}
                            >
                              <span className="text-sm font-bold text-muted-foreground/60">
                                VS
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <img
                          src={m.awayLogo ?? ""}
                          alt={m.awayTeam}
                          className="w-10 h-10 md:w-12 md:h-12 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />

                        <span className="text-xs md:text-sm font-semibold text-foreground text-center leading-tight line-clamp-2">
                          {m.awayTeam}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {!matches.length && (
              <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
                <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />

                <p className="text-muted-foreground">
                  Nenhum jogo disponível para palpite
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}