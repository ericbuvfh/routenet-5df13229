import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1, Video, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer } from "@/context/PlayerContext";
import { useNavigate } from "react-router-dom";
import { getCachedYouTubeId } from "@/components/player/GlobalAudioPlayer";

export function MiniPlayer() {
  const {
    currentTrack, currentVideo, isPlaying, togglePlay,
    next, previous, progress, isVideoMode,
    shuffle, toggleShuffle, repeat, toggleRepeat,
  } = usePlayer();
  const navigate = useNavigate();

  const displayItem = isVideoMode ? currentVideo : currentTrack;
  if (!displayItem) return null;

  const artwork = isVideoMode ? (currentVideo?.thumbnail || "") : (currentTrack?.artwork || "");
  const title = isVideoMode ? (currentVideo?.title || "") : (currentTrack?.title || "");
  const subtitle = isVideoMode ? (currentVideo?.artist || "") : (currentTrack?.artist || "");
  const isResolving = !isVideoMode && currentTrack && !currentTrack.youtubeId && !getCachedYouTubeId(currentTrack.title, currentTrack.artist);

  const handleClick = () => navigate(isVideoMode ? "/video-player" : "/now-playing");
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="fixed bottom-14 left-0 right-0 z-40 px-2 pb-1"
      >
        <div onClick={handleClick} className="relative mx-auto flex min-h-[58px] max-w-xl cursor-pointer items-center gap-2 overflow-hidden rounded-xl bg-popover px-2 pb-1.5 pt-2.5 shadow-elevated">
          <div className="absolute inset-x-2.5 top-1 h-[2px] overflow-visible rounded-full bg-muted">
            <motion.div className="relative h-full rounded-full bg-foreground" style={{ width: `${progress * 100}%` }}>
              <span className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-foreground shadow-card" />
            </motion.div>
          </div>

          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-[4px] bg-secondary">
            <img src={artwork} alt={title} className="h-full w-full object-cover" loading="eager" />
            {isResolving && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              </div>
            )}
            {isVideoMode && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Video className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate text-[12px] font-semibold leading-tight text-foreground">{title}</p>
            <p className="mt-1 truncate text-[10px] leading-tight text-muted-foreground">
              {isResolving ? "Loading" : subtitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1" onClick={stop}>
            {!isVideoMode && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggleShuffle}
                aria-label="Shuffle"
                className={`flex h-8 w-8 items-center justify-center rounded-full ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Shuffle className="h-4 w-4" />
              </motion.button>
            )}
            {!isVideoMode && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={previous}
                aria-label="Previous"
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground">
                <SkipBack className="h-[18px] w-[18px]" fill="currentColor" />
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.9 }} onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background shadow-card">
              {isResolving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
              )}
            </motion.button>
            {!isVideoMode && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={next}
                aria-label="Next"
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground">
                <SkipForward className="h-[18px] w-[18px]" fill="currentColor" />
              </motion.button>
            )}
            {!isVideoMode && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggleRepeat}
                aria-label="Repeat"
                className={`flex h-8 w-8 items-center justify-center rounded-full ${repeat !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </motion.button>
            )}
          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  );
}
