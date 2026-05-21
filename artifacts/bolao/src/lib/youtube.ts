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
