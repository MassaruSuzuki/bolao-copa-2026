import { useState } from "react";
import {
  useListMatches,
  getListMatchesQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInMinutes, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "lucide-react";
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

function DeadlineLabel({
  matchDate,
  status,
}: {
  matchDate: string;
  status: string;
}) {
  if (status !== "upcoming") return null;

  const minsLeft = differenceInMinutes(new Date(matchDate), new Date());

  if (minsLeft <= 60) {
    return (
      <span className="text-[10px] text-red-400 font-semibold">
        Prazo encerrado
      </span>
    );
  }

  if (minsLeft <= 120) {
    return (
      <span className="text-[10px] text-yellow-400 font-semibold">
        Palpite encerra em {minsLeft - 60}min
      </span>
    );
  }

  return null;
}

export default function MatchesPage() {
  const [filter, setFilter] = useState<MatchStatus | "all">("all");

  const apiFilter = filter === "all" ? undefined : { status: filter };

  const { data: rawMatches, isLoading } = useListMatches(apiFilter, {
    query: {
      queryKey: getListMatchesQueryKey(apiFilter),
    },
  });

  const matches =
    filter === "all"
      ? rawMatches?.filter((match) => match.status === "upcoming")
      : rawMatches;

  const filters: { label: string; value: MatchStatus | "all" }[] = [
    { label: "Todos", value: "all" },
    { label: "Em Breve", value: "upcoming" },
    { label: "Ao Vivo", value: "live" },
    { label: "Encerrados", value: "finished" },
  ];

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
            {matches?.map((m) => {
              const hasScore = m.status === "live" || m.status === "finished";

              return (
                <Link key={m.id} href={`/matches/${m.id}`}>
                  <div
                    className="bg-card border border-card-border rounded-2xl p-4 hover:bg-muted/20 active:scale-[0.99] cursor-pointer transition-all"
                    data-testid={`match-card-${m.id}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <StatusBadge status={m.status} matchDate={m.matchDate} />

                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {format(new Date(m.matchDate), "dd MMM • HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
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
                        ) : (
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
                        )}

                        <DeadlineLabel
                          matchDate={m.matchDate}
                          status={m.status}
                        />
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

            {!matches?.length && (
              <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
                <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum jogo encontrado</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}