import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, Check } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { uploadFile, isUploading } = useUpload({
    basePath: "/api/storage",
    onSuccess: (response) => {
      setAvatarUrl(response.objectPath);
    },
    onError: () => {
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Apenas imagens são permitidas", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem muito grande (máx 5MB)", variant: "destructive" });
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    const result = await uploadFile(file);
    if (result) {
      setAvatarUrl(result.objectPath);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem("bolao_token");
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: name.trim(), avatarUrl }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar");
      }

      refreshUser();
      toast({ title: "Perfil atualizado!" });
    } catch {
      toast({ title: "Erro ao salvar perfil", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = previewUrl ?? (avatarUrl ? `/api/storage${avatarUrl}` : null);
  const initials = (user?.name ?? "?").slice(0, 2).toUpperCase();

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-white mb-8">Meu Perfil</h1>

        <div className="rounded-2xl border p-6 space-y-6"
          style={{ background: "hsl(220,20%,7%)", borderColor: "rgba(201,162,39,0.12)" }}>

          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-2xl font-black flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)", color: "#1a1200" }}
              >
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt={user?.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors"
                style={{
                  background: "hsl(220,20%,12%)",
                  borderColor: "rgba(201,162,39,0.4)",
                }}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Camera className="w-4 h-4 text-primary" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {isUploading && (
              <p className="text-xs text-white/50">Enviando foto...</p>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {displayAvatar ? "Trocar foto" : "Adicionar foto de perfil"}
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-white/70 text-sm">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
              placeholder="Seu nome"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white/70 text-sm">Email</Label>
            <Input
              value={user?.email ?? ""}
              disabled
              className="bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
            />
            <p className="text-xs text-white/30">O email não pode ser alterado</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || isUploading || !name.trim()}
            className="w-full font-bold gap-2"
            style={{ background: "linear-gradient(135deg, hsl(43,74%,52%) 0%, hsl(38,80%,44%) 100%)", color: "#1a1200" }}
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : (
              <><Check className="w-4 h-4" /> Salvar alterações</>
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
