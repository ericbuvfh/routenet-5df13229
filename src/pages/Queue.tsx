import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Play, X, Music2, Shuffle, ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePlayer } from "@/context/PlayerContext";
import { formatDuration, Track } from "@/data/mockData";
import { TrackArtwork, resolvedTrackArtwork } from "@/components/media/TrackArtwork";
import { createPlaylist, addTracksToPlaylist } from "@/services/playlistService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Queue() {
  const navigate = useNavigate();
  const { currentTrack, queue, setQueue, isPlaying, play, toggleShuffle, shuffle } = usePlayer();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const removeFromQueue = (trackId: string) => {
    setQueue(queue.filter((t) => t.id !== trackId));
  };

  const playTrack = (track: Track) => play(track);

  const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
  const upNext = queue.slice(currentIndex + 1);
  const played = currentIndex > 0 ? queue.slice(0, currentIndex) : [];

  const openSave = () => {
    setName(`Queue • ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
    setSaveOpen(true);
  };

  const saveQueueAsPlaylist = async () => {
    if (!queue.length || saving) return;
    setSaving(true);
    try {
      // Dedupe by title+artist, keeping the queue order.
      const seen = new Set<string>();
      const ordered = queue.filter((t) => {
        const k = `${(t.title || "").toLowerCase()}|${(t.artist || "").toLowerCase()}`;
        if (!k.trim() || seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // First song in the playlist becomes the cover art.
      const cover = resolvedTrackArtwork(ordered[0]);
      const created = await createPlaylist(name.trim() || "My queue", `${ordered.length} songs saved from the queue`, false, cover);
      if (!created) throw new Error("create failed");

      await addTracksToPlaylist(
        created.id,
        ordered.map((t) => ({
          title: t.title,
          artist: t.artist,
          album: t.album,
          artwork: resolvedTrackArtwork(t),
          duration: t.duration,
          preview: (t as any).preview,
        })),
      );

      setSaveOpen(false);
      toast.success("Queue saved as a playlist");
      navigate(`/user-playlist/${created.id}`);
    } catch {
      toast.error("Couldn't save the queue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="custom-scrollbar min-h-screen overflow-y-auto pb-24">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-20 flex items-center justify-between bg-background/80 px-4 pb-3 pt-12 backdrop-blur-xl"
      >
        <button onClick={() => navigate(-1)} className="rounded-full p-2 text-foreground hover:bg-white/10">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-[16px] font-bold text-foreground">Queue</h1>
        <div className="flex items-center">
          <button
            onClick={openSave}
            disabled={queue.length === 0}
            aria-label="Save queue as playlist"
            className="rounded-full p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ListPlus className="h-5 w-5" />
          </button>
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle queue"
            className={`rounded-full p-2 ${shuffle ? "text-primary" : "text-muted-foreground"}`}
          >
            <Shuffle className="h-5 w-5" />
          </button>
        </div>
      </motion.header>

      <div className="px-4">
        {queue.length > 0 && (
          <button
            onClick={openSave}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/12 py-2.5 text-[13px] font-semibold text-foreground hover:bg-white/5"
          >
            <ListPlus className="h-4 w-4" />Save queue as playlist
          </button>
        )}

        {/* Now Playing */}
        {currentTrack && (
          <section className="mb-4">
            <h2 className="mb-2 text-[20px] font-extrabold tracking-tight text-foreground">Now playing</h2>
            <div className="flex items-center gap-3 py-2">
              <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[3px] bg-muted/30">
                <TrackArtwork track={currentTrack} loading="eager" className="h-full w-full" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  {isPlaying ? (
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="h-3.5 w-[3px] rounded-full bg-primary"
                          animate={{ scaleY: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Play className="h-5 w-5 text-white" fill="currentColor" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-normal leading-tight text-primary">{currentTrack.title}</p>
                <p className="mt-1 truncate text-[13px] text-muted-foreground">Song • {currentTrack.artist}</p>
              </div>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                {formatDuration(currentTrack.duration)}
              </span>
            </div>
          </section>
        )}

        {/* Up Next */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[20px] font-extrabold tracking-tight text-foreground">Next up</h2>
            <span className="text-[12px] text-muted-foreground">{upNext.length} songs</span>
          </div>

          {upNext.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Music2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Your queue is empty</p>
              <p className="mt-1 text-sm text-muted-foreground/70">Add songs to play next</p>
            </div>
          ) : (
            <div>
              {upNext.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  onClick={() => playTrack(track)}
                  className="group flex cursor-pointer items-center gap-3 py-2"
                >
                  <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[3px] bg-muted/30">
                    <TrackArtwork track={track} className="h-full w-full" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Play className="h-5 w-5 text-white" fill="currentColor" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-normal leading-tight text-foreground">{track.title}</p>
                    <p className="mt-1 truncate text-[13px] text-muted-foreground">Song • {track.artist}</p>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    {formatDuration(track.duration)}
                  </span>
                  <button
                    aria-label={`Remove ${track.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(track.id);
                    }}
                    className="shrink-0 p-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Previously Played */}
        {played.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[20px] font-extrabold tracking-tight text-foreground">Previously played</h2>
            <div className="opacity-60">
              {played.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  onClick={() => playTrack(track)}
                  className="flex cursor-pointer items-center gap-3 py-2"
                >
                  <TrackArtwork track={track} className="h-[52px] w-[52px] shrink-0 rounded-[3px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-normal leading-tight text-foreground">{track.title}</p>
                    <p className="mt-1 truncate text-[13px] text-muted-foreground">Song • {track.artist}</p>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    {formatDuration(track.duration)}
                  </span>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Dialog open={saveOpen} onOpenChange={(o) => !saving && setSaveOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save queue as playlist</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            {queue[0] && <TrackArtwork track={queue[0]} className="h-14 w-14 rounded-md" />}
            <p className="text-sm text-muted-foreground">{queue.length} songs · the first song becomes the cover</p>
          </div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name" autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveQueueAsPlaylist} disabled={saving || !name.trim()}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
