# Audio to YouTube MP4

**[Live App →](https://dathaze20.github.io/AUDIO-TO-YOUTUBE-MP4/)**

A browser-based tool that turns any audio file and a cover image into a YouTube-ready video — no video editor, no account, no server uploads. Everything runs entirely in your browser.

---

## Why This Exists

YouTube doesn't accept bare audio files. If you record a podcast, produce a music track, or narrate a reading, you need a video container before you can upload. This tool creates that container from a still image and your audio, entirely in your browser, for free.

---

## Features

### Audio & Video
- Combines any supported audio file with a cover image into a single video file
- **1280×720 output at 30 FPS** — meets YouTube's recommended HD spec
- **WebM (VP8/Opus)** on Chrome and Android Chrome (reliable audio recording on mobile)
- **MP4 (H.264/AAC)** where `MediaRecorder` supports it
- Codec is selected at runtime with `MediaRecorder.isTypeSupported()` — the downloaded filename matches the actual format produced (`.webm` or `.mp4`)
- Both formats upload directly to YouTube

### Mobile & Interruption Handling
- Designed and tested on **Android Chrome** (Samsung Galaxy A16)
- Conversion **pauses automatically** when a phone call arrives or you switch apps — **resumes** when you return to the tab
- **Screen Wake Lock** keeps the display on for the full duration so Android doesn't suspend the tab mid-conversion
- **Live progress bar** with elapsed/total time in `M:SS` format, updating every 200 ms
- **Auto-download** — the video file saves to your Downloads folder the moment conversion finishes, with no extra tap

### Usability
- Cover image is previewed in the upload card before conversion starts
- Inline file validation with clear error messages for unsupported types and oversized files (500 MB limit per file)
- Duration estimate shown after the audio file is loaded
- **Haptic feedback** on Android: short pulse on file selection, start, and success; triple pulse on error
- Works in both portrait and landscape orientations

### Privacy
- All processing runs locally in your browser — no files are ever sent to a server
- No analytics, no tracking, no account required

### Progressive Web App
- **Installable on Android Chrome** via *Add to Home Screen*
- Service worker caches the app shell after the first load — the app opens offline
- Auto-updates on every page load when online: the service worker fetches the latest version and reloads; you always get the newest release

---

## Supported Formats

| | Formats |
|---|---|
| Input audio | MP3, WAV, OGG, AAC, M4A (up to 500 MB) |
| Input image | JPG, PNG, WebP (up to 500 MB) |
| Output video | WebM (VP8/Opus) on Chrome/Android; MP4 (H.264/AAC) where supported |

YouTube accepts both WebM and MP4.

---

## How It Works

1. You select a cover image and an audio file.
2. The app draws the image onto an **HTML5 Canvas** at 1280×720.
3. The audio plays through a **Web Audio API** pipeline — routed to both your speakers and a `MediaStreamDestination`.
4. `canvas.captureStream(30)` produces a 30 FPS video track.
5. The browser's **MediaRecorder API** captures the canvas + audio stream together.
6. When the audio finishes, recording stops and the video file downloads automatically.

Nothing leaves your device at any point.

---

## Install on Android

1. Open the [live app](https://dathaze20.github.io/AUDIO-TO-YOUTUBE-MP4/) in **Chrome on Android**.
2. Tap the browser menu (⋮) → **Add to Home Screen**.
3. The app appears on your home screen and opens in standalone mode (no browser chrome).
4. When online, reloading checks for updates and applies them automatically.

---

## Browser Compatibility

| Browser | Status |
|---|---|
| Chrome 94+, Edge 94+ | Full support |
| Other Chromium-based browsers | Full support |
| Firefox | MediaRecorder support varies; not tested |
| Safari / iOS | Limited MediaRecorder support; output not guaranteed |

Conversion runs in real time — a 4-minute audio file takes roughly 4 minutes to process. Keep the tab open and the screen on; the app handles brief interruptions via pause/resume, but extended interruptions (long phone calls, browser process kills) may require a retry.

---

## Run Locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Build

```bash
npm run build      # type-check then bundle
npm run preview    # serve the production build locally
```

`npm run build` runs `tsc --noEmit` before Vite bundles — production builds are always type-checked.

---

## Tests, Linting, and Type Checking

```bash
npm test          # Vitest unit and component tests (jsdom — no real browser needed)
npm run lint      # ESLint
npm run typecheck # TypeScript strict check (tsc --noEmit)
```

---

## Deployment

The CI workflow (`.github/workflows/deploy.yml`) runs two jobs:

- **test** — on every push to `main` and every pull request targeting `main`: installs dependencies, runs `npm run lint`, `npm test`, and `npm run build`
- **deploy** — only after `test` succeeds and only on pushes to `main`: publishes the `dist/` folder to GitHub Pages

---

## Technical Architecture

```
Audio file (MP3 / WAV / OGG / AAC / M4A)
    │
    └─► HTMLAudioElement
            ├─► AudioContext.destination   (speakers)
            └─► MediaStreamDestination     (audio capture track)
                                                │
Cover image (JPG / PNG / WebP)                  │
    │                                           │
    └─► Canvas 1280×720                         │
            └─► captureStream(30 fps)           │
                        └──────────┬────────────┘
                                   ▼
                             MediaRecorder
                        (VP8/Opus WebM  or  H.264/AAC MP4)
                                   │
                                   ▼
                        Blob → auto-download as .webm / .mp4
```

**Codec negotiation** (runtime, `MediaRecorder.isTypeSupported()`):
1. `video/webm;codecs=vp8,opus` — preferred; reliable audio on Android
2. `video/mp4;codecs=avc1,mp4a.40.2`
3. `video/mp4;codecs=avc1`
4. `video/webm` — last fallback

**AudioContext** is created once per page load and reused across conversions to prevent mobile crashes from instantiating multiple contexts.

**Canvas warmup**: the cover image is painted to the canvas before `captureStream()` is called, so the video track is active from the first frame on mobile Chrome.

**Interruption handling**: a `visibilitychange` listener pauses `MediaRecorder`, the HTMLAudioElement, and the `requestAnimationFrame` loop when the tab hides (phone call, app switch), then resumes all three when the tab becomes visible again.

---

## Screenshots

<!--
Suggested captures for future inclusion:
1. Files ready — cover image previewed in card, audio selected, Create Video button glowing
2. Conversion in progress — canvas preview with REC badge, animated waveform bars, shimmer progress bar
3. Complete — success ring animation and "Video Saved" confirmation with file extension
-->

*Screenshots not yet included. See the [live app](https://dathaze20.github.io/AUDIO-TO-YOUTUBE-MP4/) to try it.*

---

## Disclaimer

This tool is not affiliated with, endorsed by, or connected to YouTube or Google in any way. "YouTube" is a trademark of Google LLC. This tool produces standard video files that happen to meet YouTube's upload requirements.

---

## License

[MIT](LICENSE)
