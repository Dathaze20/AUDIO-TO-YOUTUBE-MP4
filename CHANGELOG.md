# Changelog

## v1.0.3 — 2026-07-18

- Visual overhaul: deep-space background with ambient CSS orbs (indigo, violet, pink)
- Glassmorphic UI throughout: header, file uploaders, progress card, error state
- Animated waveform bars during conversion; shimmer traveling highlight on progress bar
- Button glow pulses on the Create Video button when both files are ready
- Success ring pulse animation on the completion screen
- File uploader cards shift from indigo-tinted (empty) to emerald-tinted (selected)
- All effects are pure CSS — no changes to conversion logic

## v1.0.2 — 2026-07-14

- Clarified output format: Android Chrome produces WebM (VP8/Opus); MP4 where supported
- Completion screen now shows the actual downloaded file extension (.webm or .mp4)
- Updated all UI text and documentation to match real output behavior
- Fixed stale PWA cache — app now auto-updates after each deploy
- Added feedback button to header (opens GitHub Issues)

## v1.0.1 — 2026-07-14

- Removed scroll on idle screen on mobile
- Bumped service worker cache version to clear stale content

## v1.0.0 — 2026-07-14

First public release.

- Convert audio + cover image into a YouTube-ready video entirely in the browser
- Supports MP3, WAV, OGG, AAC, M4A input audio
- Supports JPG, PNG, WebP cover images
- Outputs 1280x720 at 30fps
- WebM (VP8/Opus) on Android Chrome for reliable audio recording
- Pause and resume when interrupted by phone calls or app switching
- Auto-downloads the video file when conversion completes
- Wake Lock keeps screen on during conversion
- PWA — installable on home screen, works offline after first load
- No server, no uploads, no account required
- Tested on Samsung Galaxy A16 with Chrome
- Confirmed working on a real podcast episode uploaded to YouTube
