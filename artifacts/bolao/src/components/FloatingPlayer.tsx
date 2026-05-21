import { X, Minimize2 } from "lucide-react";
import { useState } from "react";
import { useVideo, getYoutubeEmbedUrl } from "@/contexts/VideoContext";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export function FloatingPlayer() {
  const { video, clearVideo } = useVideo();
  const [location] = useLocation();
  const [minimized, setMinimized] = useState(false);

  const isOnLivePage = location === "/ao-vivo";
  const embedUrl = video.url ? getYoutubeEmbedUrl(video.url) : null;

  const visible = !isOnLivePage && !!embedUrl;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
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
          <div
            className="flex items-center justify-between px-3 py-2 cursor-pointer"
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
          <AnimatePresence>
            {!minimized && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                <iframe
                  src={embedUrl!}
                  className="w-full"
                  style={{ height: "180px", border: "none", display: "block" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
