import { useSyncExternalStore } from "react";

/**
 * Tiny global store for the desktop inline lyrics view.
 * On desktop the lyrics take over the main content column (like Spotify)
 * instead of navigating to the full-screen /lyrics page.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setDesktopLyricsOpen(next: boolean) {
  if (open === next) return;
  open = next;
  emit();
}

export function toggleDesktopLyrics() {
  setDesktopLyricsOpen(!open);
}

export function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

export function useDesktopLyricsOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
