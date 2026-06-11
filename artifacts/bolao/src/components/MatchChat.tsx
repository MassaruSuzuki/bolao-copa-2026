import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  MessageCircle,
  Lock,
  Smile,
  Trash2,
  ShieldCheck,
} from "lucide-react";
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

function areMessagesEqual(a: ChatMessage[], b: ChatMessage[]) {
  if (a.length !== b.length) return false;

  return a.every((msg, index) => {
    const other = b[index];

    return (
      msg.id === other.id &&
      msg.message === other.message &&
      msg.createdAt === other.createdAt &&
      msg.userName === other.userName &&
      msg.userAvatarUrl === other.userAvatarUrl
    );
  });
}

function MatchChatComponent({ matchId, isLive }: MatchChatProps) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const chatLockedRef = useRef(false);

  const isAdmin = user?.isAdmin === true;
  const canSend = isLive && !chatLocked;

  const loadMessages = useCallback(async () => {
    try {
      const token = localStorage.getItem("bolao_token");

      const res = await fetch(`/api/matches/${matchId}/chat`, {
        cache: "no-store",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) return;

      const data = await res.json();

      const nextMessages = data.messages ?? [];
      const nextChatLocked = data.chatLocked === true;

      if (!areMessagesEqual(messagesRef.current, nextMessages)) {
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
      }

      if (chatLockedRef.current !== nextChatLocked) {
        chatLockedRef.current = nextChatLocked;
        setChatLocked(nextChatLocked);
      }
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!active) return;
      await loadMessages();
    };

    run();

    const interval = window.setInterval(run, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadMessages]);

  useEffect(() => {
    const chatScrollArea = bottomRef.current?.parentElement;
    if (!chatScrollArea) return;

    chatScrollArea.scrollTop = chatScrollArea.scrollHeight;
  }, [messages.length]);

  const handleEmojiClick = (emojiData: any) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleClearChat = async () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja limpar o chat desta partida?"
    );

    if (!confirmed) return;

    const token = localStorage.getItem("bolao_token");

    const res = await fetch(`/api/matches/${matchId}/chat`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) return;

    messagesRef.current = [];
    setMessages([]);
  };

  const handleToggleLock = async () => {
    const token = localStorage.getItem("bolao_token");
    const nextValue = !chatLockedRef.current;

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
    const nextChatLocked = data.chatLocked === true;

    chatLockedRef.current = nextChatLocked;
    setChatLocked(nextChatLocked);

    await loadMessages();
  };

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
    <div className="flex h-full max-h-[430px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-white">Chat da Partida</p>
        </div>

        {canSend ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            ABERTO
          </span>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {chatLocked ? "BLOQUEADO" : "ENCERRADO"}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-2">
          <button
            type="button"
            onClick={handleClearChat}
            className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/15 px-2 py-1 text-[11px] font-bold text-red-400 transition-colors hover:bg-red-500/25"
          >
            <Trash2 className="h-3 w-3" />
            Limpar
          </button>

          <button
            type="button"
            onClick={handleToggleLock}
            className="flex items-center gap-1 rounded-lg border border-yellow-500/20 bg-yellow-500/15 px-2 py-1 text-[11px] font-bold text-yellow-400 transition-colors hover:bg-yellow-500/25"
          >
            <ShieldCheck className="h-3 w-3" />
            {chatLocked ? "Liberar" : "Bloquear"}
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Carregando mensagens...
          </p>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Seja o primeiro a comentar esse jogo.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              {msg.userAvatarUrl ? (
                <img
                  src={msg.userAvatarUrl}
                  alt={msg.userName}
                  className="h-8 w-8 flex-shrink-0 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-black text-primary">
                  {msg.userName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-bold text-white">
                    {msg.userName}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="mt-0.5 break-words text-sm text-white/80">
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
              <div className="absolute bottom-12 left-0 z-50 origin-bottom-left scale-[0.82]">
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
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-yellow-400 transition-colors hover:bg-white/10"
            >
              <Smile className="h-4 w-4" />
            </button>

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              maxLength={300}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary/40"
            />

            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                text.trim() && !sending
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "cursor-not-allowed bg-white/5 text-white/30"
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            {chatLocked
              ? "Chat bloqueado pelo administrador."
              : "Chat encerrado. A partida já terminou."}
          </div>
        )}
      </div>
    </div>
  );
}

export const MatchChat = memo(
  MatchChatComponent,
  (prev, next) =>
    prev.matchId === next.matchId && prev.isLive === next.isLive
);