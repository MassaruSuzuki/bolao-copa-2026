import { useState, useEffect } from "react";
import {
  useListMatches,
  getListMatchesQueryKey,
  useCreateMatch,
  useUpdateMatch,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  RefreshCw,
  Zap,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ChevronDown,
} from "lucide-react";

type MatchStatus = "upcoming" | "live" | "finished";
type AdminTab = "participantes" | "jogos" | "palpites";

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

interface ParticipantUser {
  id: number;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  avatarUrl?: string | null;
  profileImage?: string | null;
  photoUrl?: string | null;
  imageUrl?: string | null;
}

interface AdminPrediction {
  id: number;
  userId: number;
  userName: string;
  userEmail?: string;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  matchDate: string;
  status: string;
  homeGoals: number;
  awayGoals: number;
  createdAt: string;
  updatedAt: string;
}

interface PredictionGroup {
  userId: number;
  userName: string;
  userEmail?: string;
  userPhoto?: string | null;
  predictions: AdminPrediction[];
}

function useAdminUsers() {
  return useQuery<ParticipantUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar usuários");
      }

      return res.json() as Promise<ParticipantUser[]>;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

function useAdminPredictions() {
  return useQuery<AdminPrediction[]>({
    queryKey: ["admin-predictions"],
    queryFn: async () => {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch("/api/admin/predictions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Erro ao carregar palpites");
      }

      return res.json() as Promise<AdminPrediction[]>;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

function UserAvatar({
  name,
  photo,
  size = "md",
}: {
  name: string;
  photo?: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-9 h-9" : "w-10 h-10";

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border border-card-border`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black`}
      style={{
        background:
          "linear-gradient(135deg, rgba(201,162,39,0.2) 0%, rgba(201,162,39,0.08) 100%)",
        color: "hsl(43,74%,52%)",
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const saved = localStorage.getItem("admin_tab");

    if (
      saved === "participantes" ||
      saved === "jogos" ||
      saved === "palpites"
    ) {
      return saved;
    }

    return "participantes";
  });

  useEffect(() => {
    localStorage.setItem("admin_tab", activeTab);
  }, [activeTab]);

  const [showCreate, setShowCreate] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingLive, setSyncingLive] = useState(false);
  const [processingUser, setProcessingUser] = useState<number | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<number[]>([]);

  const { data: participants, isLoading: loadingUsers } = useAdminUsers();
  const { data: predictions, isLoading: loadingPredictions } =
    useAdminPredictions();

  const pendingCount = (participants ?? []).filter(
    (u) => u.status === "pending"
  ).length;

  const [newMatch, setNewMatch] = useState({
    homeTeam: "",
    awayTeam: "",
    homeLogo: "",
    awayLogo: "",
    matchDate: "",
  });

  const { data: matches, isLoading: loadingMatches } = useListMatches(
    undefined,
    {
      query: {
        queryKey: getListMatchesQueryKey(),
      },
    }
  );

  const createMutation = useCreateMatch();
  const updateMutation = useUpdateMatch();

  if (!user?.isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  const toggleUserPredictions = (userId: number) => {
    setExpandedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const predictionGroups: PredictionGroup[] = (participants ?? [])
    .filter((participant) => participant.status === "approved")
    .map((participant) => {
      const userPredictions = (predictions ?? [])
        .filter((prediction) => prediction.userId === participant.id)
        .sort(
          (a, b) =>
            new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
        );

      return {
        userId: participant.id,
        userName: participant.name,
        userEmail: participant.email,
        userPhoto:
          participant.avatarUrl ??
          participant.profileImage ??
          participant.photoUrl ??
          participant.imageUrl ??
          null,
        predictions: userPredictions,
      };
    })
    .sort((a, b) => a.userName.localeCompare(b.userName));

  const handleSyncMatches = async () => {
    setSyncing(true);

    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch("/api/admin/sync-matches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json()) as {
        created?: number;
        updated?: number;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Erro");
      }

      toast({
        title: "Sincronizado!",
        description: `${data.created} criados, ${data.updated} atualizados`,
      });

      qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
    } catch (err) {
      toast({
        title: "Erro ao sincronizar",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncLive = async () => {
    setSyncingLive(true);

    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch("/api/admin/sync-live", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json()) as {
        updated?: number;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Erro");
      }

      toast({
        title: "Placares atualizados!",
        description: `${data.updated} jogos atualizados`,
      });

      qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
    } catch (err) {
      toast({
        title: "Erro ao atualizar placares",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setSyncingLive(false);
    }
  };

  const handleApprove = async (userId: number) => {
    setProcessingUser(userId);

    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Erro ao aprovar");
      }

      toast({ title: "Participante aprovado!" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setProcessingUser(null);
    }
  };

  const handleReject = async (userId: number) => {
    setProcessingUser(userId);

    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch(`/api/admin/users/${userId}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Erro ao recusar");
      }

      toast({ title: "Participante recusado." });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setProcessingUser(null);
    }
  };

  const handleCreate = () => {
    if (!newMatch.homeTeam || !newMatch.awayTeam || !newMatch.matchDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha times e data",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(
      {
        data: {
          ...newMatch,
          matchDate: new Date(newMatch.matchDate).toISOString(),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Jogo criado!" });
          qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          setShowCreate(false);
          setNewMatch({
            homeTeam: "",
            awayTeam: "",
            homeLogo: "",
            awayLogo: "",
            matchDate: "",
          });
        },
        onError: (err: unknown) => {
          toast({
            title: "Erro",
            description: err instanceof Error ? err.message : "Erro",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDeleteMatch = async (matchId: number) => {
    const confirmDelete = window.confirm(
      "Tem certeza que deseja excluir este jogo?"
    );

    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch(`/api/admin/matches/${matchId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Erro ao excluir jogo");
      }

      toast({ title: "Jogo excluído com sucesso!" });
      qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao excluir jogo",
        variant: "destructive",
      });
    }
  };

  const openEdit = (
    m: typeof matches extends (infer T)[] | undefined ? T : never
  ) => {
    if (!m) return;

    setActiveTab("jogos");

    setEditState({
      id: (m as { id: number }).id,
      homeTeam: (m as { homeTeam: string }).homeTeam,
      awayTeam: (m as { awayTeam: string }).awayTeam,
      homeLogo: (m as { homeLogo?: string | null }).homeLogo ?? "",
      awayLogo: (m as { awayLogo?: string | null }).awayLogo ?? "",
      matchDate: format(
        new Date((m as { matchDate: string }).matchDate),
        "yyyy-MM-dd'T'HH:mm"
      ),
      status: (m as { status: string }).status as MatchStatus,
      homeScore:
        (m as { homeScore?: number | null }).homeScore?.toString() ?? "",
      awayScore:
        (m as { awayScore?: number | null }).awayScore?.toString() ?? "",
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

    if (editState.homeScore !== "") {
      updateData.homeScore = parseInt(editState.homeScore, 10);
    }

    if (editState.awayScore !== "") {
      updateData.awayScore = parseInt(editState.awayScore, 10);
    }

    updateMutation.mutate(
      {
        id: editState.id,
        data: updateData as Parameters<typeof updateMutation.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          toast({ title: "Jogo atualizado!" });
          qc.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          setActiveTab("jogos");
          setEditState(null);
        },
        onError: (err: unknown) => {
          toast({
            title: "Erro",
            description: err instanceof Error ? err.message : "Erro",
            variant: "destructive",
          });
        },
      }
    );
  };

  const statusLabel = (s: string) => {
    if (s === "pending") {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
          <Clock className="w-3 h-3" />
          Pendente
        </Badge>
      );
    }

    if (s === "approved") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <CheckCircle className="w-3 h-3" />
          Aprovado
        </Badge>
      );
    }

    if (s === "rejected") {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
          <XCircle className="w-3 h-3" />
          Recusado
        </Badge>
      );
    }

    return null;
  };

  const predictionStatusLabel = (status: string) => {
    if (status === "live") return "Ao Vivo";
    if (status === "finished") return "Encerrado";
    return "Em Breve";
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />

            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                Painel Admin
              </h1>

              <p className="text-muted-foreground text-sm">
                Gerencie participantes, jogos e palpites
              </p>
            </div>
          </div>

          {activeTab === "participantes" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          )}

          {activeTab === "palpites" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["admin-users"] });
                qc.invalidateQueries({ queryKey: ["admin-predictions"] });
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          )}

          {activeTab === "jogos" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleSyncLive}
                disabled={syncingLive}
                className="gap-2 border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Zap
                  className={`w-4 h-4 ${syncingLive ? "animate-pulse" : ""}`}
                />
                {syncingLive ? "Atualizando..." : "Placares Ao Vivo"}
              </Button>

              <Button
                variant="outline"
                onClick={handleSyncMatches}
                disabled={syncing}
                className="gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Sincronizando..." : "Sincronizar Copa 2026"}
              </Button>

              <Button
                onClick={() => setShowCreate(true)}
                className="gap-2"
                data-testid="button-new-match"
              >
                <Plus className="w-4 h-4" />
                Novo Jogo
              </Button>
            </div>
          )}
        </div>

        <div
          className="flex gap-1 p-1 rounded-xl w-fit flex-wrap"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={() => setActiveTab("participantes")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "participantes"
                ? "text-[#1a1200]"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              activeTab === "participantes"
                ? {
                    background:
                      "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                    boxShadow: "0 2px 8px rgba(201,162,39,0.25)",
                  }
                : {}
            }
          >
            <Users className="w-4 h-4" />
            Participantes
            {pendingCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("jogos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "jogos"
                ? "text-[#1a1200]"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              activeTab === "jogos"
                ? {
                    background:
                      "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                    boxShadow: "0 2px 8px rgba(201,162,39,0.25)",
                  }
                : {}
            }
          >
            Jogos
          </button>

          <button
            onClick={() => setActiveTab("palpites")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "palpites"
                ? "text-[#1a1200]"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              activeTab === "palpites"
                ? {
                    background:
                      "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)",
                    boxShadow: "0 2px 8px rgba(201,162,39,0.25)",
                  }
                : {}
            }
          >
            <FileText className="w-4 h-4" />
            Palpites
          </button>
        </div>

        {activeTab === "participantes" && (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {loadingUsers ? (
              <div className="space-y-px">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-none" />
                ))}
              </div>
            ) : (participants ?? []).length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                Nenhum participante cadastrado ainda.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {[...(participants ?? [])]
                  .sort((a, b) => {
                    const order: Record<string, number> = {
                      pending: 0,
                      approved: 1,
                      rejected: 2,
                    };

                    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
                  })
                  .map((u) => {
                    const userPhoto =
                      u.avatarUrl ?? u.profileImage ?? u.photoUrl ?? u.imageUrl;

                    return (
                      <div
                        key={u.id}
                        className="px-4 py-3 flex items-center gap-3"
                        data-testid={`user-row-${u.id}`}
                      >
                        <UserAvatar
                          name={u.name}
                          photo={userPhoto}
                          size="sm"
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {u.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {statusLabel(u.status)}

                          {u.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="gap-1.5 h-8 px-3 bg-green-600 hover:bg-green-500 text-white"
                                onClick={() => handleApprove(u.id)}
                                disabled={processingUser === u.id}
                                data-testid={`button-approve-${u.id}`}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Aprovar
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-8 px-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                onClick={() => handleReject(u.id)}
                                disabled={processingUser === u.id}
                                data-testid={`button-reject-${u.id}`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Recusar
                              </Button>
                            </>
                          )}

                          {u.status === "rejected" && (
                            <Button
                              size="sm"
                              className="gap-1.5 h-8 px-3 bg-green-600 hover:bg-green-500 text-white"
                              onClick={() => handleApprove(u.id)}
                              disabled={processingUser === u.id}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Aprovar
                            </Button>
                          )}

                          {u.status === "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-8 px-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={() => handleReject(u.id)}
                              disabled={processingUser === u.id}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Revogar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {activeTab === "palpites" && (
          <div className="space-y-3">
            {loadingPredictions || loadingUsers ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : predictionGroups.length === 0 ? (
              <div className="bg-card border border-card-border rounded-xl px-5 py-12 text-center text-sm text-muted-foreground">
                Nenhum participante aprovado encontrado.
              </div>
            ) : (
              predictionGroups.map((group) => {
                const isOpen = expandedUsers.includes(group.userId);

                return (
                  <div
                    key={group.userId}
                    className="bg-card border border-card-border rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleUserPredictions(group.userId)}
                      className="w-full px-4 py-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          name={group.userName}
                          photo={group.userPhoto}
                        />

                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">
                            {group.userName}
                          </p>

                          {group.userEmail && (
                            <p className="text-xs text-muted-foreground truncate">
                              {group.userEmail}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          {group.predictions.length}{" "}
                          {group.predictions.length === 1
                            ? "palpite"
                            : "palpites"}
                        </Badge>

                        <ChevronDown
                          className={`w-5 h-5 text-muted-foreground transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {group.predictions.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                            Este participante ainda não fez nenhum palpite.
                          </div>
                        ) : (
                          group.predictions.map((p) => (
                            <div
                              key={p.id}
                              className="px-4 py-3 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  {p.homeLogo && (
                                    <img
                                      src={p.homeLogo}
                                      alt={p.homeTeam}
                                      className="w-5 h-5 object-contain"
                                    />
                                  )}

                                  <span className="font-medium text-foreground">
                                    {p.homeTeam}
                                  </span>

                                  <span className="font-bold text-primary">
                                    {p.homeGoals} × {p.awayGoals}
                                  </span>

                                  <span className="font-medium text-foreground">
                                    {p.awayTeam}
                                  </span>

                                  {p.awayLogo && (
                                    <img
                                      src={p.awayLogo}
                                      alt={p.awayTeam}
                                      className="w-5 h-5 object-contain"
                                    />
                                  )}
                                </div>

                                <p className="text-xs text-muted-foreground mt-1">
                                  Jogo:{" "}
                                  {format(
                                    new Date(p.matchDate),
                                    "dd/MM HH:mm",
                                    {
                                      locale: ptBR,
                                    }
                                  )}
                                </p>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <Badge variant="secondary" className="mb-1">
                                  {predictionStatusLabel(p.status)}
                                </Badge>

                                <p className="text-xs text-muted-foreground">
                                  Palpite feito em{" "}
                                  {format(
                                    new Date(p.createdAt),
                                    "dd/MM HH:mm",
                                    {
                                      locale: ptBR,
                                    }
                                  )}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "jogos" &&
          (loadingMatches ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="divide-y divide-border">
                {matches?.map((m) => (
                  <div
                    key={m.id}
                    className="px-4 py-3.5 flex items-center gap-4"
                    data-testid={`admin-match-${m.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <img
                        src={m.homeLogo ?? ""}
                        alt={m.homeTeam}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />

                      <span className="text-sm font-medium text-foreground truncate">
                        {m.homeTeam}
                      </span>

                      <span className="text-muted-foreground text-sm flex-shrink-0">
                        {m.homeScore !== null && m.awayScore !== null
                          ? `${m.homeScore} × ${m.awayScore}`
                          : "vs"}
                      </span>

                      <span className="text-sm font-medium text-foreground truncate">
                        {m.awayTeam}
                      </span>

                      <img
                        src={m.awayLogo ?? ""}
                        alt={m.awayTeam}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground hidden md:block">
                        {format(new Date(m.matchDate), "dd/MM HH:mm", {
                          locale: ptBR,
                        })}
                      </span>

                      {m.status === "live" && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          Ao Vivo
                        </Badge>
                      )}

                      {m.status === "finished" && (
                        <Badge variant="secondary">Encerrado</Badge>
                      )}

                      {m.status === "upcoming" && (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          Em Breve
                        </Badge>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(m)}
                        data-testid={`button-edit-match-${m.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDeleteMatch(m.id)}
                        data-testid={`button-delete-match-${m.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
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
          ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Jogo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Time da Casa</Label>
                <Input
                  placeholder="Brasil"
                  value={newMatch.homeTeam}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, homeTeam: e.target.value })
                  }
                  data-testid="input-home-team"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Time Visitante</Label>
                <Input
                  placeholder="Argentina"
                  value={newMatch.awayTeam}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, awayTeam: e.target.value })
                  }
                  data-testid="input-away-team"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Logo Casa (URL)</Label>
                <Input
                  placeholder="https://..."
                  value={newMatch.homeLogo}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, homeLogo: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Logo Visitante (URL)</Label>
                <Input
                  placeholder="https://..."
                  value={newMatch.awayLogo}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, awayLogo: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Data e Hora</Label>
              <Input
                type="datetime-local"
                value={newMatch.matchDate}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, matchDate: e.target.value })
                }
                data-testid="input-match-date"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>

            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? "Criando..." : "Criar Jogo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editState}
        onOpenChange={(open) => !open && setEditState(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Jogo</DialogTitle>
          </DialogHeader>

          {editState && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Time da Casa</Label>
                  <Input
                    value={editState.homeTeam}
                    onChange={(e) =>
                      setEditState({
                        ...editState,
                        homeTeam: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Time Visitante</Label>
                  <Input
                    value={editState.awayTeam}
                    onChange={(e) =>
                      setEditState({
                        ...editState,
                        awayTeam: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Data e Hora</Label>
                <Input
                  type="datetime-local"
                  value={editState.matchDate}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      matchDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={editState.status}
                  onValueChange={(v) =>
                    setEditState({
                      ...editState,
                      status: v as MatchStatus,
                    })
                  }
                >
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
                  <Input
                    type="number"
                    min="0"
                    value={editState.homeScore}
                    onChange={(e) =>
                      setEditState({
                        ...editState,
                        homeScore: e.target.value,
                      })
                    }
                    data-testid="input-home-score"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Gols Visitante</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editState.awayScore}
                    onChange={(e) =>
                      setEditState({
                        ...editState,
                        awayScore: e.target.value,
                      })
                    }
                    data-testid="input-away-score"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Link YouTube (transmissão ao vivo)</Label>
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={editState.youtubeUrl}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      youtubeUrl: e.target.value,
                    })
                  }
                />

                <p className="text-xs text-muted-foreground">
                  Cole o link do YouTube para exibir a transmissão na aba Ao
                  Vivo
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditState(null)}>
              Cancelar
            </Button>

            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-update"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}