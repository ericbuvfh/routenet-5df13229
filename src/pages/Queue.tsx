import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Play, X, Music2, Shuffle, ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePlayer } from "@/context/PlayerContext";
import { formatDuration, Track } from "@/data/mockData";
import { createPlaylist, addTracksToPlaylist } from "@/services/playlistService";

export default function Queue() {
  const navigate = useNavigate();
  const { currentTrack, queue, setQueue, isPlaying, play, toggleShuffle, shuffle } = usePlayer();
  const [saving, setSaving] = useState(false);

  const removeFromQueue = (trackId: string) => {
    setQueue(queue.filter((t) => t.id !== trackId));
  };

  const playTrack = (track: Track) => play(track);

  const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
  const upNext = queue.slice(currentIndex + 1);
  const played = currentIndex > 0 ? queue.slice(0, currentIndex) : [];

  /** Save everything currently in the queue as a brand new playlist. */
  const saveQueueAsPlaylist = async () => {
    if (!queue.length || saving) return;
    setSaving(true);
    try {
      const name = `Queue • ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
      const playlist = await createPlaylist(name, `${queue.length} songs saved from your queue`);
      if (!playlist) throw new Error("create failed");
      const ok = await addTracksToPlaylist(
        playlist.id,
        queue.map((t) => ({
          title: t.title,
          artist: t.artist,
          album: t.album,
          artwork: t.artwork,
          duration: t.duration,
        })),
      );
      if (!ok) throw new Error("add failed");
      toast.success(`Saved ${queue.length} songs as "${name}"`);
    } catch {
      toast.error("Could not save the queue as a playlist");
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
        <button
          onClick={toggleShuffle}
          className={`rounded-full p-2 ${shuffle ? "text-primary" : "text-muted-foreground"}`}
        >
          <Shuffle className="h-5 w-5" />
        </button>
      </motion.header>

      <div className="px-4">
        {queue.length > 0 && (
          <button
            onClick={saveQueueAsPlaylist}
            disabled={saving}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-[14px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
            Save as playlist
          </button>
        )}
        {/* Now Playing */}
        {currentTrack && (
          <section className="mb-4">
            <h2 className="mb-2 text-[20px] font-extrabold tracking-tight text-foreground">Now playing</h2>
            <div className="flex items-center gap-3 py-2">
              <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[3px] bg-muted/30">
                <img src={currentTrack.artwork} alt="" className="h-full w-full object-cover" />
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
                    <img src={track.artwork} alt="" loading="lazy" className="h-full w-full object-cover" />
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
                  <img
                    src={track.artwork}
                    alt=""
                    loading="lazy"
                    className="h-[52px] w-[52px] shrink-0 rounded-[3px] bg-muted/30 object-cover"
                  />
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
    </div>
  );
}
