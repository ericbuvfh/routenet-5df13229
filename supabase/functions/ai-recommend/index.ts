// AI recommendation engine — returns ~50 song suggestions given a seed track
// and recent user taste signals. Model output is title/artist pairs that the
// client resolves via the existing `deezer` edge function.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { chatJson, LlmUnavailableError } from "../_shared/llm.ts";


interface Signal { type: string; title?: string; artist?: string; genre?: string; weight?: number }
interface Body {
  seed?: { title: string; artist: string; genre?: string } | null;
  signals?: Signal[];
  followedArtists?: string[];
  likedSongs?: string[];
  recentlyPlayed?: string[];
  playlistSongs?: string[];
  savedAlbums?: string[];
  recentArtists?: string[];
  excludeTitles?: string[];
  distribution?: Record<string, number>;
  variety?: string;
  count?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const count = Math.max(10, Math.min(60, body.count ?? 50));
    const seed = body.seed;
    const signals = (body.signals ?? []).slice(0, 40);
    const followed = (body.followedArtists ?? []).slice(0, 30);
    const liked = (body.likedSongs ?? []).slice(0, 30);
    const recent = (body.recentlyPlayed ?? []).slice(0, 20);
    const albums = (body.savedAlbums ?? []).slice(0, 20);
    const exclude = (body.excludeTitles ?? []).slice(0, 120);

    const signalSummary = signals
      .map((s) => `- ${s.type}: ${s.artist ?? ""}${s.title ? ` — ${s.title}` : ""}${s.genre ? ` [${s.genre}]` : ""}${s.weight ? ` (w=${s.weight})` : ""}`)
      .join("\n");

    const system = `You are a world-class music curator building a continuous listening session (like a great radio DJ).

Return exactly ${count} real, existing songs as JSON. Each item MUST have:
  "title"  – the exact released song title
  "artist" – the exact primary artist name
  "role"   – one of: related | trending | recent | fanfav | classic | hidden
  "reason" – max 12 words

Role distribution (approximate, across the whole list):
  fanfav 30% (deep fan favourites and signature album songs, NOT the artist's single biggest hit)
  related 25% (same sound / mood / BPM / production as the seed and taste)
  recent 20% (new releases from the last 12-18 months)
  classic 15% (older album classics and essentials that still fit)
  hidden 10% (lesser-known gems that fit the taste)
  trending: use sparingly — at most 3 songs total

Hard rules:
- Do NOT build a chart / top-hits playlist. Prefer album cuts, fan favourites, classics and new releases over the obvious mainstream singles.
- Deeply respect the listener's LIKED SONGS, SAVED ALBUMS, RECENTLY PLAYED and FOLLOWED ARTISTS below: match their genres, era, language, energy and production style.
- Never repeat the seed or any excluded title, and never return a song already listed under LIKED or RECENTLY PLAYED.
- Maximum 2 songs per artist, and at least 15 DIFFERENT artists overall.
- Only real songs that exist on streaming services. No mixes, edits, karaoke, covers, sped-up or AI versions.
- Return ONLY valid JSON, no prose.`;

    const user = `SEED: ${seed ? `${seed.title} — ${seed.artist}${seed.genre ? ` (${seed.genre})` : ""}` : "(none — use signals)"}

FOLLOWED ARTISTS:
${followed.map((a) => `- ${a}`).join("\n") || "(none)"}

LIKED SONGS:
${liked.map((a) => `- ${a}`).join("\n") || "(none)"}

SAVED ALBUMS:
${albums.map((a) => `- ${a}`).join("\n") || "(none)"}

RECENTLY PLAYED:
${recent.map((a) => `- ${a}`).join("\n") || "(none)"}

RECENT SIGNALS:
${signalSummary || "(none)"}

EXCLUDE (already recommended or played — never return these):
${exclude.map((t) => `- ${t}`).join("\n") || "(none)"}

Return a JSON object: { "tracks": [{ "title": string, "artist": string, "role": string, "reason": string }] } with exactly ${count} items.`;


    let parsed: any = {};
    let provider = "lovable";
    try {
      const res = await chatJson<any>({ system, user, json: true, temperature: 0.9 });
      parsed = res.data ?? {};
      provider = res.provider;
    } catch (e) {
      if (e instanceof LlmUnavailableError) {
        console.error("[ai-recommend] all providers failed", e.details);
        return json({ tracks: [], unavailable: true, reason: e.reason, details: e.details });
      }
      throw e;
    }

    const tracks = Array.isArray(parsed?.tracks)
      ? parsed.tracks
      : Array.isArray(parsed) ? parsed : [];
    const seen = new Set<string>();
    const cleaned = tracks
      .map((t: any) => ({
        title: String(t?.title ?? "").trim(),
        artist: String(t?.artist ?? "").trim(),
        role: String(t?.role ?? "related").trim().toLowerCase().slice(0, 20),
        reason: String(t?.reason ?? "").trim().slice(0, 140),
      }))
      .filter((t: any) => {
        if (!t.title || !t.artist) return false;
        const k = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

    return json({ tracks: cleaned, provider });

  } catch (e) {
    console.error(e);
    return json({ error: "internal", message: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractJson(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}
