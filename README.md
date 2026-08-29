# Audio to YouTube MP4

**[Live App →](https://dathaze20.github.io/AUDIO-TO-YOUTUBE-MP4/)**

Turn any audio file and cover image into a YouTube-ready video — entirely in your browser. Select your audio, select a cover image, tap **Create Video**, and the app renders a 1280×720 video you can download and upload directly to YouTube. Nothing leaves your device.

## What It Does

Select an audio file and a cover image. The app combines them into a video file with your image displayed for the full duration of the audio track. When conversion finishes the file downloads automatically. All processing runs locally in your browser — your media is never uploaded to any server.

## Supported Formats

| | Formats |
|---|---|
| Input audio | MP3, WAV, OGG, AAC, M4A |
| Input image | JPG, PNG, WebP |
| Output video | WebM (VP8/Opus) on Chrome and Chromium browsers; MP4 (H.264/AAC) where MediaRecorder supports it |

**Output format:** The app tests codec support at runtime and uses the best available option. On Android Chrome and most Chromium browsers the output is WebM (VP8/Opus). MP4 output depends on the browser's MediaRecorder implementation. YouTube accepts both formats. The downloaded filename reflects whichever format your browser produced.

## How It Works

1. You select a cover image and an audio file on your device.
2. The app draws your image onto an HTML5 Canvas element at 1280×720.
3. The audio plays through a Web Audio API pipeline routed to both your speakers and a `MediaStreamDestination`.
4. The browser's MediaRecorder API captures the canvas video stream and the audio stream together.
5. When the audio finishes, recording stops and the video file downloads automatically.

All processing happens entirely in your browser. No files are uploaded to any server.

## Run Locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder, ready for static hosting.

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages automatically on every push to `main`. See `DEPLOYMENT.md` for manual deployment and alternative hosting options (Netlify, Vercel, Cloudflare Pages).

## Mobile

Designed and tested on Android Chrome (Samsung Galaxy A16). Key behaviors:

- **Pause and resume:** If a phone call comes in or you switch apps mid-conversion, the app automatically pauses and resumes when you return to the tab.
- **Wake Lock:** The screen stays on for the full duration of the conversion.
- **Progress tracking:** A live progress bar and timer show elapsed and total time.
- **Auto-download:** The video file downloads automatically when conversion finishes.

Conversion runs in real time — a 4-minute audio file takes roughly 4 minutes to process. Keep the tab open for best results; brief interruptions are handled by the pause/resume logic.

## Browser Compatibility

| Browser | Status |
|---|---|
| Chrome 94+, Edge 94+ | Full support |
| Other Chromium-based browsers | Full support |
| Firefox | MediaRecorder support varies; not tested |
| Safari / iOS | Limited MediaRecorder support; may not produce output |

## Progressive Web App

The app is installable on Android Chrome via **Add to Home Screen**. After the first load, the app shell is cached so it opens offline. The service worker uses a network-first strategy and checks for updates on every page load, so you always get the latest version when online.

## Privacy

All processing happens locally in your browser. Your audio and image files are never uploaded to any server. No analytics, no tracking, no account required.

## Screenshots / Demo

*Screenshots not yet in this repository. Recommended captures:*

1. **Files ready** — the main screen with a cover image previewed and an audio file selected, and the glowing Create Video button active.
2. **Conversion in progress** — the canvas preview with the REC badge, animated waveform bars, and the shimmer progress bar mid-way.
3. **Complete screen** — the success ring animation and "Video Saved" confirmation with the file extension.

## Disclaimer

This tool is not affiliated with, endorsed by, or connected to YouTube or Google in any way. "YouTube" is a trademark of Google LLC. This tool produces standard video files that are compatible with YouTube's upload requirements.

## License

MIT
