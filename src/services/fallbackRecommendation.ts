/**
 * Library taste helpers.
 *
 * These read the listener's own data (liked songs, recent plays, followed
 * artists) purely so the AI recommendation engine can UNDERSTAND their taste.
 * Library songs are never used as a source of recommendations — there is no
 * local fallback playlist any more.
 */
import type { Track } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { getListeningHistory } from "@/hooks/useListeningHistory";


export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const norm = (s?: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const trackKey = (t: Track) => `${norm(t.artist)}::${norm(t.title)}`;

/* ------------------------------------------------------------------ */
/* Data sources                                                        */
/* ------------------------------------------------------------------ */

function localLikedSongs(): Track[] {
  try {
    const raw = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]");
    return Array.isArray(raw) ? (raw as Track[]).filter((t) => t?.title && t?.artist) : [];
  } catch {
    return [];
  }
}

/** Liked songs from Supabase (when signed in) merged with the local list. */
export async function getLikedSongs(): Promise<Track[]> {
  const local = localLikedSongs();
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return local;
    const { data, error } = await supabase
      .from("liked_songs")
      .select("track_title, track_artist, track_album, track_artwork, track_duration, youtube_id, liked_at")
      .eq("user_id", userId)
      .order("liked_at", { ascending: false })
      .limit(300);
    if (error || !data) return local;
    const remote: Track[] = data.map((r, i) => ({
      id: `liked-${i}-${norm(r.track_title)}`,
      title: r.track_title,
      artist: r.track_artist,
      album: r.track_album || "",
      artwork: r.track_artwork || "/placeholder.svg",
      duration: r.track_duration || 0,
      youtubeId: r.youtube_id || undefined,
    })) as Track[];
    return [...remote, ...local];
  } catch {
    return local;
  }
}

/** Most recently played songs (local history). */
export function getRecentlyPlayed(limit = 20): Track[] {
  return getListeningHistory().slice(0, limit);
}

/* Search history is deliberately NOT a recommendation source. */


/** Artists chosen in onboarding are treated as the user's followed artists. */
export function getFollowedArtists(): string[] {
  const out = new Set<string>();
  for (const key of ["onboarding", "routenet_onboarding_prefs", "onboarding_prefs"]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.artists) ? parsed.artists : [];
      list.forEach((a: any) => {
        const name = String(a?.name ?? a ?? "").trim();
        if (name) out.add(name);
      });
    } catch { /* ignore */ }
  }
  return [...out];
}
