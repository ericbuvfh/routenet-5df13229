import { useEffect, useRef } from "react";

const CONTAINER_ID = "container-8dcc7aa2f9b155ac0dc17d949ccd0579";

/**
 * Native ad container rendered inside the Home feed. The network's invoke.js
 * (loaded from index.html) fills this container by id once it is in the DOM.
 *
 * The network only fills a single container id, so extra placements ask for a
 * `clone`: they mirror the filled markup once it appears.
 */
export function NativeAdSlot({ clone = false, className = "" }: { clone?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!clone) return;
    let stop = false;
    const tick = () => {
      if (stop || !ref.current) return;
      const source = document.getElementById(CONTAINER_ID);
      if (source && source.innerHTML.trim() && ref.current.innerHTML !== source.innerHTML) {
        ref.current.innerHTML = source.innerHTML;
      }
      if (!ref.current.innerHTML.trim()) window.setTimeout(tick, 1200);
    };
    tick();
    return () => { stop = true; };
  }, [clone]);

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      {clone ? <div ref={ref} data-native-ad-clone /> : <div id={CONTAINER_ID} />}
    </div>
  );
}
