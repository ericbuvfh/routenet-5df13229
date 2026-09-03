import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Settings, Music, ChevronRight, Play, ChevronLeft, Plus, X, Search as SearchIcon, Heart, ListMusic, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getUserPlaylists } from "@/services/playlistService";
import { Track } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import { useOnboardingPrefs } from "@/hooks/useOnboardingPrefs";
import { useLikedSongs, likedSongToTrack } from "@/hooks/useLikedSongs";
import { useListeningHistory } from "@/hooks/useListeningHistory";
import { toTitleCase } from "@/utils/toTitleCase";

/** Persist followed artists back into onboarding prefs (local + profile row). */
async function saveFollowedArtists(artists: string[]) {
  let base: any = {};
  try { base = JSON.parse(localStorage.getItem("onboarding") || "{}") || {}; } catch { base = {}; }
  const next = { ...base, artists };
  try { localStorage.setItem("onboarding", JSON.stringify(next)); } catch { /* ignore */ }
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) {
      await supabase.from("profiles").update({ bio: JSON.stringify(next) }).eq("user_id", data.user.id);
    }
  } catch { /* offline is fine — local copy still wins */ }
  window.dispatchEvent(new Event("prefs-updated"));
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, setQueue } = usePlayer();
  const { prefs } = useOnboardingPrefs();
  const { songs: liked } = useLikedSongs();
  const { history } = useListeningHistory();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [followed, setFollowed] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  const { data: playlists } = useQuery({ queryKey: ["user-playlists"], queryFn: getUserPlaylists });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data as any); });
  }, [user]);

  useEffect(() => { setFollowed(prefs?.artists || []); }, [prefs?.artists]);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "You";

  const likedTracks: Track[] = useMemo(() => liked.map(likedSongToTrack), [liked]);

  /** Top artists ranked by real plays, then likes, then followed artists. */
  const topArtists = useMemo(() => {
    const counts = new Map<string, { name: string; plays: number; artwork?: string }>();
    const bump = (name: string, artwork: string | undefined, weight: number) => {
      if (!name) return;
      const key = name.toLowerCase();
      const prev = counts.get(key);
      counts.set(key, { name, plays: (prev?.plays || 0) + weight, artwork: prev?.artwork || artwork });
    };
    history.forEach((t) => bump(t.artist, t.artwork, 2));
    likedTracks.forEach((t) => bump(t.artist, t.artwork, 3));
    followed.forEach((a) => bump(a, undefined, 1));
    return Array.from(counts.values()).sort((a, b) => b.plays - a.plays).slice(0, 8);
  }, [history, likedTracks, followed]);

  const topSong = history[0] || likedTracks[0];
  const minutes = Math.round(history.reduce((sum, t) => sum + (t.duration || 210), 0) / 60);

  const persona = useMemo(() => {
    const g = prefs?.genres?.[0];
    const sg = prefs?.subgenres?.[0];
    if (!g && !topArtists.length) return "Curious Listener";
    return `${sg || g || "Eclectic"} ${history.length > 40 ? "Devotee" : "Explorer"}`;
  }, [prefs, topArtists.length, history.length]);

  const removeArtist = (name: string) => {
    const next = followed.filter((a) => a.toLowerCase() !== name.toLowerCase());
    setFollowed(next);
    saveFollowedArtists(next);
  };

  const addArtist = (name: string) => {
    if (followed.some((a) => a.toLowerCase() === name.toLowerCase())) return;
    const next = [...followed, name];
    setFollowed(next);
    saveFollowedArtists(next);
  };

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-28">
      {/* Hero */}
      <div className="relative overflow-hidden pb-6">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--primary) / 0.55) 0%, hsl(var(--primary) / 0.18) 45%, hsl(var(--background)) 100%)" }} />
        <div className="relative z-10 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="mb-4 flex w-full items-center justify-between px-4">
            <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-1.5 text-foreground/80"><ChevronLeft className="h-5 w-5" /></button>
            <span className="text-[13px] font-semibold text-foreground/80">Profile</span>
            <button onClick={() => navigate("/settings")} aria-label="Settings" className="rounded-full p-1.5 text-foreground/80"><Settings className="h-5 w-5" /></button>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-foreground/20 bg-secondary shadow-[0_16px_40px_-12px_hsl(0_0%_0%/0.8)]">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-extrabold text-muted-foreground">{displayName.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">Pro</span>
            </div>
            <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-foreground">{displayName}</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{followed.length} artists followed • {playlists?.length || 0} playlists</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4">
        {/* Music persona */}
        <section className="rounded-2xl border border-border/40 bg-card/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Music persona</p>
          <h2 className="mt-1 text-[20px] font-extrabold text-foreground">{persona}</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-[18px] font-extrabold text-foreground">{liked.length}</p><p className="text-[11px] text-muted-foreground">Liked</p></div>
            <div><p className="text-[18px] font-extrabold text-foreground">{history.length}</p><p className="text-[11px] text-muted-foreground">Plays</p></div>
            <div><p className="text-[18px] font-extrabold text-foreground">{minutes}</p><p className="text-[11px] text-muted-foreground">Minutes</p></div>
          </div>
        </section>

        {/* Top song / top artist */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/40 bg-card/60 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top song</p>
            {topSong ? (
              <button onClick={() => { setQueue(history.length ? history : likedTracks); play(topSong); }} className="w-full text-left">
                <img src={topSong.artwork} alt="" className="aspect-square w-full rounded-xl object-cover" />
                <p className="mt-2 truncate text-[13px] font-bold text-foreground">{toTitleCase(topSong.title)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{toTitleCase(topSong.artist)}</p>
              </button>
            ) : <p className="text-[12px] text-muted-foreground">Play something to see this.</p>}
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/60 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top artist</p>
            {topArtists[0] ? (
              <button onClick={() => navigate(`/artist/${encodeURIComponent(topArtists[0].name)}`)} className="w-full text-left">
                <div className="aspect-square w-full overflow-hidden rounded-full bg-secondary">
                  {topArtists[0].artwork ? <img src={topArtists[0].artwork} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <p className="mt-2 truncate text-center text-[13px] font-bold text-foreground">{toTitleCase(topArtists[0].name)}</p>
                <p className="truncate text-center text-[11px] text-muted-foreground">Artist</p>
              </button>
            ) : <p className="text-[12px] text-muted-foreground">No artists yet.</p>}
          </div>
        </section>

        {/* Top artists + add */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[18px] font-extrabold text-foreground">Top artists</h3>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-[12px] font-semibold text-foreground">
              <Plus className="h-3.5 w-3.5" /> Add artists
            </button>
          </div>
          {topArtists.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Follow artists to personalise your feed.</p>
          ) : (
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
              {topArtists.map((a) => (
                <div key={a.name} className="w-[92px] shrink-0 text-center">
                  <button onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)} className="w-full">
                    <div className="aspect-square w-full overflow-hidden rounded-full bg-secondary">
                      {a.artwork ? <img src={a.artwork} alt="" loading="lazy" className="h-full w-full object-cover" /> : (
                        <div className="flex h-full w-full items-center justify-center text-[20px] font-bold text-muted-foreground">{a.name.charAt(0)}</div>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-[12px] font-semibold text-foreground">{toTitleCase(a.name)}</p>
                  </button>
                  {followed.some((f) => f.toLowerCase() === a.name.toLowerCase()) && (
                    <button onClick={() => removeArtist(a.name)} className="text-[10px] text-muted-foreground hover:text-foreground">Unfollow</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recently played (real history) */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[18px] font-extrabold text-foreground">Recently played</h3>
            <button onClick={() => navigate("/recently-played")} className="text-[12px] font-semibold text-muted-foreground">See all</button>
          </div>
          {history.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nothing played yet.</p>
          ) : history.slice(0, 5).map((t) => (
            <motion.button key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={() => { setQueue(history); play(t); }}
              className="flex w-full items-center gap-3 py-2 text-left">
              <img src={t.artwork} alt="" loading="lazy" className="h-[52px] w-[52px] shrink-0 rounded-[4px] bg-secondary object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-foreground">{toTitleCase(t.title)}</p>
                <p className="truncate text-[13px] text-muted-foreground">{toTitleCase(t.artist)}</p>
              </div>
              <Play className="h-4 w-4 shrink-0 text-muted-foreground" fill="currentColor" />
            </motion.button>
          ))}
        </section>

        {/* Library shortcuts */}
        <section className="overflow-hidden rounded-2xl border border-border/40 bg-card/60">
          {[
            { label: `Liked songs (${liked.length})`, icon: Heart, to: "/liked-songs" },
            { label: `Your playlists (${playlists?.length || 0})`, icon: ListMusic, to: "/library" },
            { label: "Listening history", icon: Clock, to: "/recently-played" },
            { label: "Settings", icon: Settings, to: "/settings" },
          ].map(({ label, icon: Icon, to }) => (
            <button key={label} onClick={() => navigate(to)} className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/10">
              <span className="flex items-center gap-3 text-[14px] font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" />{label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </section>
      </div>

      {addOpen && <AddArtistsSheet followed={followed} onAdd={addArtist} onRemove={removeArtist} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

/** Search Deezer artists and follow them straight into the taste profile. */
function AddArtistsSheet({ followed, onAdd, onRemove, onClose }: {
  followed: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 350); return () => clearTimeout(t); }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["profile-artist-search", debounced],
    queryFn: async () => {
      const { searchArtists, transformArtist } = await import("@/services/deezer");
      const raw = await searchArtists(debounced, 20);
      return (raw || []).map(transformArtist);
    },
    enabled: debounced.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[18px] font-extrabold text-foreground">Add artists</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-full bg-muted/30 px-3 py-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search artists"
            className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none" />
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="h-12 w-12 animate-pulse rounded-full bg-muted/30" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted/30" />
              </div>
            ))}
          </div>
        )}

        {(data || []).map((a: any) => {
          const isFollowed = followed.some((f) => f.toLowerCase() === a.name.toLowerCase());
          return (
            <div key={a.id} className="flex items-center gap-3 py-2">
              <img src={a.picture} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full bg-muted/30 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-foreground">{a.name}</p>
                <p className="truncate text-[12px] text-muted-foreground">{a.fans ? `${a.fans.toLocaleString()} fans` : "Artist"}</p>
              </div>
              <button onClick={() => (isFollowed ? onRemove(a.name) : onAdd(a.name))}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold ${isFollowed ? "border border-border text-foreground" : "bg-primary text-primary-foreground"}`}>
                {isFollowed ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}

        {!isLoading && debounced.length >= 2 && !(data || []).length && (
          <p className="py-6 text-center text-[13px] text-muted-foreground">No artists found.</p>
        )}
        {debounced.length < 2 && !isLoading && (
          <div className="pt-2">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Following</p>
            <div className="flex flex-wrap gap-2">
              {followed.length === 0 && <p className="text-[13px] text-muted-foreground">Nobody yet — search above.</p>}
              {followed.map((f) => (
                <button key={f} onClick={() => onRemove(f)} className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-[12px] text-foreground">
                  {f} <X className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
