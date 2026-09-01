/**
 * Desktop inline lyrics — fills the main content column (Spotify-style)
 * while the sidebar, top bar and player bar stay exactly where they are.
 */
import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Music2, RefreshCw, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePlayer } from "@/context/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { toTitleCase } from "@/utils/toTitleCase";
import { setDesktopLyricsOpen } from "@/hooks/useDesktopLyrics";

interface LyricLine { time: number; text: string }

function parseSyncedLyrics(synced: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(synced)) !== null) {
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
    if (m[4].trim()) lines.push({ time, text: m[4].trim() });
  }
  return lines;
}

export function DesktopLyricsPanel() {
  const { currentTrack, progress, duration } = usePlayer();
  const activeRef = useRef<HTMLParagraphElement>(null);
  const title = currentTrack?.title || "";
  const artist = currentTrack?.artist || "";
  const actualDuration = duration || currentTrack?.duration || 0;
  const currentTime = Math.floor(progress * actualDuration);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lyrics", title, artist],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("lyrics", { body: { title, artist } });
      if (error) throw error;
      return data as { lyrics: string | null; syncedLyrics?: string | null };
    },
    enabled: !!title && !!artist,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const syncedLines = useMemo(
    () => (data?.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : null),
    [data?.syncedLyrics],
  );

  const activeIndex = useMemo(() => {
    if (!syncedLines) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [syncedLines, currentTime]);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  const hasSynced = !!syncedLines && syncedLines.length > 0;
  const plainLines = !hasSynced ? (data?.lyrics || "").split("\n").filter((l) => l.trim()) : [];
  const hasLyrics = !!(data?.lyrics || data?.syncedLyrics);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background-elevated"
      aria-label="Lyrics"
    >
      {currentTrack?.artwork && (
        <div
          className="pointer-events-none absolute inset-0 opacity-25 blur-3xl"
          style={{ backgroundImage: `url(${currentTrack.artwork})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}

      <header className="relative flex items-center justify-between gap-4 px-8 pt-6 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Lyrics</p>
          <h2 className="truncate text-xl font-bold text-foreground">
            {toTitleCase(title)}{artist ? ` — ${toTitleCase(artist)}` : ""}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setDesktopLyricsOpen(false)}
          aria-label="Close lyrics"
          className="rounded-full bg-foreground/10 p-2 text-foreground/80 transition-colors hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto px-8">
        {isLoading && (
          <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" /><span className="text-sm">Fetching lyrics…</span>
          </div>
        )}
        {!isLoading && isError && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <Music2 className="h-10 w-10" />
            <p className="text-sm">Couldn't load lyrics.</p>
            <button onClick={() => refetch()} type="button" className="flex items-center gap-2 rounded-full bg-foreground/10 px-4 py-2 text-sm text-foreground">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        )}
        {!isLoading && !isError && !hasLyrics && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Music2 className="h-10 w-10" /><p className="text-sm">No lyrics available.</p>
          </div>
        )}
        {!isLoading && !isError && hasLyrics && (
          <div className="mx-auto max-w-2xl space-y-5 py-24" aria-live="polite">
            {(hasSynced ? syncedLines! : plainLines.map((t, i) => ({ time: i, text: t }))).map((line, i) => {
              const isActive = hasSynced && i === activeIndex;
              const isPast = hasSynced && i < activeIndex;
              return (
                <p
                  key={i}
                  ref={isActive ? activeRef : undefined}
                  className={`text-[28px] font-bold leading-[1.25] tracking-tight transition-all duration-500 ${
                    isActive ? "text-foreground" : isPast ? "text-foreground/25" : "text-foreground/60"
                  }`}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
}
