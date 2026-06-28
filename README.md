# Audio to YouTube MP4

Turn audio and cover art into a YouTube-ready video. No video editor required.

## What It Does

Select an audio file and a cover image, and this tool creates a video file with your image displayed for the full duration of the audio. The output is a 1280x720 (720p) video ready to upload to YouTube.

## Supported Formats

**Input audio:** MP3, WAV, OGG, AAC, M4A

**Input image:** JPG, PNG, WebP

**Output video:** WebM (VP8/Opus) on Android Chrome and most Chromium browsers. MP4 (H.264/AAC) where the browser supports it. YouTube accepts both formats. Resolution is 1280x720 at 30fps.

## How It Works

1. You select a cover image and an audio file on your device.
2. The app draws your image onto an HTML5 Canvas element (1280x720).
3. The audio plays through a Web Audio API pipeline.
4. The browser's MediaRecorder API captures the canvas video stream and audio stream together.
5. When the audio finishes, the recording stops and you can download the result.

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

## Mobile Compatibility

This app is designed to work on Android phones (tested on Samsung Galaxy A16 with Chrome). Key mobile considerations:

- The app uses Wake Lock API to keep the screen on during conversion.
- Conversion runs in real-time: a 3-minute song takes about 3 minutes to convert.
- Processing time depends on your device and the length of the audio file.
- Designed to pause and resume on supported mobile browsers when the app is interrupted (e.g. phone calls, switching apps).
- Keep the browser tab open during conversion.

**Browser support:** Chrome 94+, Edge 94+, and other Chromium-based browsers. Safari and Firefox have limited MediaRecorder support and may not produce MP4 output.

## Privacy

All conversion happens locally in your browser. No files are uploaded to any server. No analytics or tracking is included. No account is required.

## Disclaimer

This tool is not affiliated with, endorsed by, or connected to YouTube or Google in any way. "YouTube" is a trademark of Google LLC. This tool simply produces standard video files that are compatible with YouTube's upload requirements.

## License

MIT
