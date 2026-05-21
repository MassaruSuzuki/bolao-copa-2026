import { createContext, useContext, useState, ReactNode } from "react";

interface VideoState {
  url: string | null;
  matchTitle: string | null;
}

interface VideoContextType {
  video: VideoState;
  setVideo: (url: string, matchTitle: string) => void;
  clearVideo: () => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [video, setVideoState] = useState<VideoState>({ url: null, matchTitle: null });

  const setVideo = (url: string, matchTitle: string) => {
    setVideoState({ url, matchTitle });
  };

  const clearVideo = () => {
    setVideoState({ url: null, matchTitle: null });
  };

  return (
    <VideoContext.Provider value={{ video, setVideo, clearVideo }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error("useVideo must be used inside VideoProvider");
  return ctx;
}

export function getYoutubeEmbedUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    let videoId: string | null = null;
    if (url.hostname === "youtu.be") {
      videoId = url.pathname.slice(1).split("?")[0];
    } else if (url.hostname.includes("youtube.com")) {
      videoId = url.searchParams.get("v");
    }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  } catch {
    return null;
  }
}
