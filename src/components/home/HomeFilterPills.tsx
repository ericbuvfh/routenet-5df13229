import { cn } from "@/lib/utils";

export type HomeFilter = "all" | "music" | "podcasts";

const FILTERS: { id: HomeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "music", label: "Music" },
  { id: "podcasts", label: "Podcasts & Shows" },
];

/** Spotify-style filter chips under the greeting header. */
export function HomeFilterPills({
  value,
  onChange,
}: {
  value: HomeFilter;
  onChange: (v: HomeFilter) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
      {FILTERS.map((f) => {
        const active = f.id === value;
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors active:scale-[0.97]",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
