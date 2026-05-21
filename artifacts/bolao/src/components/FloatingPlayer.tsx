import { X, Minimize2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useVideo } from "@/contexts/VideoContext";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export function FloatingPlayer() {
  const { video, clearVideo, pipSlot } = useVideo();
  const [location] = useLocation();
  const [minimized, setMinimized] = useState(false);

  const isOnLivePage = location === "/ao-vivo";
  const embedUrl = video.url ? getYoutubeEmbedUrl(video.url) : null;

  if (!embedUrl) return null;

  // The iframe — single source of truth, never unmounts while URL is set
  const iframe = (
    <iframe
      src={embedUrl}
      className="w-full h-full"
      style={{ border: "none", display: "block" }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );

  // When docked into a slot on ao-vivo page: portal the iframe there
  if (pipSlot) {
    return createPortal(iframe, pipSlot);
  }

  // When on live page but no slot (shouldn't normally happen) — hide
  if (isOnLivePage) return null;

  // Floating PiP mode
  return (
    <AnimatePresence>
      <motion.div
        key="pip"
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.9 }}
        transition={{ duration: 0.25 }}
        className="fixed bottom-4 right-4 z-50 shadow-2xl rounded-xl overflow-hidden"
        style={{
          border: "1px solid rgba(201,162,39,0.3)",
          background: "hsl(220,20%,8%)",
          width: minimized ? "220px" : "320px",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: "rgba(201,162,39,0.1)" }}
        >
          <span className="text-xs font-semibold text-primary truncate flex-1 mr-2">
            {video.matchTitle ?? "Jogo ao vivo"}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(!minimized)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={clearVideo}
              className="text-muted-foreground hover:text-red-400 transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Iframe */}
        <div
          style={{
            height: minimized ? 0 : "180px",
            overflow: "hidden",
            transition: "height 0.2s ease",
          }}
        >
          {iframe}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
