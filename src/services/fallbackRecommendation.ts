/**
 * Offline / no-API fallback recommendation engine.
 *
 * Used when the AI recommendation engine is unavailable (provider down, rate
 * limited, offline). It never touches an external music API — everything comes
 * from the listener's own data:
 *
 *   1. Liked songs (highest priority) — Supabase `liked_songs` + localStorage
 *   2. Recently played — local listening history
 *   3. Followed artists — the artists picked during onboarding, matched
 *      against everything above
 *
 * Search history is NEVER used as a recommendation source: searching for a
 * song does not mean the listener wants it recommended back to them.
 *
 * The merged list is deduplicated, weighted (all likes, a subset of the rest)
 * and shuffled so every fallback session feels fresh.
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

/* ------------------------------------------------------------------ */
/* Fallback engine                                                     */
/* ------------------------------------------------------------------ */

function dedupe(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    if (!t?.title || !t?.artist) continue;
    const key = trackKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Build a shuffled, diverse playlist from the user's own library only.
 * Fast, offline-safe, and never calls a music API.
 *
 * `isBlocked` lets the caller (radioEngine) drop songs that are still inside
 * their 6-hour cooldown or 7-day recommended window.
 */
export async function getFallbackRecommendations(
  limit = 30,
  seed?: Track | null,
  isBlocked?: (title: string, artist: string) => boolean,
): Promise<Track[]> {
  try {
    const liked = await getLikedSongs();
    const recent = getRecentlyPlayed(20);
    const followed = new Set(getFollowedArtists().map(norm));

    // Weighted selection: all likes, ~a random slice of recent plays.
    const recentSlice = shuffleArray(recent).slice(0, Math.max(4, Math.ceil(recent.length * 0.6)));

    const merged = dedupe([...liked, ...recentSlice]);
    const seedKey = seed ? trackKey(seed) : "";
    let pool = merged.filter((t) => trackKey(t) !== seedKey);
    if (isBlocked) pool = pool.filter((t) => !isBlocked(t.title, t.artist));

    // Followed (onboarding) artists get pulled toward the front, then the
    // whole list is shuffled inside each tier for variety.
    const followedTier = shuffleArray(pool.filter((t) => followed.has(norm(t.artist))));
    const restTier = shuffleArray(pool.filter((t) => !followed.has(norm(t.artist))));

    // Interleave so it never plays 20 songs by the same followed artist.
    const out: Track[] = [];
    let i = 0;
    let j = 0;
    while (out.length < limit && (i < followedTier.length || j < restTier.length)) {
      if (i < followedTier.length) out.push(followedTier[i++]);
      if (out.length < limit && j < restTier.length) out.push(restTier[j++]);
      if (out.length < limit && j < restTier.length) out.push(restTier[j++]);
    }
    return out.slice(0, limit);
  } catch (error) {
    console.error("Fallback recommendation failed:", error);
    return [];
  }
}
