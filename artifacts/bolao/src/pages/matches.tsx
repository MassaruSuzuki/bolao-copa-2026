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
      <Badge className="h-5 rounded-full bg-red-500/20 px-2 text-[10px] font-black uppercase text-red-400 border-red-500/30 animate-pulse">
        ● Ao Vivo
      </Badge>
    );
  }

  if (status === "finished") {
    return (
      <Badge
        variant="secondary"
        className="h-5 rounded-full px-2 text-[10px] font-black uppercase"
      >
        Encerrado
      </Badge>
    );
  }

  if (matchIsToday) {
    return (
      <Badge className="h-5 rounded-full bg-blue-500/20 px-2 text-[10px] font-black uppercase text-blue-400 border-blue-500/30">
        Hoje
      </Badge>
    );
  }

  return (
    <Badge className="h-5 rounded-full bg-primary/20 px-2 text-[10px] font-black uppercase text-primary border-primary/30">
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

function DeadlineBadge({
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
      <div className="inline-flex h-5 items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2">
        <Clock3 className="h-3 w-3 text-red-400" />
        <span className="text-[10px] font-black uppercase text-red-400">
          Fechado
        </span>
      </div>
    );
  }

  if (minutesUntilMatch <= 120) {
    return (
      <div className="inline-flex h-5 items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2">
        <Clock3 className="h-3 w-3 text-yellow-400" />
        <span className="text-[10px] font-black uppercase text-yellow-300 tabular-nums">
          {formatDeadlineTime(minutesUntilDeadline)}
        </span>
      </div>
    );
  }

  return null;
}

function MatchLogo({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  return (
    <img
      src={src ?? ""}
      alt={alt}
      className="h-8 w-8 object-contain md:h-12 md:w-12"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
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
      <div className="w-full max-w-full overflow-hidden px-3 pt-3 pb-4 md:p-6 space-y-3 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Jogos
          </h1>

          <p className="mt-0.5 text-sm text-muted-foreground">
            Faça seus palpites antes do prazo
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          {filters.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              data-testid={`filter-${value}`}
              className={cn(
                "h-9 rounded-xl px-3 text-sm font-semibold transition-colors",
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
          <div className="space-y-2.5">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-[102px] rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {matches.map((m) => {
              const hasScore = m.status === "live" || m.status === "finished";

              return (
                <Link key={m.id} href={`/matches/${m.id}`}>
                  <div
                    className="w-full max-w-full overflow-hidden rounded-2xl border border-card-border bg-card p-3 transition-all hover:bg-muted/20 active:scale-[0.99] md:p-4"
                    data-testid={`match-card-${m.id}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <StatusBadge status={m.status} matchDate={m.matchDate} />
                      <DeadlineBadge matchDate={m.matchDate} status={m.status} />
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="flex min-w-0 flex-col items-center gap-1">
                        <MatchLogo src={m.homeLogo} alt={m.homeTeam} />

                        <span className="line-clamp-2 max-w-full text-center text-[12px] font-black leading-tight text-foreground md:text-sm">
                          {m.homeTeam}
                        </span>
                      </div>

                      <div className="flex min-w-[82px] flex-col items-center justify-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {format(new Date(m.matchDate), "dd MMM", {
                            locale: ptBR,
                          })}
                        </p>

                        {hasScore ? (
                          <div className="mt-1 rounded-xl bg-background/50 px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-black leading-none text-foreground tabular-nums md:text-3xl">
                                {m.homeScore}
                              </span>

                              <span className="text-sm font-bold text-muted-foreground/60">
                                ×
                              </span>

                              <span className="text-xl font-black leading-none text-foreground tabular-nums md:text-3xl">
                                {m.awayScore}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="mt-0.5 text-xl font-black leading-none text-foreground tabular-nums md:text-2xl">
                              {format(new Date(m.matchDate), "HH:mm")}
                            </p>

                            <div className="mt-2 rounded-lg bg-background/50 px-3 py-1">
                              <span className="text-xs font-black uppercase text-muted-foreground/60">
                                VS
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-col items-center gap-1">
                        <MatchLogo src={m.awayLogo} alt={m.awayTeam} />

                        <span className="line-clamp-2 max-w-full text-center text-[12px] font-black leading-tight text-foreground md:text-sm">
                          {m.awayTeam}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {!matches.length && (
              <div className="rounded-2xl border border-card-border bg-card p-8 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

                <p className="text-sm text-muted-foreground">
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
