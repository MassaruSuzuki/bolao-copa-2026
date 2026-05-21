import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface VideoContextType {
  url: string | null;
  matchTitle: string | null;
  pipSlot: Element | null;
  setVideo: (url: string, matchTitle: string) => void;
  clearVideo: () => void;
  setPipSlot: (el: Element | null) => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [matchTitle, setMatchTitle] = useState<string | null>(null);
  const [pipSlot, setPipSlotState] = useState<Element | null>(null);

  const setVideo = useCallback((u: string, title: string) => {
    setUrl((prev) => (prev === u ? prev : u));
    setMatchTitle(title);
  }, []);

  const clearVideo = useCallback(() => {
    setUrl(null);
    setMatchTitle(null);
    setPipSlotState(null);
  }, []);

  const setPipSlot = useCallback((el: Element | null) => {
    setPipSlotState(el);
  }, []);

  return (
    <VideoContext.Provider value={{ url, matchTitle, pipSlot, setVideo, clearVideo, setPipSlot }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error("useVideo must be inside VideoProvider");
  return ctx;
}
