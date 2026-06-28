import React, { useState, useRef, useCallback } from 'react';
import {
  Video,
  Music,
  Image as ImageIcon,
  CheckCircle2,
  Download,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import { FileState, ConversionStatus, ConversionProgress } from './types';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a'];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function validateFile(file: File, acceptedTypes: string[], label: string): string | null {
  if (acceptedTypes.length > 0 && !acceptedTypes.some(t => file.type.startsWith(t.replace('/*', '')))) {
    return `${label}: unsupported file type "${file.type || 'unknown'}". Please select a valid file.`;
  }
  if (file.size > 500 * 1024 * 1024) {
    return `${label}: file is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum is 500 MB.`;
  }
  return null;
}

const App: React.FC = () => {
  const [image, setImage] = useState<FileState>({ file: null, previewUrl: null, name: '' });
  const [audio, setAudio] = useState<FileState>({ file: null, previewUrl: null, name: '' });
  const [conversionState, setConversionState] = useState<ConversionProgress>({
    status: ConversionStatus.IDLE,
    progress: 0,
    message: ''
  });
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const renderLoopRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const handleImageSelect = useCallback((file: File) => {
    const error = validateFile(file, ACCEPTED_IMAGE_TYPES, 'Cover image');
    if (error) { setValidationError(error); return; }
    setValidationError(null);
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setImage({ file, previewUrl: URL.createObjectURL(file), name: file.name });
  }, [image.previewUrl]);

  const handleAudioSelect = useCallback((file: File) => {
    const error = validateFile(file, ACCEPTED_AUDIO_TYPES, 'Audio file');
    if (error) { setValidationError(error); return; }
    setValidationError(null);
    if (audio.previewUrl) URL.revokeObjectURL(audio.previewUrl);
    setAudio({ file, previewUrl: URL.createObjectURL(file), name: file.name });
  }, [audio.previewUrl]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (renderLoopRef.current) { cancelAnimationFrame(renderLoopRef.current); renderLoopRef.current = null; }
    if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch {} wakeLockRef.current = null; }
  }, []);

  const resetAll = useCallback(() => {
    stopRecording();
    if (resultVideoUrl) URL.revokeObjectURL(resultVideoUrl);
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    if (audio.previewUrl) URL.revokeObjectURL(audio.previewUrl);
    setImage({ file: null, previewUrl: null, name: '' });
    setAudio({ file: null, previewUrl: null, name: '' });
    setConversionState({ status: ConversionStatus.IDLE, progress: 0, message: '' });
    setResultVideoUrl(null);
    setValidationError(null);
  }, [resultVideoUrl, image.previewUrl, audio.previewUrl, stopRecording]);

  const startConversion = async () => {
    if (!image.file || !audio.file || !audioRef.current) return;

    try {
      setConversionState({ status: ConversionStatus.CONVERTING, progress: 0, message: 'Preparing...' });

      if ('wakeLock' in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
      }

      if (audioRef.current.readyState < 1) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            audioRef.current?.removeEventListener('loadedmetadata', onReady);
            audioRef.current?.removeEventListener('canplay', onReady);
            resolve();
          };
          audioRef.current?.addEventListener('loadedmetadata', onReady);
          audioRef.current?.addEventListener('canplay', onReady);
          setTimeout(onReady, 5000);
        });
      }

      let canvas = canvasRef.current;
      let attempts = 0;
      while (!canvas && attempts < 150) {
        await new Promise(r => setTimeout(r, 20));
        canvas = canvasRef.current;
        attempts++;
      }
      if (!canvas) throw new Error('Could not initialize video canvas. Please try again.');

      const ctx = canvas.getContext('2d', { alpha: false })!;
      canvas.width = 1280;
      canvas.height = 720;

      const img = new Image();
      img.src = image.previewUrl!;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load cover image.'));
      });

      if (!audioContextRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AC();
      }
      const audioCtx = audioContextRef.current;
      const dest = audioCtx.createMediaStreamDestination();

      if (!audioSourceRef.current) {
        audioSourceRef.current = audioCtx.createMediaElementSource(audioRef.current);
      }
      audioSourceRef.current.disconnect();
      audioSourceRef.current.connect(audioCtx.destination);
      audioSourceRef.current.connect(dest);

      const videoStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Your browser does not support video recording. Please use Chrome or Edge.');
      }

      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('No supported video format found on this device.');
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 128_000
      });

      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = () => {
        const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
        const finalBlob = new Blob(chunks, { type: mimeType });
        setResultVideoUrl(URL.createObjectURL(finalBlob));
        setConversionState({ status: ConversionStatus.COMPLETED, progress: 100, message: `Done (${ext.toUpperCase()})` });
      };

      let lastUpdate = 0;
      const draw = () => {
        if (!ctx || !audioRef.current) return;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1280, 720);
        const ratio = Math.max(1280 / img.width, 720 / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (1280 - w) / 2, (720 - h) / 2, w, h);

        const now = Date.now();
        const time = audioRef.current.currentTime;
        const duration = audioRef.current.duration;

        if (now - lastUpdate > 200) {
          const p = Math.floor((time / duration) * 100);
          setConversionState(prev => ({
            ...prev,
            progress: isNaN(p) ? 0 : Math.min(99, p),
            message: `${formatTime(time)} / ${formatTime(duration)}`
          }));
          lastUpdate = now;
        }

        if (audioRef.current.ended || (duration > 0 && time >= duration)) {
          stopRecording();
          return;
        }
        renderLoopRef.current = requestAnimationFrame(draw);
      };

      audioRef.current.currentTime = 0;
      await audioCtx.resume();
      recorder.start();
      await audioRef.current.play();
      draw();

    } catch (err) {
      console.error('Conversion failed:', err);
      setConversionState({
        status: ConversionStatus.ERROR,
        progress: 0,
        message: err instanceof Error ? err.message : 'An unexpected error occurred. Please reload and try again.'
      });
    }
  };

  const canConvert = !!image.file && !!audio.file;
  const isIdle = conversionState.status === ConversionStatus.IDLE;
  const isConverting = conversionState.status === ConversionStatus.CONVERTING;
  const isError = conversionState.status === ConversionStatus.ERROR;
  const isComplete = conversionState.status === ConversionStatus.COMPLETED;

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Video className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-sm font-bold text-white">Audio to YouTube MP4</h1>
      </header>

      {/* Main content - fills remaining space */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-4 min-h-full">

          {/* === ERROR STATE === */}
          {isError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-2">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <h3 className="text-lg font-bold text-white text-center">Conversion Failed</h3>
              <p className="text-sm text-red-300 text-center">{conversionState.message}</p>
              <button
                onClick={resetAll}
                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {/* === IDLE: File selection === */}
          {isIdle && !resultVideoUrl && (
            <>
              {/* Title */}
              <div className="text-center pt-2">
                <h2 className="text-xl font-bold text-white">
                  Convert MP3 to <span className="text-indigo-400">MP4 Video</span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Pick a cover image and audio file, then tap convert.
                </p>
              </div>

              {validationError && (
                <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-300">{validationError}</p>
                </div>
              )}

              {/* Upload areas - big and centered like original */}
              <div className="flex-1 flex flex-col gap-3 justify-center">
                <FileUploader
                  label="1. Cover Image"
                  accept="image/jpeg,image/png,image/webp"
                  hint="Tap to select from phone"
                  selectedFileName={image.name}
                  previewUrl={image.previewUrl}
                  onFileSelect={handleImageSelect}
                  icon={<ImageIcon className="w-7 h-7" />}
                />

                <FileUploader
                  label="2. Audio File (MP3)"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a"
                  hint="Tap to select from phone"
                  selectedFileName={audio.name}
                  onFileSelect={handleAudioSelect}
                  icon={<Music className="w-7 h-7" />}
                />

                <button
                  disabled={!canConvert}
                  onClick={startConversion}
                  className="w-full py-4 bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center gap-2 mt-1"
                >
                  <Video className="w-5 h-5" />
                  {canConvert ? 'Convert to MP4' : 'Select files to start'}
                </button>
              </div>

              {/* Minimal footer info */}
              <p className="text-[11px] text-slate-600 text-center pb-1">
                All files stay on your device &middot; Not affiliated with YouTube
              </p>
            </>
          )}

          {/* === CONVERTING === */}
          {isConverting && (
            <div className="flex-1 flex flex-col gap-5 justify-center">
              <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-slate-700 relative">
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-red-600 rounded-md flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-[10px] text-white font-bold uppercase tracking-wide">REC</span>
                </div>
              </div>

              <div className="space-y-3 px-1">
                <div className="flex justify-between items-baseline">
                  <div>
                    <h3 className="text-lg font-bold text-white">Converting...</h3>
                    <p className="text-sm text-slate-400">{conversionState.message}</p>
                  </div>
                  <span className="text-3xl font-bold text-indigo-400 tabular-nums">{conversionState.progress}%</span>
                </div>

                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${conversionState.progress}%` }}
                  />
                </div>

                <p className="text-xs text-slate-500 text-center">
                  Keep this tab open. Processing in real time.
                </p>
              </div>
            </div>
          )}

          {/* === COMPLETE === */}
          {isComplete && resultVideoUrl && (
            <div className="flex-1 flex flex-col gap-4 justify-center">
              <div className="text-center">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-white">Done!</h2>
                <p className="text-sm text-slate-400 mt-1">{conversionState.message}</p>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-700 bg-black aspect-video">
                <video src={resultVideoUrl} controls className="w-full h-full" playsInline />
              </div>

              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = resultVideoUrl;
                  a.download = `youtube-video-${Date.now()}.mp4`;
                  a.click();
                }}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                <Download className="w-5 h-5" />
                Download MP4
              </button>

              <button
                onClick={resetAll}
                className="w-full py-3 text-slate-500 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
            </div>
          )}
        </div>
      </main>

      <audio
        ref={audioRef}
        src={audio.previewUrl || undefined}
        className="hidden"
        playsInline
        preload="auto"
      />
    </div>
  );
};

export default App;
