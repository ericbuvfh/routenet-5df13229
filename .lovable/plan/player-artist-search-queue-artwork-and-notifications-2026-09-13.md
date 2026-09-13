# Player, Artist, Search, Queue, Artwork and Notifications

## Goal
Polish the main listening flows: a smaller Home player, a complete artist page, clearer Search filters and album quality, queue-to-playlist saving, dependable artwork, and top-positioned notifications.

## Changes

### Home player
- Reduce the Home mini-player’s transport button sizes and spacing while keeping shuffle, previous, play/pause, next, repeat, and the seek bar easy to tap.
- Keep the square artwork, title, artist, loading state, and active shuffle/repeat states visually balanced at phone widths.
- Preserve the existing progress slider behavior and verify that pointer seeking changes real playback, not only the displayed progress.

### Reliable artwork
- Add a reusable song-artwork component with this fallback order: supplied album artwork → YouTube thumbnail from the track’s `youtubeId` → cached YouTube lookup by song and artist → local placeholder.
- Switch the Home mini-player, Search song rows, Queue rows, artist top songs/collaborations, and shared song cards to this component so broken or empty image URLs recover consistently.
- Keep album artwork from its source, but use a graceful local placeholder if its URL fails.

### Full artist page
- Rebuild the artist view around the existing Deezer, Last.fm, TheAudioDB, and YouTube sources.
- Keep the artist banner/profile identity, follow/like action, play and shuffle controls, fan count, genre, country, and biography.
- Add distinct sections for:
  - Top songs, using playable song rows.
  - Albums, separated from singles/EPs and linked to album pages.
  - EPs and singles.
  - Collaborations, deduplicated and limited to tracks that include the artist.
  - Music videos, using wide video rows/cards that open the video player.
  - About the artist and similar artists.
- Cache artist queries through the existing query cache and show compact loading/empty states without leaving blank sections.

### Search
- Add an **Artists** filter pill. Artist results appear only when that filter is selected, keeping the default All list focused on songs and playlists.
- Rank albums by mainstream signals already available in the result set: strong song-result artist rank, track count, and source popularity; reject tribute, karaoke, cover, and low-confidence albums.
- Keep only a small number of qualifying albums in All, while the Albums filter can show the complete qualified set.
- Preserve song-first, playlist-second ordering, result deduplication, query restoration, and playlist save controls.

### Save queue as playlist
- Add a **Save as playlist** action to Queue with a small naming dialog and sensible default name.
- Save the full queue in its current order, including the current/played/up-next tracks without duplicates.
- Support signed-in users through Supabase and guests through the existing local playlist storage.
- Set the new playlist cover to the first queued song’s resolved artwork, then open the saved playlist after success.
- Disable the action for an empty queue and show an inline saving state.

### Notifications
- Move both notification systems to the top center on phone and desktop.
- Update entrance/exit motion so notifications slide from the top rather than the bottom.
- Keep existing success, error, loading, and progress messages unchanged.

## Technical details
- Extend the current artist data hook instead of adding database tables. Deezer supplies releases/top tracks, existing metadata sources supply biography, and the YouTube edge function supplies music videos and artwork fallbacks.
- Extend playlist creation so an initial cover can be persisted immediately, then bulk-insert queue tracks with existing row-level access rules.
- No database migration is required because `playlists.cover_image` and playlist track artwork already exist.
- Treat “filter out artist” as adding a dedicated Artists filter rather than injecting artist rows into All.

## Verification
- Run the project’s checks.
- Test Home seeking and transport controls at phone and desktop sizes.
- Test an artist with albums, singles/EPs, collaborations, videos, and biography; confirm empty sections stay hidden.
- Search for a song, artist, playlist, famous album, and obscure album; verify ordering, filtering, deduplication, and album suppression.
- Force broken artwork URLs and confirm YouTube/local fallbacks display.
- Save a queue as both a guest and signed-in user; confirm order, tracks, and first-song playlist cover.
- Trigger success, error, and loading notifications and confirm all appear from the top.
