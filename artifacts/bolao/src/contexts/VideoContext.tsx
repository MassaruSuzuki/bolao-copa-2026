import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface VideoState {
  url: string | null;
  matchTitle: string | null;
}

interface VideoContextType {
  video: VideoState;
  setVideo: (url: string, matchTitle: string) => void;
  clearVideo: () => void;
  pipSlot: Element | null;
  setPipSlot: (el: Element | null) => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [video, setVideoState] = useState<VideoState>({ url: null, matchTitle: null });
  const [pipSlot, setPipSlotState] = useState<Element | null>(null);

  const setVideo = useCallback((url: string, matchTitle: string) => {
    setVideoState((prev) => (prev.url === url ? prev : { url, matchTitle }));
  }, []);

  const clearVideo = useCallback(() => {
    setVideoState({ url: null, matchTitle: null });
    setPipSlotState(null);
  }, []);

  const setPipSlot = useCallback((el: Element | null) => {
    setPipSlotState(el);
  }, []);

  return (
    <VideoContext.Provider value={{ video, setVideo, clearVideo, pipSlot, setPipSlot }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error("useVideo must be used inside VideoProvider");
  return ctx;
}
