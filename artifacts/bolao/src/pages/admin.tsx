import { useState } from "react";
import { useListMatches, getListMatchesQueryKey, useCreateMatch, useUpdateMatch } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Shield } from "lucide-react";

type MatchStatus = "upcoming" | "live" | "finished";

interface EditState {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  matchDate: string;
  status: MatchStatus;
  homeScore: string;
  awayScore: string;
  youtubeUrl: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);

  // New match form
  const [newMatch, setNewMatch] = useState({
    homeTeam: "",
    awayTeam: "",
    homeLogo: "",
    awayLogo: "",
    matchDate: "",
  });

  const { data: matches, isLoading } = useListMatches(undefined, {
    query: { queryKey: getListMatchesQueryKey() },
  });

  const createMutation = useCreateMatch();
  const updateMutation = useUpdateMatch();

  if (!user?.isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  const handleCreate = () => {
    if (!newMatch.homeTeam || !newMatch.awayTeam || !newMatch.matchDate) {
      toast({ title: "Campos obrigatórios", description: "Preencha times e data", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      { data: { ...newMatch, matchDate: new Date(newMatch.matchDate).toISOString() } },
      {
        onSuccess: () => {
          toast({ title: "Jogo criado!" });
          qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          setShowCreate(false);
          setNewMatch({ homeTeam: "", awayTeam: "", homeLogo: "", awayLogo: "", matchDate: "" });
        },
        onError: (err: unknown) => {
          toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
        },
      }
    );
  };

  const openEdit = (m: typeof matches extends (infer T)[] | undefined ? T : never) => {
    if (!m) return;
    setEditState({
      id: (m as { id: number }).id,
      homeTeam: (m as { homeTeam: string }).homeTeam,
      awayTeam: (m as { awayTeam: string }).awayTeam,
      homeLogo: (m as { homeLogo?: string | null }).homeLogo ?? "",
      awayLogo: (m as { awayLogo?: string | null }).awayLogo ?? "",
      matchDate: format(new Date((m as { matchDate: string }).matchDate), "yyyy-MM-dd'T'HH:mm"),
      status: (m as { status: string }).status as MatchStatus,
      homeScore: (m as { homeScore?: number | null }).homeScore?.toString() ?? "",
      awayScore: (m as { awayScore?: number | null }).awayScore?.toString() ?? "",
      youtubeUrl: (m as { youtubeUrl?: string | null }).youtubeUrl ?? "",
    });
  };

  const handleUpdate = () => {
    if (!editState) return;
    const updateData: Record<string, unknown> = {
      homeTeam: editState.homeTeam,
      awayTeam: editState.awayTeam,
      homeLogo: editState.homeLogo,
      awayLogo: editState.awayLogo,
      matchDate: new Date(editState.matchDate).toISOString(),
      status: editState.status,
      youtubeUrl: editState.youtubeUrl || null,
    };
    if (editState.homeScore !== "") updateData.homeScore = parseInt(editState.homeScore, 10);
    if (editState.awayScore !== "") updateData.awayScore = parseInt(editState.awayScore, 10);

    updateMutation.mutate(
      { id: editState.id, data: updateData as Parameters<typeof updateMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          toast({ title: "Jogo atualizado!" });
          qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          setEditState(null);
        },
        onError: (err: unknown) => {
          toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
              <p className="text-muted-foreground text-sm">Gerencie jogos e resultados</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2" data-testid="button-new-match">
            <Plus className="w-4 h-4" />
            Novo Jogo
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {matches?.map((m) => (
                <div key={m.id} className="px-5 py-4 flex items-center gap-4" data-testid={`admin-match-${m.id}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <img src={m.homeLogo ?? ""} alt={m.homeTeam} className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-sm font-medium text-foreground">{m.homeTeam}</span>
                    <span className="text-muted-foreground text-sm">
                      {m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} x ${m.awayScore}` : "vs"}
                    </span>
                    <span className="text-sm font-medium text-foreground">{m.awayTeam}</span>
                    <img src={m.awayLogo ?? ""} alt={m.awayTeam} className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground hidden md:block">
                      {format(new Date(m.matchDate), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    {m.status === "live" && <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Ao Vivo</Badge>}
                    {m.status === "finished" && <Badge variant="secondary">Encerrado</Badge>}
                    {m.status === "upcoming" && <Badge className="bg-primary/20 text-primary border-primary/30">Em Breve</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)} data-testid={`button-edit-match-${m.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {!matches?.length && (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Nenhum jogo cadastrado. Clique em "Novo Jogo" para começar.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Match Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Jogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Time da Casa</Label>
                <Input placeholder="Brasil" value={newMatch.homeTeam} onChange={(e) => setNewMatch({ ...newMatch, homeTeam: e.target.value })} data-testid="input-home-team" />
              </div>
              <div className="space-y-1.5">
                <Label>Time Visitante</Label>
                <Input placeholder="Argentina" value={newMatch.awayTeam} onChange={(e) => setNewMatch({ ...newMatch, awayTeam: e.target.value })} data-testid="input-away-team" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Logo Casa (URL)</Label>
                <Input placeholder="https://..." value={newMatch.homeLogo} onChange={(e) => setNewMatch({ ...newMatch, homeLogo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Logo Visitante (URL)</Label>
                <Input placeholder="https://..." value={newMatch.awayLogo} onChange={(e) => setNewMatch({ ...newMatch, awayLogo: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data e Hora</Label>
              <Input type="datetime-local" value={newMatch.matchDate} onChange={(e) => setNewMatch({ ...newMatch, matchDate: e.target.value })} data-testid="input-match-date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-confirm-create">
              {createMutation.isPending ? "Criando..." : "Criar Jogo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Match Dialog */}
      <Dialog open={!!editState} onOpenChange={(open) => !open && setEditState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Jogo</DialogTitle>
          </DialogHeader>
          {editState && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Time da Casa</Label>
                  <Input value={editState.homeTeam} onChange={(e) => setEditState({ ...editState, homeTeam: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Time Visitante</Label>
                  <Input value={editState.awayTeam} onChange={(e) => setEditState({ ...editState, awayTeam: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Data e Hora</Label>
                <Input type="datetime-local" value={editState.matchDate} onChange={(e) => setEditState({ ...editState, matchDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editState.status} onValueChange={(v) => setEditState({ ...editState, status: v as MatchStatus })}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Em Breve</SelectItem>
                    <SelectItem value="live">Ao Vivo</SelectItem>
                    <SelectItem value="finished">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Gols Casa</Label>
                  <Input type="number" min="0" value={editState.homeScore} onChange={(e) => setEditState({ ...editState, homeScore: e.target.value })} data-testid="input-home-score" />
                </div>
                <div className="space-y-1.5">
                  <Label>Gols Visitante</Label>
                  <Input type="number" min="0" value={editState.awayScore} onChange={(e) => setEditState({ ...editState, awayScore: e.target.value })} data-testid="input-away-score" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Link YouTube (transmissão ao vivo)</Label>
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={editState.youtubeUrl}
                  onChange={(e) => setEditState({ ...editState, youtubeUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Cole o link do YouTube para exibir a transmissão na aba Ao Vivo</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditState(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-confirm-update">
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
