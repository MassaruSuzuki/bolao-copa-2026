import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, Lock, Smile, Trash2, ShieldCheck } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface ChatMessage {
  id: number;
  matchId: number;
  userId: number;
  message: string;
  createdAt: string;
  userName: string;
  userAvatarUrl: string | null;
}

interface MatchChatProps {
  matchId: number;
  isLive: boolean;
}

export function MatchChat({ matchId, isLive }: MatchChatProps) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.isAdmin === true;
  const canSend = isLive && !chatLocked;

  const handleEmojiClick = (emojiData: any) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const loadMessages = async () => {
    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch(`/api/matches/${matchId}/chat`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) return;

      const data = await res.json();

setMessages(data.messages ?? []);
setChatLocked(data.chatLocked === true);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    const confirmed = window.confirm("Tem certeza que deseja limpar o chat desta partida?");

    if (!confirmed) return;

    const token = localStorage.getItem("bolao_token");

    const res = await fetch(`/api/matches/${matchId}/chat`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) return;

    setMessages([]);
  };

  const handleToggleLock = async () => {
    const token = localStorage.getItem("bolao_token");
    const nextValue = !chatLocked;

    const res = await fetch(`/api/matches/${matchId}/chat/lock`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        locked: nextValue,
      }),
    });

    if (!res.ok) return;

    const data = await res.json();

setChatLocked(data.chatLocked === true);
await loadMessages();
  };

  useEffect(() => {
    loadMessages();
    
    const interval = setInterval(loadMessages, 5000);

    return () => clearInterval(interval);
  }, [matchId]);

  useEffect(() => {
    const chatScrollArea = bottomRef.current?.parentElement;

    if (!chatScrollArea) return;

    chatScrollArea.scrollTop = chatScrollArea.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    const clean = text.trim();

    if (!clean || sending || !canSend) return;

    setSending(true);

    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch(`/api/matches/${matchId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: clean }),
      });

      if (!res.ok) return;

      setText("");
      setShowEmojiPicker(false);
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full max-h-[430px] rounded-xl overflow-hidden border border-white/10 bg-black/20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold text-white">Chat da Partida</p>
        </div>

        {canSend ? (
          <span className="text-[10px] font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2 py-0.5">
            ABERTO
          </span>
        ) : (
          <span className="text-[10px] font-bold text-muted-foreground border border-white/10 bg-white/5 rounded-full px-2 py-0.5">
            {chatLocked ? "BLOQUEADO" : "ENCERRADO"}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={handleClearChat}
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Limpar
          </button>

          <button
            type="button"
            onClick={handleToggleLock}
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/25 transition-colors"
          >
            <ShieldCheck className="w-3 h-3" />
            {chatLocked ? "Liberar" : "Bloquear"}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Carregando mensagens...
          </p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Seja o primeiro a comentar esse jogo.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              {msg.userAvatarUrl ? (
                <img
                  src={msg.userAvatarUrl}
                  alt={msg.userName}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-black flex-shrink-0">
                  {msg.userName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white truncate">
                    {msg.userName}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-sm text-white/80 break-words mt-0.5">
                  {msg.message}
                </p>
              </div>
            </div>
          ))
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 p-3">
        {canSend ? (
          <div className="relative flex items-center gap-2">
            {showEmojiPicker && (
              <div className="absolute bottom-12 left-0 z-50 scale-[0.82] origin-bottom-left">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={300}
                  height={340}
                  previewConfig={{ showPreview: false }}
                  searchPlaceholder="Buscar emoji"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-yellow-400 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Smile className="w-4 h-4" />
            </button>

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              maxLength={300}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary/40"
            />

            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                text.trim() && !sending
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "bg-white/5 text-white/30 cursor-not-allowed",
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
            <Lock className="w-3.5 h-3.5" />
            {chatLocked
              ? "Chat bloqueado pelo administrador."
              : "Chat encerrado. A partida já terminou."}
          </div>
        )}
      </div>
    </div>
  );
}