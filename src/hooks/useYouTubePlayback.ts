import { useState, useCallback } from "react";
import { Track } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { getCachedYouTubeId, cacheYouTubeId } from "@/components/player/GlobalAudioPlayer";

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: number;
}

const norm = (s: string) =>
  (s || "").toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

const BAD_KEYWORDS = [
  "karaoke", "cover", "instrumental", "slowed", "reverb", "sped up", "speed up",
  "mashup", "remix", "reaction", "tutorial", "lesson", "8d audio", "nightcore",
];

/**
 * Score a YouTube candidate so the *official* recording of the requested song
 * wins: the channel must look like the artist (VEVO / "- Topic" / artist name)
 * and the video title must actually contain the song title.
 */
function scoreCandidate(item: any, track: Track): number {
  const title = norm(item?.snippet?.title || "");
  const channel = norm(item?.snippet?.channelTitle || "");
  const wantTitle = norm(track.title);
  const wantArtist = norm(track.artist);
  if (!title) return -1;

  let score = 0;
  if (wantTitle && title.includes(wantTitle)) score += 60;
  else {
    // partial word overlap only — usually a different song
    const words = wantTitle.split(" ").filter((w) => w.length > 2);
    const hits = words.filter((w) => title.includes(w)).length;
    if (!words.length || hits / words.length < 0.6) return -1;
    score += 20;
  }

  if (wantArtist) {
    if (channel.includes(wantArtist)) score += 50;
    else if (title.includes(wantArtist)) score += 25;
    else score -= 25;
  }
  if (/vevo|topic|official/.test(channel)) score += 35;
  if (/official audio|official video|official music video|audio/.test(title)) score += 15;
  if (/live|concert|performance|lyrics|lyric video/.test(title)) score -= 15;
  if (BAD_KEYWORDS.some((k) => title.includes(k))) score -= 80;
  return score;
}

// Search YouTube for a track — official artist uploads first
export async function searchYouTubeForTrack(track: Track): Promise<string | null> {
  // Check in-memory cache first
  const memCached = getCachedYouTubeId(track.title, track.artist);
  if (memCached) return memCached;

  try {
    const searchQueries = [
      `${track.artist} ${track.title} official audio`,
      `${track.artist} ${track.title} official music video`,
      `${track.artist} ${track.title}`,
    ];

    let best: { id: string; score: number } | null = null;

    for (const searchQuery of searchQueries) {
      try {
        const { data } = await supabase.functions.invoke("youtube", {
          body: { action: "search", params: { query: searchQuery, maxResults: 6 } },
        });

        for (const item of data?.items || []) {
          const videoId = typeof item?.id === "string" ? item.id : item?.id?.videoId;
          if (!videoId) continue;
          const score = scoreCandidate(item, track);
          if (score < 0) continue;
          if (!best || score > best.score) best = { id: videoId, score };
        }
        // A strong official match ends the search early.
        if (best && best.score >= 110) break;
      } catch (e) {
        console.warn(`[YT Search] Query failed: ${searchQuery}`, e);
      }
    }

    if (best) {
      cacheYouTubeId(track.title, track.artist, best.id);
      return best.id;
    }
    return null;
  } catch (e) {
    console.error("YouTube search failed:", e);
    return null;
  }
}

// Batch search multiple tracks (for preloading)
export async function searchYouTubeForTracks(tracks: Track[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // Simple sequential search — no firecrawl batch
  for (const track of tracks.slice(0, 5)) {
    try {
      const id = await searchYouTubeForTrack(track);
      if (id) results.set(track.id, id);
    } catch {}
  }

  return results;
}

// Hook to manage YouTube playback for tracks
export function useYouTubePlayback() {
  const [isSearching, setIsSearching] = useState(false);
  const [currentYouTubeId, setCurrentYouTubeId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const getYouTubeId = useCallback(async (track: Track): Promise<string | null> => {
    setSearchError(null);

    if (track.youtubeId) {
      setCurrentYouTubeId(track.youtubeId);
      return track.youtubeId;
    }

    const memCached = getCachedYouTubeId(track.title, track.artist);
    if (memCached) {
      setCurrentYouTubeId(memCached);
      track.youtubeId = memCached;
      return memCached;
    }

    setIsSearching(true);
    try {
      const videoId = await searchYouTubeForTrack(track);
      if (videoId) {
        setCurrentYouTubeId(videoId);
        track.youtubeId = videoId;
        return videoId;
      } else {
        setSearchError("Could not find video");
        return null;
      }
    } catch (e) {
      setSearchError("Search failed");
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearYouTubeId = useCallback(() => {
    setCurrentYouTubeId(null);
    setSearchError(null);
  }, []);

  return {
    isSearching,
    currentYouTubeId,
    searchError,
    getYouTubeId,
    clearYouTubeId,
  };
}
