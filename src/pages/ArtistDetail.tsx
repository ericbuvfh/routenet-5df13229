import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Shuffle, Heart, MoreHorizontal, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Track, Artist } from "@/data/mockData";
const PLACEHOLDER_ART = "/placeholder.svg";
import { usePlayer } from "@/context/PlayerContext";
import { TrackCard } from "@/components/cards/TrackCard";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDeezerArtist, useArtistDetails } from "@/hooks/useMusicSearch";
import { usePreloadYouTube } from "@/hooks/usePreloadYouTube";
import { toggleLikedArtist, getLikedArtists } from "@/pages/Library";
import { toast } from "sonner";
import { formatExactNumber } from "@/utils/formatExactNumber";
import { toTitleCase } from "@/utils/toTitleCase";
import { supabase } from "@/integrations/supabase/client";

interface Release {
  id: string;
  name: string;
  artwork: string;
  year: string;
  type: "album" | "single" | "ep";
}

/** Songs where the artist appears as a guest / feature rather than the lead. */
function useCollaborations(artistName: string) {
  return useQuery({
    queryKey: ["artist-collabs", artistName],
    enabled: !!artistName,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<Track[]> => {
      const { data } = await supabase.functions.invoke("deezer", {
        body: { action: "searchTrack", params: { query: `${artistName} feat`, limit: 40 } },
      });
      const rows: any[] = data?.data || [];
      const norm = (s: string) => (s || "").toLowerCase().trim();
      const seen = new Set<string>();
      return rows
        .filter((t) => {
          const lead = norm(t?.artist?.name);
          const title = norm(t?.title);
          const me = norm(artistName);
          const guest = lead !== me && (title.includes(me) || title.includes("feat"));
          if (!guest) return false;
          const key = `${title}::${lead}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 12)
        .map((t) => ({
          id: `deezer-${t.id}`,
          title: t.title,
          artist: t.artist?.name || artistName,
          album: t.album?.title || "",
          artwork: t.album?.cover_medium || t.album?.cover || "",
          duration: t.duration || 180,
        })) as Track[];
    },
  });
}

/** Official music videos from YouTube. */
function useArtistVideos(artistName: string) {
  return useQuery({
    queryKey: ["artist-videos", artistName],
    enabled: !!artistName,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("youtube", {
        body: { action: "search", params: { query: `${artistName} official music video`, maxResults: 12 } },
      });
      const items: any[] = data?.items || data?.results || data?.videos || (Array.isArray(data) ? data : []);
      return items
        .filter((v) => v?.id && (v.duration ?? 0) < 20 * 60)
        .slice(0, 10)
        .map((v) => ({
          id: String(v.id),
          title: String(v.title || ""),
          thumbnail: v.thumbnail || PLACEHOLDER_ART,
          channelTitle: v.channelTitle || artistName,
          duration: v.duration || 0,
        }));
    },
  });
}

const ArtistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { play, setQueue, playVideo } = usePlayer();
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);

  const artistName = decodeURIComponent(id || "");
  const { data: deezerData, isLoading: loadingDeezer } = useDeezerArtist(artistName);
  const { data: apiData, isLoading: loadingApi } = useArtistDetails(artistName);
  const { data: collaborations } = useCollaborations(artistName);
  const { data: videos } = useArtistVideos(artistName);
  const isLoading = loadingDeezer || loadingApi;

  const artist = deezerData?.artist ? {
    id: deezerData.artist.id.toString(), name: deezerData.artist.name,
    avatar: deezerData.artist.picture, monthlyListeners: deezerData.artist.nb_fan || 0,
    bio: apiData?.artist?.bio, genre: apiData?.artist?.genre, country: apiData?.artist?.country,
    banner: apiData?.artist?.banner || deezerData.artist.picture,
  } : apiData?.artist ? {
    id: apiData.artist.id, name: apiData.artist.name, avatar: apiData.artist.avatar,
    monthlyListeners: apiData.artist.monthlyListeners || 0, bio: apiData.artist.bio,
    genre: apiData.artist.genre, country: apiData.artist.country, banner: apiData.artist.banner,
  } : null;

  useEffect(() => {
    if (artist) setIsFollowing(getLikedArtists().some((a) => a.name === artist.name));
  }, [artist]);

  const deezerTracks: (Track & { rank?: number })[] = (deezerData?.tracks || []).map((t: any) => ({
    id: `deezer-${t.id}`, title: t.title, artist: t.artist?.name || artistName,
    album: t.album?.title || "unknown album", artwork: t.album?.cover_medium || t.album?.cover || artist?.avatar || "",
    duration: t.duration || 180, rank: t.rank || 0,
  }));

  const apiTracks: Track[] = apiData?.topTracks?.map((t) => ({
    id: t.id, title: t.title, artist: t.artist, album: t.album || "unknown album",
    artwork: t.artwork || artist?.avatar || "", duration: t.duration || 180,
  })) || [];

  const allTracks = deezerTracks.length > 0 ? deezerTracks : apiTracks;
  const displayedTracks = showAllTracks ? allTracks : allTracks.slice(0, 5);

  usePreloadYouTube(displayedTracks, displayedTracks.length > 0);

  // Deezer marks each release as album / single / ep — split them into sections.
  const releases: Release[] = useMemo(() => {
    const raw = (deezerData?.albums || []) as any[];
    if (raw.length) {
      const seen = new Set<string>();
      return raw
        .filter((a) => {
          const k = (a.title || "").toLowerCase().trim();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((a) => ({
          id: a.id.toString(),
          name: a.title,
          artwork: a.cover_medium || a.cover || PLACEHOLDER_ART,
          year: a.release_date?.split("-")[0] || "",
          type: (a.record_type === "single" ? "single" : a.record_type === "ep" ? "ep" : "album") as Release["type"],
        }))
        .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    }
    return (apiData?.albums || []).map((a, i) => ({
      id: a.id, name: a.name, artwork: a.artwork || PLACEHOLDER_ART,
      year: a.year || String(2024 - i), type: "album" as const,
    }));
  }, [deezerData?.albums, apiData?.albums]);

  const albums = releases.filter((r) => r.type === "album").slice(0, 12);
  const epsAndSingles = releases.filter((r) => r.type !== "album").slice(0, 12);

  const similarArtists: Artist[] = apiData?.similar?.map((s) => ({
    id: s.id, name: s.name, avatar: s.avatar || PLACEHOLDER_ART, monthlyListeners: s.monthlyListeners || 0,
  })) || [];

  if (!artist && !isLoading) return <div className="flex h-full items-center justify-center"><p className="text-muted-foreground">artist not found</p></div>;
  if (isLoading && !artist) return <div className="flex h-full items-center justify-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-muted-foreground">loading artist...</p></div>;

  const handlePlayAll = () => { if (allTracks.length) { setQueue(allTracks); play(allTracks[0]); } };
  const handleShuffle = () => { if (allTracks.length) { const s = [...allTracks].sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); } };

  const handleLike = () => {
    if (!artist) return;
    const result = toggleLikedArtist({ name: artist.name, avatar: artist.avatar });
    setIsFollowing(result);
    toast.success(result ? `${artist.name} added to library` : `${artist.name} removed from library`);
  };

  const bannerImage = (artist as any)?.banner || artist?.avatar;

  const ReleaseRow = ({ title, items, delay }: { title: string; items: Release[]; delay: number }) => (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="mb-8 px-4">
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-hide">
        {items.map((r) => (
          <motion.div key={r.id} whileTap={{ scale: 0.98 }} onClick={() => navigate(`/album/${r.id}`)} className="w-40 flex-shrink-0 cursor-pointer">
            <img src={r.artwork} alt={r.name} className="h-40 w-40 rounded-md object-cover" onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_ART; }} />
            <h3 className="mt-2 truncate font-semibold">{toTitleCase(r.name)}</h3>
            <p className="text-sm text-muted-foreground">{[r.year, toTitleCase(r.type)].filter(Boolean).join(" · ")}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );

  return (
    <div className="min-h-full pb-32">
      <div className="relative h-80 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bannerImage})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-background" />
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => navigate(-1)}
          className="absolute left-4 top-4 rounded-full bg-black/40 p-2 transition-colors hover:bg-black/60">
          <ArrowLeft className="h-5 w-5" />
        </motion.button>
        {isLoading && (
          <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /><span className="text-xs">updating...</span>
          </div>
        )}
        <div className="absolute bottom-6 left-4 right-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary"><Check className="h-3 w-3 text-black" /></div>
              <span className="text-xs text-muted-foreground">Verified Artist</span>
              {(artist as any)?.genre && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">{toTitleCase((artist as any).genre)}</span>}
            </div>
            <h1 className="mb-2 text-4xl font-bold">{toTitleCase(artist?.name || "")}</h1>
            <p className="text-sm text-muted-foreground">
              {[formatExactNumber(artist?.monthlyListeners || 0) + " fans", (artist as any)?.country].filter(Boolean).join(" · ")}
            </p>
          </motion.div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center gap-4 px-4 py-4">
        <Button onClick={handlePlayAll} size="lg" disabled={allTracks.length === 0} className="h-14 w-14 rounded-full bg-primary font-semibold text-black hover:bg-primary/90">
          <Play className="ml-1 h-6 w-6 fill-current" />
        </Button>
        <Button onClick={handleShuffle} variant="ghost" size="icon" disabled={allTracks.length === 0} className="text-primary hover:text-primary/80">
          <Shuffle className="h-6 w-6" />
        </Button>
        <Button onClick={handleLike} variant={isFollowing ? "secondary" : "outline"} className="gap-2 rounded-full border-muted-foreground/50 px-6">
          <Heart className={`h-4 w-4 ${isFollowing ? "fill-primary text-primary" : ""}`} />
          {isFollowing ? "liked" : "like"}
        </Button>
        <Button variant="ghost" size="icon"><MoreHorizontal className="h-6 w-6" /></Button>
      </motion.div>

      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-8 px-4">
        <h2 className="mb-4 text-xl font-bold">Popular</h2>
        {allTracks.length > 0 ? (
          <div className="space-y-1">
            {displayedTracks.map((track, index) => (
              <TrackCard key={track.id} track={track} index={index} showIndex contextTracks={allTracks} hideStreams />
            ))}
          </div>
        ) : !isLoading ? <p className="py-4 text-sm text-muted-foreground">No tracks available</p> : null}
        {allTracks.length > 5 && (
          <button onClick={() => setShowAllTracks(!showAllTracks)} className="mt-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
            {showAllTracks ? "Show less" : "See more"}
          </button>
        )}
      </motion.section>

      {albums.length > 0 && <ReleaseRow title="Albums" items={albums} delay={0.35} />}
      {epsAndSingles.length > 0 && <ReleaseRow title="EPs & Singles" items={epsAndSingles} delay={0.4} />}

      {!!collaborations?.length && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mb-8 px-4">
          <h2 className="mb-4 text-xl font-bold">Collaborations</h2>
          <div className="space-y-1">
            {collaborations.map((track, index) => (
              <TrackCard key={track.id} track={track} index={index} contextTracks={collaborations} hideStreams />
            ))}
          </div>
        </motion.section>
      )}

      {!!videos?.length && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-8 px-4">
          <h2 className="mb-4 text-xl font-bold">Music videos</h2>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-hide">
            {videos.map((v) => (
              <motion.button
                key={v.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => playVideo({ id: `yt-${v.id}`, title: v.title, artist: v.channelTitle, youtubeId: v.id, thumbnail: v.thumbnail, duration: v.duration })}
                className="w-60 flex-shrink-0 text-left"
              >
                <img src={v.thumbnail} alt={v.title} className="h-32 w-60 rounded-md object-cover" onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_ART; }} />
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold">{v.title}</h3>
                <p className="text-xs text-muted-foreground">{v.channelTitle}</p>
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}

      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mb-8 px-4">
        <h2 className="mb-4 text-xl font-bold">About</h2>
        <div className="relative overflow-hidden rounded-lg">
          <img src={artist?.avatar} alt={artist?.name} className="h-48 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_ART; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-sm leading-relaxed text-foreground/90">{(artist as any)?.bio || `${artist?.name} is a popular artist with a dedicated fanbase.`}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {formatExactNumber(artist?.monthlyListeners || 0)} fans · {releases.length} releases
              {(artist as any)?.genre ? ` · ${toTitleCase((artist as any).genre)}` : ""}
            </p>
          </div>
        </div>
      </motion.section>

      {similarArtists.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mb-8 px-4">
          <h2 className="mb-4 text-xl font-bold">Fans Also Like</h2>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-hide">
            {similarArtists.map((ra) => (
              <motion.div key={ra.id} whileTap={{ scale: 0.98 }} onClick={() => navigate(`/artist/${encodeURIComponent(ra.name)}`)} className="w-32 flex-shrink-0 cursor-pointer">
                <img src={ra.avatar} alt={ra.name} className="h-32 w-32 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_ART; }} />
                <h3 className="mt-2 truncate text-center text-sm font-semibold">{toTitleCase(ra.name)}</h3>
                <p className="text-center text-xs text-muted-foreground">Artist</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="px-4 pb-8 text-center text-[10px] text-muted-foreground">
        Data provided by Deezer, Last.fm & TheAudioDB
      </motion.p>
    </div>
  );
};

export default ArtistDetail;
