import { useEffect, useState } from "react";
import type { Track } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { getCachedYouTubeId } from "@/components/player/GlobalAudioPlayer";
import { searchYouTubeForTrack } from "@/hooks/useYouTubePlayback";

const PLACEHOLDER_ART = "/placeholder.svg";

const youtubeArtwork = (videoId?: string) => videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";

export function resolvedTrackArtwork(track?: Pick<Track, "artwork" | "youtubeId" | "title" | "artist"> | null) {
  if (!track) return PLACEHOLDER_ART;
  return track.artwork || youtubeArtwork(track.youtubeId || getCachedYouTubeId(track.title, track.artist)) || PLACEHOLDER_ART;
}

export function TrackArtwork({ track, alt, className, loading = "lazy" }: {
  track: Pick<Track, "id" | "artwork" | "youtubeId" | "title" | "artist" | "album" | "duration">;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [src, setSrc] = useState(() => resolvedTrackArtwork(track));
  const [lookedUp, setLookedUp] = useState(false);

  useEffect(() => {
    setSrc(resolvedTrackArtwork(track));
    setLookedUp(false);
  }, [track.id, track.artwork, track.youtubeId, track.title, track.artist]);

  const handleError = async () => {
    const knownFallback = youtubeArtwork(track.youtubeId || getCachedYouTubeId(track.title, track.artist));
    if (knownFallback && src !== knownFallback) {
      setSrc(knownFallback);
      return;
    }
    if (!lookedUp) {
      setLookedUp(true);
      try {
        const id = await searchYouTubeForTrack(track as Track);
        if (id) {
          setSrc(youtubeArtwork(id));
          return;
        }
      } catch { /* use local fallback */ }
    }
    setSrc(PLACEHOLDER_ART);
  };

  return <img src={src} alt={alt ?? `${track.title} artwork`} className={cn("bg-muted object-cover", className)} loading={loading} onError={handleError} />;
}