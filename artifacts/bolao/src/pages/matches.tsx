import { useState } from "react";
import { useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type MatchStatus = "upcoming" | "live" | "finished";

function StatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">Ao Vivo</Badge>;
  if (status === "finished") return <Badge variant="secondary">Encerrado</Badge>;
  return <Badge className="bg-primary/20 text-primary border-primary/30">Em Breve</Badge>;
}

function DeadlineLabel({ matchDate, status }: { matchDate: string; status: string }) {
  if (status !== "upcoming") return null;
  const minsLeft = differenceInMinutes(new Date(matchDate), new Date());
  if (minsLeft <= 60) {
    return <span className="text-xs text-red-400 font-medium">Prazo encerrado</span>;
  }
  if (minsLeft <= 120) {
    return <span className="text-xs text-yellow-400 font-medium">Palpite encerra em {minsLeft - 60}min</span>;
  }
  return null;
}

export default function MatchesPage() {
  const [filter, setFilter] = useState<MatchStatus | "all">("all");

  const { data: matches, isLoading } = useListMatches(
    filter !== "all" ? { status: filter } : undefined,
    { query: { queryKey: getListMatchesQueryKey(filter !== "all" ? { status: filter } : undefined) } }
  );

  const filters: { label: string; value: MatchStatus | "all" }[] = [
    { label: "Todos", value: "all" },
    { label: "Em Breve", value: "upcoming" },
    { label: "Ao Vivo", value: "live" },
    { label: "Encerrados", value: "finished" },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jogos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Faça seus palpites antes do prazo</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {filters.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              data-testid={`filter-${value}`}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
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
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {matches?.map((m) => (
              <Link key={m.id} href={`/matches/${m.id}`}>
                <div
                  className="bg-card border border-card-border rounded-xl p-4 hover:bg-muted/20 cursor-pointer transition-colors group"
                  data-testid={`match-card-${m.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Teams */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <img
                          src={m.homeLogo ?? ""}
                          alt={m.homeTeam}
                          className="w-8 h-8 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <span className="font-semibold text-foreground text-sm md:text-base">{m.homeTeam}</span>
                      </div>

                      {m.status === "finished" || m.status === "live" ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-lg">
                          <span className="text-xl font-bold text-foreground tabular-nums">{m.homeScore ?? "-"}</span>
                          <span className="text-muted-foreground">x</span>
                          <span className="text-xl font-bold text-foreground tabular-nums">{m.awayScore ?? "-"}</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-muted/30 rounded-lg">
                          <span className="text-sm text-muted-foreground font-medium">vs</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm md:text-base">{m.awayTeam}</span>
                        <img
                          src={m.awayLogo ?? ""}
                          alt={m.awayTeam}
                          className="w-8 h-8 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    </div>

                    {/* Status & date */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusBadge status={m.status} />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(m.matchDate), "dd/MM", { locale: ptBR })}
                        <Clock className="w-3 h-3 ml-1" />
                        {format(new Date(m.matchDate), "HH:mm")}
                      </div>
                      <DeadlineLabel matchDate={m.matchDate} status={m.status} />
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 hidden md:block" />
                  </div>
                </div>
              </Link>
            ))}
            {!matches?.length && (
              <div className="bg-card border border-card-border rounded-xl p-12 text-center">
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
