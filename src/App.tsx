import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Video,
  Music,
  Image as ImageIcon,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  X,
  RefreshCw,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import { FileState, ConversionStatus, ConversionProgress } from './types';
import { formatTime, validateFile } from './utils';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a'];

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch {}
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

  // Track blob URLs in refs so cleanup doesn't depend on stale state
  const imageUrlRef = useRef<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const drawFnRef = useRef<(() => void) | null>(null);
  const isPausedRef = useRef(false);

  // Pause/resume conversion when the tab loses/regains visibility (phone calls, app switching)
  useEffect(() => {
    const onVisibility = async () => {
      if (conversionState.status !== ConversionStatus.CONVERTING) return;

      if (document.visibilityState === 'hidden') {
        // Pause everything
        isPausedRef.current = true;
        if (recorderRef.current?.state === 'recording') recorderRef.current.pause();
        if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
        if (renderLoopRef.current) { cancelAnimationFrame(renderLoopRef.current); renderLoopRef.current = null; }
        setConversionState(prev => ({ ...prev, message: 'Paused — return to continue' }));
      } else if (document.visibilityState === 'visible' && isPausedRef.current) {
        // Resume everything
        isPausedRef.current = false;
        if ('wakeLock' in navigator) {
          try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
        }
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        if (recorderRef.current?.state === 'paused') recorderRef.current.resume();
        if (audioRef.current) {
          try { await audioRef.current.play(); } catch {}
        }
        if (drawFnRef.current) drawFnRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [conversionState.status]);

  const handleImageSelect = useCallback((file: File) => {
    const error = validateFile(file, ACCEPTED_IMAGE_TYPES, 'Image');
    if (error) {
      setValidationError(error);
      vibrate([50, 30, 50]);
      return;
    }
    setValidationError(null);
    // Clean up old URL using ref (avoids stale closure)
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    const url = URL.createObjectURL(file);
    imageUrlRef.current = url;
    setImage({ file, previewUrl: url, name: file.name });
    vibrate(15);
  }, []);

  const handleAudioSelect = useCallback((file: File) => {
    const error = validateFile(file, ACCEPTED_AUDIO_TYPES, 'Audio');
    if (error) {
      setValidationError(error);
      vibrate([50, 30, 50]);
      return;
    }
    setValidationError(null);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(file);
    audioUrlRef.current = url;
    setAudio({ file, previewUrl: url, name: file.name });
    vibrate(15);
    const tmp = new Audio(url);
    tmp.addEventListener('loadedmetadata', () => {
      if (isFinite(tmp.duration)) setAudioDuration(formatTime(tmp.duration));
    });
  }, []);

  const stopRecording = useCallback(() => {
    const state = recorderRef.current?.state;
    if (state === 'recording' || state === 'paused') recorderRef.current!.stop();
    if (renderLoopRef.current) { cancelAnimationFrame(renderLoopRef.current); renderLoopRef.current = null; }
    if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch {} wakeLockRef.current = null; }
    isPausedRef.current = false;
    drawFnRef.current = null;
  }, []);

  const cancelConversion = useCallback(() => {
    stopRecording();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setConversionState({ status: ConversionStatus.IDLE, progress: 0, message: '' });
    vibrate(30);
  }, [stopRecording]);

  const resetAll = useCallback(() => {
    stopRecording();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (resultVideoUrl) URL.revokeObjectURL(resultVideoUrl);
    if (imageUrlRef.current) { URL.revokeObjectURL(imageUrlRef.current); imageUrlRef.current = null; }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    setImage({ file: null, previewUrl: null, name: '' });
    setAudio({ file: null, previewUrl: null, name: '' });
    setAudioDuration('');
    setConversionState({ status: ConversionStatus.IDLE, progress: 0, message: '' });
    setResultVideoUrl(null);
    setOutputExt('mp4');
    setValidationError(null);
    vibrate(15);
  }, [resultVideoUrl, stopRecording]);

  const startConversion = async () => {
    if (!image.file || !audio.file || !audioRef.current) return;
    vibrate(30);

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

      // First-frame warmup: paint the cover image before creating the capture
      // stream so the video track is immediately marked active on mobile Chrome.
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 1280, 720);
      const ratio = Math.max(1280 / img.width, 720 / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (1280 - w) / 2, (720 - h) / 2, w, h);

      // Audio routing: reuse persistent AudioContext to prevent mobile crashes
      if (!audioContextRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

      // Prefer WebM with explicit audio codec — MP4 MediaRecorder on some
      // Android devices drops audio when only the video codec is specified.
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')
          ? 'video/mp4;codecs=avc1,mp4a.40.2'
          : MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
            ? 'video/mp4;codecs=avc1'
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
        vibrate([100, 50, 100]);
        setConversionState({
          status: ConversionStatus.ERROR, progress: 0,
          message: 'Recording failed unexpectedly. Try a shorter file or restart.'
        });
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(finalBlob);
        setResultVideoUrl(url);
        setConversionState({ status: ConversionStatus.COMPLETED, progress: 100, message: 'Done' });
        vibrate([40, 60, 40, 60, 80]);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube-video-${Date.now()}.${ext}`;
        a.click();
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

      drawFnRef.current = draw;
      audioRef.current.currentTime = 0;
      await audioCtx.resume();
      recorder.start();
      await audioRef.current.play();
      draw();

    } catch (err) {
      console.error('Conversion failed:', err);
      vibrate([100, 50, 100]);
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

  const isPaused = conversionState.message.startsWith('Paused');

  return (
    <div className="h-[100dvh] flex flex-col text-slate-100 font-sans overflow-hidden relative" style={{ background: '#060612' }}>

      {/* Ambient background orbs — CSS only, zero JS */}
      <div className="orb w-72 h-72 top-[-60px] left-[-60px] opacity-30" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
      <div className="orb w-64 h-64 bottom-[-40px] right-[-40px] opacity-20" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }} />
      <div className="orb w-48 h-48 top-[40%] right-[-30px] opacity-10" style={{ background: 'radial-gradient(circle, #ec4899, transparent 70%)' }} />

      {/* Header */}
      <header className="shrink-0 relative z-10">
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(6,6,18,0.7)', backdropFilter: 'blur(20px)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg relative" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <div className="absolute inset-0 rounded-xl opacity-40" style={{ background: 'linear-gradient(135deg, #a78bfa, transparent)', filter: 'blur(4px)' }} />
            <Video className="w-[18px] h-[18px] text-white relative z-10" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight leading-none" style={{ background: 'linear-gradient(90deg, #e0e7ff, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Audio to YouTube MP4
            </h1>
            <span className="text-[10px] text-slate-500 leading-none mt-0.5">v1.0.2</span>
          </div>
          <a
            href="https://github.com/Dathaze20/AUDIO-TO-YOUTUBE-MP4/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto p-2 text-slate-600 hover:text-slate-300 active:text-slate-200 transition-colors rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-500"
            aria-label="Send feedback"
            title="Send feedback"
          >
            <MessageSquare className="w-4 h-4" />
          </a>
        </div>
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(139,92,246,0.4), transparent)' }} />
      </header>

      <main className="flex-1 min-h-0 overflow-hidden relative z-10">
        <div className="max-w-xl mx-auto px-4 py-2 sm:py-4 flex flex-col gap-2 sm:gap-3 h-full">

          {/* ERROR */}
          {isError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Conversion Failed</h3>
                <p className="text-sm mt-1 max-w-xs" style={{ color: 'rgba(252,165,165,0.8)' }}>{conversionState.message}</p>
              </div>
              <button
                onClick={resetAll}
                className="w-full max-w-xs py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-indigo-500"
                style={{ background: 'rgba(30,30,60,0.8)', border: '1px solid rgba(99,102,241,0.3)', color: '#e0e7ff' }}
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {/* IDLE */}
          {isIdle && !resultVideoUrl && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="text-center pt-1 pb-1">
                <h2 className="text-xl font-extrabold tracking-tight">
                  <span className="text-white">Create a </span>
                  <span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    YouTube-Ready Video
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Pick a cover image and audio file, then tap create.</p>
              </div>

              {validationError && (
                <div className="rounded-xl px-4 py-2.5 flex items-start gap-3 mb-2" style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{validationError}</p>
                </div>
              )}

              <div className="flex flex-col landscape:flex-row gap-2.5 flex-1 min-h-0">
                <FileUploader
                  label="1. Cover Image"
                  accept="image/jpeg,image/png,image/webp"
                  hint="JPG, PNG, or WebP"
                  selectedFileName={image.name}
                  previewUrl={image.previewUrl}
                  onFileSelect={handleImageSelect}
                  icon={<ImageIcon className="w-7 h-7" />}
                />
                <FileUploader
                  label="2. Audio File"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a"
                  hint="MP3, WAV, OGG, AAC, or M4A"
                  selectedFileName={audio.name}
                  onFileSelect={handleAudioSelect}
                  icon={<Music className="w-7 h-7" />}
                />
              </div>

              {audioDuration && (
                <p className="text-xs text-slate-600 text-center mt-1">
                  Duration: {audioDuration} &middot; Conversion takes about the same time
                </p>
              )}

              <div className="mt-auto pt-2 space-y-2">
                <button
                  disabled={!canConvert}
                  onClick={startConversion}
                  className={`w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-indigo-500 ${canConvert ? 'btn-glow' : ''}`}
                  style={canConvert
                    ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: '1px solid rgba(139,92,246,0.5)' }
                    : { background: 'rgba(15,15,30,0.6)', color: 'rgba(100,116,139,0.7)', border: '1px solid rgba(51,65,85,0.3)' }
                  }
                >
                  {canConvert ? <Sparkles className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  Create Video
                </button>

                <p className="text-xs text-slate-600 text-center pb-0.5">
                  {!canConvert
                    ? (!image.file && !audio.file ? 'Select a cover image and audio file to start'
                      : !image.file ? 'Select a cover image to continue'
                      : 'Select an audio file to continue')
                    : 'Creates MP4 or WebM depending on your browser · Both upload to YouTube'}
                </p>
              </div>
            </div>
          )}

          {/* CONVERTING */}
          {isConverting && (
            <div className="flex-1 flex flex-col gap-3 justify-center py-2">
              {/* Canvas preview */}
              <div className="aspect-video rounded-2xl overflow-hidden relative" style={{
                border: `1px solid ${isPaused ? 'rgba(217,119,6,0.4)' : 'rgba(99,102,241,0.35)'}`,
                boxShadow: isPaused ? '0 0 24px rgba(217,119,6,0.15)' : '0 0 32px rgba(99,102,241,0.2)',
                background: '#000'
              }}>
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
                {/* REC / PAUSED badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg flex items-center gap-1.5" style={{
                  background: isPaused ? 'rgba(180,83,9,0.85)' : 'rgba(220,38,38,0.85)',
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${isPaused ? 'rgba(251,191,36,0.3)' : 'rgba(248,113,113,0.3)'}`,
                }}>
                  <div className={`w-1.5 h-1.5 rounded-full bg-white ${isPaused ? '' : 'animate-pulse'}`} />
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest">{isPaused ? 'PAUSED' : 'REC'}</span>
                </div>
                {/* Animated waveform — visible only when recording */}
                {!isPaused && (
                  <div className="absolute bottom-2.5 right-2.5 flex items-end gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="wave-bar" style={{ background: 'rgba(165,180,252,0.7)' }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Progress info */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(15,15,35,0.7)', border: '1px solid rgba(99,102,241,0.15)', backdropFilter: 'blur(12px)' }}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: isPaused ? '#fcd34d' : '#e0e7ff' }}>
                      {isPaused ? 'Paused' : 'Converting...'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{conversionState.message}</p>
                  </div>
                  <span className="text-2xl font-bold tabular-nums" style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {conversionState.progress}%
                  </span>
                </div>

                <div
                  className="h-2 w-full rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={conversionState.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Conversion progress"
                  style={{ background: 'rgba(30,27,75,0.8)' }}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${!isPaused ? 'progress-shimmer' : ''}`}
                    style={{
                      width: `${conversionState.progress}%`,
                      ...(isPaused ? { background: 'linear-gradient(90deg, #d97706, #f59e0b)' } : {})
                    }}
                  />
                </div>

                <p className="text-xs text-center" style={{ color: 'rgba(100,116,139,0.8)' }}>
                  {isPaused ? 'Return to this tab to resume' : 'Keep this tab open · Screen will stay on'}
                </p>
              </div>

              <button
                onClick={cancelConversion}
                className="w-full py-2.5 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-500"
                style={{ color: 'rgba(100,116,139,0.8)', border: '1px solid rgba(51,65,85,0.4)' }}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}

          {/* COMPLETE */}
          {isComplete && resultVideoUrl && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 py-4">
              {/* Success icon with ring pulse */}
              <div className="relative flex items-center justify-center">
                <div className="success-ring absolute w-24 h-24 rounded-full" style={{ border: '2px solid rgba(52,211,153,0.5)' }} />
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-xl font-bold text-white">Video Saved</h2>
                <p className="text-sm mt-0.5" style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 600 }}>
                  as .{outputExt}
                </p>
                <p className="text-xs text-slate-500 mt-1">Check your Downloads folder</p>
              </div>

              <button
                onClick={resetAll}
                className="w-16 h-16 rounded-full flex items-center justify-center active:scale-[0.95] transition-transform focus-visible:outline-2 focus-visible:outline-indigo-500"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
                aria-label="Convert another video"
              >
                <RefreshCw className="w-6 h-6" />
              </button>
              <p className="text-xs text-slate-600">Tap to convert another</p>
            </div>
          )}
        </div>
      </main>

      <audio
        ref={audioRef}
        src={audio.previewUrl || ''}
        className="hidden"
        playsInline
        preload="auto"
      />
    </div>
  );
};

export default App;
