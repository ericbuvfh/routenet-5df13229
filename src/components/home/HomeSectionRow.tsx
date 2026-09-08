import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SectionDescriptor, SectionResult } from "@/services/homeFeedEngine";
import type { Track } from "@/data/mockData";
import { cached, peekCached } from "@/services/homeCache";
import { SongCard, AlbumCard, CompactAlbumCard, AlbumGridColumn, PlaylistCard, ArtistCard, CardSkeleton, SongListRow, SongListColumn, MusicVideoCard, MusicVideoListItem, VideoListColumn, ListSkeleton, VideoSkeleton } from "./cards/UnifiedCards";

interface Props {
  section: SectionDescriptor;
  onPlay: (track: Track, source: Track[]) => void;
}

// Sections stay warm for 6 hours so navigating away and back never refetches.
const SECTION_TTL = 6 * 60 * 60 * 1000;

function countItems(res: SectionResult) {
  return (
    (res.songs?.length ?? 0) +
    (res.albums?.length ?? 0) +
    (res.playlists?.length ?? 0) +
    (res.artists?.length ?? 0) +
    (res.videos?.length ?? 0)
  );
}

export function HomeSectionRow({ section, onPlay }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement | null>(null);
  const cacheKey = `section:${section.id}`;
  // Cached sections render instantly on every re-entry — no skeleton flash.
  const initial = peekCached<SectionResult>(cacheKey);
  const [data, setData] = useState<SectionResult | null>(initial);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "empty">(
    initial ? (countItems(initial) > 0 ? "loaded" : "empty") : "idle",
  );

  useEffect(() => {
    if (!ref.current || state !== "idle") return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        setState("loading");
        cached<SectionResult>(cacheKey, SECTION_TTL, () => section.load())
          .then((res) => {
            setData(res);
            setState(countItems(res) > 0 ? "loaded" : "empty");
          })
          .catch(() => setState("empty"));
      }
    }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [section, state, cacheKey]);


  const isArtistKind = section.kind === "artists";

  // A section that resolved with nothing relevant is dropped entirely instead
  // of padding itself with generic data.
  if (state === "empty") return null;


  const items = (() => {
    if (!data) return null;
    if (section.kind === "videos" && data.videos?.length) {
      const vids = data.videos.slice(0, 12);
      const asTrack = (x: typeof vids[number]): Track => ({
        id: `yt-${x.videoId}`, title: x.title, artist: x.artist, album: "",
        artwork: x.thumbnail, duration: x.duration || 0, youtubeId: x.videoId,
      } as Track);
      const source = vids.map(asTrack);
      // Four videos stacked per column so the row matches the song lists.
      const columns: typeof vids[] = [];
      for (let i = 0; i < vids.length; i += 4) columns.push(vids.slice(i, i + 4));
      return columns.map((col, ci) => (

        <VideoListColumn key={`vcol-${ci}`}>
          {col.map((v) => (
            <MusicVideoListItem key={v.id} video={v} onClick={() => onPlay(asTrack(v), source)} />
          ))}
        </VideoListColumn>
      ));
    }

    // Collaborations, radio and "Inspired by" rows borrow the stacked
    // music-video listing layout instead of square cards.
    const listLike =
      section.kind === "songlist" ||
      /:(collabs|radio|inspired)$/.test(section.id) ||
      /(collaboration|radio|inspired by)/i.test(section.title);
    if (listLike && data.songs?.length) {
      const songs = data.songs.slice(0, 16);
      const columns: Track[][] = [];
      for (let i = 0; i < songs.length; i += 4) columns.push(songs.slice(i, i + 4));
      return columns.map((col, ci) => (
        <SongListColumn key={`col-${ci}`}>
          {col.map((t) => (
            <SongListRow key={t.id} track={t} onPlay={() => onPlay(t, songs)} />
          ))}
        </SongListColumn>
      ));
    }
    if (data.songs?.length) {
      return data.songs.slice(0, 20).map((t) => (
        <SongCard key={t.id} track={t} onClick={() => onPlay(t, data.songs!)} />
      ));
    }
    if (data.albums?.length) {
      const albumColumns = [];
      const albums = data.albums.slice(0, 27);
      for (let i = 0; i < albums.length; i += 9) {
        const group = albums.slice(i, i + 9);
        albumColumns.push(
          <AlbumGridColumn key={`album-grid-${i / 9}`}>
            {group.map((a) => (
              <CompactAlbumCard key={a.id} album={a} onClick={() => navigate(`/album/${String(a.id).replace("deezer-", "")}`)} />
            ))}
          </AlbumGridColumn>,
        );
      }
      return albumColumns;
    }
    if (data.playlists?.length) {
      return data.playlists.slice(0, 20).map((p) => (
        <PlaylistCard key={p.id} playlist={p} onClick={() => navigate(`/playlist/${p.id}`)} />
      ));
    }
    if (data.artists?.length) {
      return data.artists.slice(0, 20).map((a) => (
        <ArtistCard key={a.id} artist={a} onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}`)} />
      ));
    }
    return null;
  })();

  return (
    <section ref={ref} className="space-y-1.5">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-bold leading-[26px] tracking-[-0.02em] text-foreground sm:text-[22px]">{data?.title || section.title}</h2>
          {section.subtitle && <p className="truncate text-[12px] font-normal leading-[16px] text-muted-foreground">{section.subtitle}</p>}
        </div>
      </div>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-0.5 scrollbar-hide snap-x snap-mandatory">
        <div className="flex items-start gap-2 sm:gap-2.5">
          {items ?? Array.from({ length: section.kind === "videos" ? 3 : section.kind === "songlist" ? 2 : 6 }).map((_, i) =>
            section.kind === "videos" ? <VideoSkeleton key={i} />
              : section.kind === "songlist" ? <ListSkeleton key={i} />
              : <CardSkeleton key={i} round={isArtistKind} />)}
          {items && section.kind !== "videos" && section.kind !== "songlist" && Array.from({ length: Math.max(0, 6 - (data?.songs?.length || data?.albums?.length || data?.playlists?.length || data?.artists?.length || 0)) }).map((_, i) => (
            <CardSkeleton key={`placeholder-${i}`} round={isArtistKind} />
          ))}
        </div>
      </div>
    </section>
  );
}

