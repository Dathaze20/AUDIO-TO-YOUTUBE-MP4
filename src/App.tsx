import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Video,
  Music,
  Image as ImageIcon,
  CheckCircle2,
  Download,
  RotateCcw,
  AlertCircle,
  X
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
    return `${label}: "${file.type || file.name}" is not a supported format.`;
  }
  if (file.size > 500 * 1024 * 1024) {
    return `${label} is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Max 500 MB.`;
  }
  return null;
}

const App: React.FC = () => {
  const [image, setImage] = useState<FileState>({ file: null, previewUrl: null, name: '' });
  const [audio, setAudio] = useState<FileState>({ file: null, previewUrl: null, name: '' });
  const [audioDuration, setAudioDuration] = useState('');
  const [conversionState, setConversionState] = useState<ConversionProgress>({
    status: ConversionStatus.IDLE, progress: 0, message: ''
  });
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [outputExt, setOutputExt] = useState('mp4');
  const [validationError, setValidationError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const renderLoopRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Reacquire wake lock when tab regains focus
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === 'visible' && conversionState.status === ConversionStatus.CONVERTING) {
        if ('wakeLock' in navigator) {
          try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [conversionState.status]);

  const handleImageSelect = useCallback((file: File) => {
    const error = validateFile(file, ACCEPTED_IMAGE_TYPES, 'Image');
    if (error) { setValidationError(error); return; }
    setValidationError(null);
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setImage({ file, previewUrl: URL.createObjectURL(file), name: file.name });
  }, [image.previewUrl]);

  const handleAudioSelect = useCallback((file: File) => {
    const error = validateFile(file, ACCEPTED_AUDIO_TYPES, 'Audio');
    if (error) { setValidationError(error); return; }
    setValidationError(null);
    if (audio.previewUrl) URL.revokeObjectURL(audio.previewUrl);
    const url = URL.createObjectURL(file);
    setAudio({ file, previewUrl: url, name: file.name });
    const tmp = new Audio(url);
    tmp.addEventListener('loadedmetadata', () => {
      if (isFinite(tmp.duration)) setAudioDuration(formatTime(tmp.duration));
    });
  }, [audio.previewUrl]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (renderLoopRef.current) { cancelAnimationFrame(renderLoopRef.current); renderLoopRef.current = null; }
    if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch {} wakeLockRef.current = null; }
  }, []);

  const cancelConversion = useCallback(() => {
    stopRecording();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setConversionState({ status: ConversionStatus.IDLE, progress: 0, message: '' });
  }, [stopRecording]);

  const resetAll = useCallback(() => {
    stopRecording();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (resultVideoUrl) URL.revokeObjectURL(resultVideoUrl);
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    if (audio.previewUrl) URL.revokeObjectURL(audio.previewUrl);
    setImage({ file: null, previewUrl: null, name: '' });
    setAudio({ file: null, previewUrl: null, name: '' });
    setAudioDuration('');
    setConversionState({ status: ConversionStatus.IDLE, progress: 0, message: '' });
    setResultVideoUrl(null);
    setOutputExt('mp4');
    setValidationError(null);
  }, [resultVideoUrl, image.previewUrl, audio.previewUrl, stopRecording]);

  const startConversion = async () => {
    if (!image.file || !audio.file || !audioRef.current) return;

    try {
      setConversionState({ status: ConversionStatus.CONVERTING, progress: 0, message: 'Preparing...' });

      if ('wakeLock' in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
      }

      // Wait for audio metadata on mobile
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

      // Wait for canvas to mount
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

      // Load cover image with timeout
      const img = new Image();
      img.src = image.previewUrl!;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load cover image.'));
        setTimeout(() => reject(new Error('Image took too long to load.')), 10000);
      });

      // Audio context setup (reuse to prevent mobile crashes)
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

      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      setOutputExt(ext);

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 128_000
      });

      recorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onerror = () => {
        setConversionState({
          status: ConversionStatus.ERROR, progress: 0,
          message: 'Recording failed unexpectedly. Try a shorter file or restart.'
        });
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        setResultVideoUrl(URL.createObjectURL(finalBlob));
        setConversionState({ status: ConversionStatus.COMPLETED, progress: 100, message: 'Ready to download' });
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

        if (now - lastUpdate > 250) {
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
      recorder.start(1000);
      await audioRef.current.play();
      draw();

    } catch (err) {
      console.error('Conversion failed:', err);
      setConversionState({
        status: ConversionStatus.ERROR, progress: 0,
        message: err instanceof Error ? err.message : 'Something went wrong. Please try again.'
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
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Video className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-sm font-bold text-white">Audio to YouTube MP4</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-4 sm:py-6 flex flex-col gap-3 sm:gap-4 min-h-full">

          {/* ERROR */}
          {isError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <h3 className="text-lg font-bold text-white text-center">Conversion Failed</h3>
              <p className="text-sm text-red-300/80 text-center max-w-xs">{conversionState.message}</p>
              <button
                onClick={resetAll}
                className="w-full max-w-xs py-3.5 bg-slate-800 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-indigo-500"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {/* IDLE */}
          {isIdle && !resultVideoUrl && (
            <>
              <div className="text-center pt-1 sm:pt-4">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Convert MP3 to <span className="text-indigo-400">MP4 Video</span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Pick a cover image and audio file, then tap convert.
                </p>
              </div>

              {validationError && (
                <div className="bg-red-950/30 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{validationError}</p>
                </div>
              )}

              <div className="flex flex-col gap-2.5 sm:gap-3">
                <FileUploader
                  label="1. Cover Image"
                  accept="image/jpeg,image/png,image/webp"
                  hint="JPG, PNG, or WebP"
                  selectedFileName={image.name}
                  previewUrl={image.previewUrl}
                  onFileSelect={handleImageSelect}
                  icon={<ImageIcon className="w-6 h-6" />}
                />

                <FileUploader
                  label="2. Audio File"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a"
                  hint="MP3, WAV, OGG, AAC, or M4A"
                  selectedFileName={audio.name}
                  onFileSelect={handleAudioSelect}
                  icon={<Music className="w-6 h-6" />}
                />

                {audioDuration && (
                  <p className="text-xs text-slate-500 text-center">
                    Duration: {audioDuration} &middot; Conversion takes about the same time
                  </p>
                )}
              </div>

              {/* Image preview */}
              {image.previewUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-700/50 aspect-video bg-black">
                  <img src={image.previewUrl} alt="Cover preview" className="w-full h-full object-contain" />
                </div>
              )}

              <button
                disabled={!canConvert}
                onClick={startConversion}
                className="w-full py-3.5 sm:py-4 bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-indigo-500"
              >
                <Video className="w-5 h-5" />
                Convert to MP4
              </button>

              {!canConvert && (
                <p className="text-xs text-slate-600 text-center">
                  {!image.file && !audio.file ? 'Select a cover image and audio file to start' :
                   !image.file ? 'Select a cover image to continue' : 'Select an audio file to continue'}
                </p>
              )}

              <p className="text-xs text-slate-600 text-center mt-auto pb-1 pt-2">
                All files stay on your device &middot; Not affiliated with YouTube
              </p>
            </>
          )}

          {/* CONVERTING */}
          {isConverting && (
            <div className="flex-1 flex flex-col gap-4 justify-center py-4">
              <div className="aspect-video rounded-xl overflow-hidden bg-black border border-slate-700 relative">
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-red-600 rounded flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-[10px] text-white font-bold uppercase tracking-wide">REC</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <div>
                    <h3 className="text-base font-bold text-white">Converting...</h3>
                    <p className="text-sm text-slate-400">{conversionState.message}</p>
                  </div>
                  <span className="text-2xl sm:text-3xl font-bold text-indigo-400 tabular-nums">{conversionState.progress}%</span>
                </div>

                <div
                  className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={conversionState.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Conversion progress"
                >
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-[width] duration-300"
                    style={{ width: `${conversionState.progress}%` }}
                  />
                </div>

                <p className="text-xs text-slate-500 text-center">
                  Keep this tab open &middot; Screen will stay on
                </p>

                <button
                  onClick={cancelConversion}
                  className="w-full py-3 text-slate-400 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform rounded-xl border border-slate-700/50 focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* COMPLETE */}
          {isComplete && resultVideoUrl && (
            <div className="flex-1 flex flex-col gap-3 sm:gap-4 justify-center py-4">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <h2 className="text-lg font-bold text-white">Conversion Complete</h2>
                <p className="text-sm text-slate-400 mt-1">{conversionState.message}</p>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video">
                <video src={resultVideoUrl} controls className="w-full h-full" playsInline />
              </div>

              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = resultVideoUrl;
                  a.download = `youtube-video-${Date.now()}.${outputExt}`;
                  a.click();
                }}
                className="w-full py-3.5 sm:py-4 bg-emerald-600 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-emerald-500"
              >
                <Download className="w-5 h-5" />
                Download {outputExt.toUpperCase()}
              </button>

              <button
                onClick={resetAll}
                className="w-full py-3 text-slate-500 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-indigo-500"
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
