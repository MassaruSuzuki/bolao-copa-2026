import { X, Minimize2 } from "lucide-react";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useVideo } from "@/contexts/VideoContext";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { useLocation } from "wouter";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PIP_WIDTH = 320;
const PIP_HEIGHT = 180;
const PIP_MARGIN = 16;

export function FloatingPlayer() {
  const { video, clearVideo, pipSlot } = useVideo();
  const [location] = useLocation();
  const [minimized, setMinimized] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number>(0);

  const isOnLivePage = location === "/ao-vivo";
  const embedUrl = video.url ? getYoutubeEmbedUrl(video.url) : null;

  // Track slot position so the always-mounted iframe can be repositioned over it
  useLayoutEffect(() => {
    if (!pipSlot) {
      setRect(null);
      return;
    }

    const update = () => {
      const r = pipSlot.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(pipSlot);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [pipSlot]);

  // Cancel any pending RAF on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  if (!embedUrl) return null;

  // Docked into card slot
  const docked = !!pipSlot && !!rect;
  // Hidden: on ao-vivo page but no slot yet (transitioning), or no video
  const hidden = isOnLivePage && !docked;

  // Compute fixed position
  const pipBottom = `${PIP_MARGIN}px`;
  const pipRight = `${PIP_MARGIN}px`;
  const pipWidth = docked ? `${rect!.width}px` : minimized ? "220px" : `${PIP_WIDTH}px`;
  const pipTop = docked ? `${rect!.top}px` : undefined;
  const pipLeft = docked ? `${rect!.left}px` : undefined;
  const pipRight2 = docked ? undefined : pipRight;
  const pipBottomVal = docked ? undefined : pipBottom;

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 50,
        top: pipTop,
        left: pipLeft,
        bottom: pipBottomVal,
        right: pipRight2,
        width: pipWidth,
        // When docked, fill the slot height; otherwise PiP fixed height
        height: docked ? `${rect!.height}px` : undefined,
        borderRadius: docked ? "12px" : "12px",
        overflow: "hidden",
        boxShadow: docked ? "none" : "0 25px 50px -12px rgba(0,0,0,0.7)",
        border: docked ? "none" : "1px solid rgba(201,162,39,0.3)",
        background: "hsl(220,20%,8%)",
        display: hidden ? "none" : "flex",
        flexDirection: "column",
        transition: docked
          ? "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease"
          : "bottom 0.25s ease, right 0.25s ease, width 0.2s ease",
        pointerEvents: hidden ? "none" : undefined,
        opacity: hidden ? 0 : 1,
      }}
    >
      {/* PiP header — only shown when floating */}
      {!docked && (
        <div
          className="flex items-center justify-between px-3 py-2 flex-shrink-0"
          style={{ background: "rgba(201,162,39,0.1)" }}
        >
          <span className="text-xs font-semibold text-primary truncate flex-1 mr-2">
            {video.matchTitle ?? "Jogo ao vivo"}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized((m) => !m)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              title={minimized ? "Expandir" : "Minimizar"}
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={clearVideo}
              className="text-muted-foreground hover:text-red-400 transition-colors p-0.5"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* The ONE iframe — never unmounts, just repositioned */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          height: !docked && minimized ? 0 : undefined,
          transition: "height 0.2s ease",
        }}
      >
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none", display: "block", minHeight: docked ? undefined : `${PIP_HEIGHT}px` }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
