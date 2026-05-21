import { X, Minimize2 } from "lucide-react";
import { useState, useLayoutEffect } from "react";
import { useVideo } from "@/contexts/VideoContext";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { useLocation } from "wouter";

const PIP_W = 320;
const PIP_H = 180;
const MARGIN = 16;

export function FloatingPlayer() {
  const { url, matchTitle, pipSlot, clearVideo } = useVideo();
  const [location] = useLocation();
  const [minimized, setMinimized] = useState(false);
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);

  const isOnLivePage = location === "/ao-vivo";
  const embedUrl = url ? getYoutubeEmbedUrl(url) : null;

  // Keep track of the slot element's position on screen
  useLayoutEffect(() => {
    if (!pipSlot) { setSlotRect(null); return; }
    const update = () => setSlotRect(pipSlot.getBoundingClientRect());
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

  if (!embedUrl) return null;

  const docked = isOnLivePage && !!pipSlot && !!slotRect;
  // When on live page but slot not yet measured: hide (avoid flash)
  const hidden = isOnLivePage && !docked;

  // Geometry
  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    borderRadius: "12px",
    overflow: "hidden",
    display: hidden ? "none" : "flex",
    flexDirection: "column",
    transition: "top .25s ease, left .25s ease, width .25s ease, height .25s ease, bottom .25s ease, right .25s ease",
  };

  if (docked) {
    Object.assign(style, {
      top: slotRect!.top,
      left: slotRect!.left,
      width: slotRect!.width,
      height: slotRect!.height,
      boxShadow: "none",
      border: "none",
      background: "#000",
    });
  } else {
    Object.assign(style, {
      bottom: MARGIN,
      right: MARGIN,
      width: minimized ? 220 : PIP_W,
      boxShadow: "0 25px 50px -12px rgba(0,0,0,.8)",
      border: "1px solid rgba(201,162,39,.3)",
      background: "hsl(220,20%,8%)",
    });
  }

  return (
    <div style={style}>
      {/* Header — only visible when floating */}
      {!docked && (
        <div
          className="flex items-center justify-between px-3 py-2 flex-shrink-0"
          style={{ background: "rgba(201,162,39,.1)" }}
        >
          <span className="text-xs font-semibold text-primary truncate flex-1 mr-2">
            {matchTitle ?? "Jogo ao vivo"}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setMinimized((m) => !m)}
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
      )}

      {/* THE iframe — never unmounts while url is set */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          height: !docked && minimized ? 0 : undefined,
          minHeight: docked ? undefined : PIP_H,
          transition: "height .2s ease",
        }}
      >
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
