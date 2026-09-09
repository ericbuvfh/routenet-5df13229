import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownCircle, ChevronDown, Heart, Loader2, ListMusic, Mic2, MoreHorizontal, Pause, Play, Plus, Repeat, Repeat1, Share2, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AddToPlaylistDialog } from "@/components/AddToPlaylistDialog";
import { ShareSheet } from "@/components/ShareSheet";
import { getCachedYouTubeId, seekGlobalAudio } from "@/components/player/GlobalAudioPlayer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/context/PlayerContext";
import { cn } from "@/lib/utils";
import { SyncedVideoPanel } from "@/components/nowplaying/SyncedVideoPanel";
import { lookupMeta, peekMeta, type DeezerMeta } from "@/services/metadataEnrichment";

import { toTitleCase } from "@/utils/toTitleCase";

/** Progress ring geometry (viewBox is 100x100). */
const RING_R = 47;
const RING_C = 2 * Math.PI * RING_R;

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}


export default function NowPlaying() {
  const navigate = useNavigate();
  const { currentTrack, duration, isPlaying, next, nextTrack, previous, progress, queue, repeat, seek, shuffle, togglePlay, toggleRepeat, toggleShuffle } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);
  const [showMore, setShowMore] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "done" | "failed">("idle");
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  /** Deezer metadata for the current song (title / artist / album / hi-res art). */
  const [meta, setMeta] = useState<DeezerMeta | null>(null);

  useEffect(() => setLocalProgress(progress), [progress]);
  // Snap the ring back to zero the instant the user skips forward/back.
  useEffect(() => setLocalProgress(0), [currentTrack?.id]);

  // Now Playing shows Deezer metadata when it resolves; YouTube data is the fallback.
  useEffect(() => {
    if (!currentTrack) { setMeta(null); return; }
    let alive = true;
    setMeta(peekMeta(currentTrack.title, currentTrack.artist) ?? null);
    lookupMeta(currentTrack.title, currentTrack.artist)
      .then((m) => { if (alive) setMeta(m); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [currentTrack?.title, currentTrack?.artist]);

  const display = useMemo(() => ({
    title: meta?.title || currentTrack?.title || "",
    artist: meta?.artist || currentTrack?.artist || "",
    album: meta?.album || currentTrack?.album || "",
    artwork: meta?.artwork || currentTrack?.artwork || "",
  }), [meta, currentTrack]);


  useEffect(() => {
    const compute = () => {
      if (!currentTrack) {
        setLiked(false);
        return;
      }
      try {
        const likedSongs = JSON.parse(localStorage.getItem("tunestream_liked_songs") || "[]");
        setLiked(likedSongs.some((song: any) => song.title === currentTrack.title && song.artist === currentTrack.artist));
      } catch {
        setLiked(false);
      }
    };
    compute();
    window.addEventListener("liked-updated", compute);
    return () => window.removeEventListener("liked-updated", compute);
  }, [currentTrack?.artist, currentTrack?.title]);

  const isResolving = useMemo(() => !!currentTrack && !currentTrack.youtubeId && !getCachedYouTubeId(currentTrack.title, currentTrack.artist), [currentTrack]);
  const videoId = useMemo(
    () => currentTrack?.youtubeId || getCachedYouTubeId(currentTrack?.title || "", currentTrack?.artist || "") || "",
    [currentTrack],
  );
  const actualDuration = duration || currentTrack?.duration || 0;
  const currentTime = Math.floor(localProgress * actualDuration);

  const handleSeek = useCallback((newProgress: number) => {
    seek(newProgress);
    setLocalProgress(newProgress);
    if (actualDuration > 0) seekGlobalAudio(newProgress * actualDuration);
  }, [actualDuration, seek]);

  const handleToggleLike = useCallback(() => {
    if (!currentTrack) return;
    import("@/pages/Library").then(({ toggleLikedSong }) => setLiked(toggleLikedSong(currentTrack)));
  }, [currentTrack]);

  const handleDownload = useCallback(async () => {
    if (!currentTrack || downloadStatus === "downloading") return;
    setDownloadStatus("downloading");
    setDownloadPercent(0);
    const mod = await import("@/services/downloadService");
    const ok = await mod.downloadTrack(currentTrack, (p) => setDownloadPercent(p));
    setDownloadStatus(ok ? "done" : "failed");
    if (ok) toast.success("Downloaded to offline library");
    else toast.error(mod.lastDownloadError || "Download failed");
  }, [currentTrack, downloadStatus]);

  if (!currentTrack) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <p className="text-lg font-extrabold text-foreground">No track playing</p>
          <Button onClick={() => navigate("/")} className="mt-4 rounded-full">Go Home</Button>
        </div>
      </main>
    );
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-20 flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-background text-foreground">
      <AnimatePresence mode="wait">
        <motion.div
          key={bgColor}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="pointer-events-none absolute inset-0"
          style={{ background: bgColor }}
        />
      </AnimatePresence>

      {/* Top bar — centred title + artist */}
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back" className="rounded-full text-foreground hover:bg-foreground/10">
          <ChevronDown className="h-6 w-6" />
        </Button>
        <motion.div
          key={currentTrack.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="min-w-0 flex-1 text-center"
        >
          <h1 className="truncate text-[16px] font-bold leading-tight text-foreground">{toTitleCase(display.title)}</h1>
          <button onClick={() => navigate(`/artist/${encodeURIComponent(display.artist)}`)} className="mx-auto block max-w-full truncate text-[12px] font-normal text-muted-foreground transition-colors hover:text-foreground">
            {toTitleCase(display.artist)}
          </button>
        </motion.div>
        <Button variant="ghost" size="icon" onClick={() => setShowMore(true)} aria-label="More" className="rounded-full text-foreground hover:bg-foreground/10">
          <MoreHorizontal className="h-6 w-6" />
        </Button>
      </header>

      {/* Old-school vinyl artwork inside a progress ring */}
      <section className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-6 pb-2 pt-2">
        <motion.div
          key={currentTrack.id}
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="relative aspect-square w-[min(76vw,40dvh,320px)]"
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={RING_R} fill="none" stroke="hsl(var(--foreground) / 0.12)" strokeWidth="2.5" />
            <circle
              cx="50" cy="50" r={RING_R} fill="none"
              stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - Math.min(Math.max(localProgress, 0), 1))}
            />
          </svg>

          {/* Vinyl disc */}
          <motion.div
            className="absolute inset-[6%] overflow-hidden rounded-full album-shadow"
            style={{ background: "radial-gradient(circle at 50% 50%, hsl(0 0% 8%) 0%, hsl(0 0% 4%) 100%)" }}
            animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
            transition={isPlaying ? { duration: 14, repeat: Infinity, ease: "linear" } : { duration: 0.4 }}
          >
            {/* Grooves */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full opacity-70"
              style={{
                background:
                  "repeating-radial-gradient(circle at 50% 50%, hsl(0 0% 100% / 0.075) 0px, hsl(0 0% 100% / 0.075) 1px, transparent 1px, transparent 5px)",
              }}
            />
            {/* Sheen */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ background: "linear-gradient(115deg, hsl(0 0% 100% / 0.14) 0%, transparent 38%, transparent 62%, hsl(0 0% 100% / 0.08) 100%)" }}
            />
            {/* Centre label = artwork */}
            <div className="absolute inset-[14%] overflow-hidden rounded-full border border-foreground/15 bg-card shadow-[0_6px_20px_-6px_hsl(0_0%_0%/0.8)]">
              {isResolving ? (
                <div className="flex h-full w-full items-center justify-center bg-secondary">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : (
                <img src={display.artwork} alt={display.title} className="h-full w-full object-cover" />
              )}
            </div>
            {/* Spindle hole */}
            <div className="absolute left-1/2 top-1/2 h-[4.5%] w-[4.5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-[inset_0_0_3px_hsl(0_0%_0%/0.9)]" />
          </motion.div>
        </motion.div>
      </section>


      {/* Actions row */}
      <section className="relative z-10 shrink-0 px-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/queue")} aria-label="Open queue" className="rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
            <ListMusic className="h-[22px] w-[22px]" />
          </Button>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowPlaylistDialog(true)} aria-label="Add to playlist" className="rounded-full text-muted-foreground hover:bg-foreground/10">
              <Plus className="h-[22px] w-[22px]" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleToggleLike} aria-label="Like" className={cn("rounded-full text-muted-foreground hover:bg-foreground/10", liked && "text-primary")}>
              <Heart className="h-[22px] w-[22px]" fill={liked ? "currentColor" : "none"} />
            </Button>
          </div>
        </div>
      </section>


      {/* Control deck */}
      <section className="relative z-10 shrink-0 px-6 pt-3">
        <Slider
          value={[localProgress * 100]}
          max={100}
          step={0.05}
          aria-label="Seek"
          onValueChange={([value]) => handleSeek(value / 100)}
          className="py-1.5 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
        />
        <div className="mt-0.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
          <span aria-label="Elapsed time">{formatTime(currentTime)}</span>
          <span aria-label="Total time">{formatTime(actualDuration)}</span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle} className={cn("h-11 w-11 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground", shuffle && "text-primary")}>
            <Shuffle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={previous} aria-label="Previous track" className="h-12 w-12 rounded-full text-foreground transition-transform duration-150 hover:bg-foreground/10 active:scale-[0.82] active:bg-foreground/15">
            <SkipBack className="h-7 w-7" fill="currentColor" />
          </Button>
          <Button
            onClick={togglePlay}
            disabled={isResolving}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-foreground p-0 text-background shadow-[0_10px_30px_-10px_hsl(var(--foreground)/0.5)] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.88]"
          >
            {isResolving ? <Loader2 className="h-7 w-7 animate-spin" /> : isPlaying ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-1 h-7 w-7" fill="currentColor" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={next} aria-label="Next track" className="h-12 w-12 rounded-full text-foreground transition-transform duration-150 hover:bg-foreground/10 active:scale-[0.82] active:bg-foreground/15">
            <SkipForward className="h-7 w-7" fill="currentColor" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleRepeat} aria-label={`Repeat: ${repeat}`} className={cn("h-11 w-11 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground", repeat !== "off" && "text-primary")}>
            {repeat === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
          </Button>
        </div>

      </section>

      {/* Lyrics bar — anchored below every other control */}
      <section className="relative z-10 mt-auto shrink-0 px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-5 lg:pb-[6rem]">
        <button
          type="button"
          onClick={() => navigate("/lyrics")}
          className="flex w-full items-center justify-center rounded-xl bg-foreground/[0.07] px-4 py-3 transition-colors hover:bg-foreground/[0.12] active:scale-[0.99]"
        >
          <span className="flex items-center justify-center gap-2 text-center text-[14px] font-semibold text-foreground">
            <Mic2 className="h-4 w-4" /> Show Lyrics
          </span>
        </button>
      </section>

      <AnimatePresence>
        {showMore && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={() => setShowMore(false)} />
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-card p-4 shadow-elevated">
              <div className="mb-4 flex items-center gap-3">
                <img src={currentTrack.artwork} alt={currentTrack.title} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-foreground">{toTitleCase(currentTrack.title)}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">{toTitleCase(currentTrack.artist)}</p>
                </div>
              </div>
              <div className="grid gap-2">
                {[
                  { icon: Plus, label: "Add to Playlist", action: () => setShowPlaylistDialog(true) },
                  { icon: ListMusic, label: "Open Queue", action: () => navigate("/queue") },
                  { icon: ArrowDownCircle, label: downloadStatus === "done" ? "Downloaded" : "Download", action: handleDownload },
                  { icon: Share2, label: "Share", action: () => setShowShareSheet(true) },
                ].map(({ icon: Icon, label, action }) => (
                  <Button key={label} variant="ghost" onClick={() => { action(); setShowMore(false); }} className="justify-start rounded-xl px-3 text-sm font-bold">
                    <Icon className="h-4 w-4 text-primary" />{label}
                  </Button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVideo && videoId && (
          <SyncedVideoPanel
            videoId={videoId}
            title={display.title}
            startSeconds={currentTime}
            onClose={() => setShowVideo(false)}
          />
        )}
      </AnimatePresence>

      <ShareSheet isOpen={showShareSheet} onClose={() => setShowShareSheet(false)} item={{ type: "track", title: currentTrack.title, subtitle: currentTrack.artist, image: currentTrack.artwork, id: currentTrack.id }} />
      <AddToPlaylistDialog isOpen={showPlaylistDialog} onClose={() => setShowPlaylistDialog(false)} track={{ title: currentTrack.title, artist: currentTrack.artist, album: currentTrack.album, artwork: currentTrack.artwork, duration: currentTrack.duration }} />
    </motion.main>
  );
}
