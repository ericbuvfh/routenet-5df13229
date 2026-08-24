/**
 * Recommended-song memory.
 *
 * Every song the recommendation engine puts in a queue is written here with a
 * timestamp. A song stays UNAVAILABLE for recommendation for 7 days, which
 * keeps sessions versatile instead of looping the same "top hits" forever.
 *
 * Storage is local-only (fast, offline-safe) and self-trimming.
 */

const KEY = "routenet.recommended.v1";
/** A recommended song can only come back after this long. */
export const RECOMMEND_BLOCK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 3000;

type Store = Record<string, number>;

let store: Store = {};
let loaded = false;

function load(): Store {
  if (loaded) return store;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    store = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    store = {};
  }
  return store;
}

function persist() {
  try {
    const entries = Object.entries(store);
    if (entries.length > MAX_ENTRIES) {
      store = Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES));
    }
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch { /* quota */ }
}

/** True when this song was recommended within the last 7 days. */
export function isRecentlyRecommended(key: string): boolean {
  if (!key) return false;
  const at = load()[key];
  return !!at && Date.now() - at < RECOMMEND_BLOCK_MS;
}

/** Mark songs as recommended, starting their 7-day unavailability window. */
export function rememberRecommended(keys: string[]) {
  if (!keys.length) return;
  const s = load();
  const now = Date.now();
  for (const k of keys) if (k) s[k] = now;
  // Drop expired entries opportunistically.
  for (const [k, at] of Object.entries(s)) {
    if (now - at > RECOMMEND_BLOCK_MS) delete s[k];
  }
  persist();
}

/** Set of every key currently inside its 7-day window. */
export function blockedRecommendationKeys(): Set<string> {
  const s = load();
  const now = Date.now();
  const out = new Set<string>();
  for (const [k, at] of Object.entries(s)) {
    if (now - at < RECOMMEND_BLOCK_MS) out.add(k);
  }
  return out;
}

export function clearRecommendedMemory() {
  store = {};
  loaded = true;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
