
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, 
  Music, 
  Image as ImageIcon, 
  CheckCircle2, 
  ChevronRight, 
  Download, 
  Check, 
  RefreshCw,
  Zap
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import { FileState, RenderStatus, RenderingProgress } from './types';

const App: React.FC = () => {
  const [image, setImage] = useState<FileState>({ file: null, previewUrl: null, name: '' });
  const [audio, setAudio] = useState<FileState>({ file: null, previewUrl: null, name: '' });
  const [agreed, setAgreed] = useState(false);
  const [renderStatus, setRenderStatus] = useState<RenderingProgress>({
    status: RenderStatus.IDLE,
    progress: 0,
    message: ''
  });
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [totalTimeFormatted, setTotalTimeFormatted] = useState('0:00');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const renderLoopRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  
  // Persistent refs to prevent "already connected" errors and context garbage collection
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    if (renderLoopRef.current) {
      cancelAnimationFrame(renderLoopRef.current);
    }
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release(); } catch(e) {}
    }
  };

  const startConversion = async () => {
    if (!image.file || !audio.file || !audioRef.current || !agreed) return;

    try {
      setRenderStatus({
        status: RenderStatus.RENDERING,
        progress: 0,
        message: 'Initializing Core...'
      });

      // 1. Keep screen alive
      if ('wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (e) {}
      }

      // 2. Wait for Audio Metadata (CRITICAL for mobile)
      if (audioRef.current.readyState < 1 && audioRef.current.duration === 0) {
        await new Promise((resolve) => {
          const onLoaded = () => {
            audioRef.current?.removeEventListener('loadedmetadata', onLoaded);
            audioRef.current?.removeEventListener('canplay', onLoaded);
            resolve(null);
          };
          audioRef.current?.addEventListener('loadedmetadata', onLoaded);
          audioRef.current?.addEventListener('canplay', onLoaded);
          
          // Fallback timeout
          setTimeout(onLoaded, 5000);
        });
      }

      // 2.1. Wait for DOM to update with the new status (Canvas to mount)
      let canvas = canvasRef.current;
      let attempts = 0;
      const maxAttempts = 150; // Increased to ~3 seconds
      
      while (!canvas && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 20));
        canvas = canvasRef.current;
        attempts++;
      }

      if (!canvas) {
        console.error("Canvas hardware not found after", attempts, "attempts");
        throw new Error('Console Hardware Not Found');
      }

      const ctx = canvas.getContext('2d', { alpha: false })!;
      canvas.width = 1280;
      canvas.height = 720;

      const img = new Image();
      img.src = image.previewUrl!;
      await new Promise((r) => img.onload = r);

      // 3. Audio Routing Fix: Re-use or initialize persistent context
      if (!audioContextRef.current) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        audioContextRef.current = new AudioContextClass();
      }
      
      const audioCtx = audioContextRef.current;
      const dest = audioCtx.createMediaStreamDestination();

      // Ensure we don't connect the same element twice (common mobile crash)
      if (!audioSourceRef.current) {
        audioSourceRef.current = audioCtx.createMediaElementSource(audioRef.current);
      }
      
      audioSourceRef.current.disconnect();
      audioSourceRef.current.connect(audioCtx.destination); // For preview
      audioSourceRef.current.connect(dest);                // For recorder

      const videoStream = canvas.captureStream(30); 
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      // 4. Stable Codecs: prioritize high-compatibility mobile profiles
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Recording not supported on this browser');
      }

      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') 
        ? 'video/mp4;codecs=avc1' 
        : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') 
          ? 'video/webm;codecs=vp8,opus' 
          : 'video/webm');

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('Video format not supported on this device');
      }

      // 5. Bitrate Safety: Lowered slightly to 5Mbps for hardware encoder stability
      const recorder = new MediaRecorder(combinedStream, { 
        mimeType, 
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 128000   
      });
      
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(finalBlob);
        setResultVideoUrl(url);
        setRenderStatus({ status: RenderStatus.COMPLETED, progress: 100, message: 'Mastering Done' });
      };

      let lastUpdate = 0;
      const draw = () => {
        if (!ctx || !audioRef.current) return;
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1280, 720);
        
        const ratio = Math.max(1280 / img.width, 720 / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (1280 - w) / 2;
        const y = (720 - h) / 2;
        ctx.drawImage(img, x, y, w, h);

        const now = Date.now();
        const time = audioRef.current.currentTime;
        const duration = audioRef.current.duration;

        if (now - lastUpdate > 100) { // Throttle UI updates to 10fps
          const p = Math.floor((time / duration) * 100);

          setRenderStatus(prev => ({ 
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
      setTotalTimeFormatted(formatTime(audioRef.current.duration));
      draw();

    } catch (err) {
      console.error("Mastering Failure:", err);
      // Display the actual error message to help diagnose the specific issue
      const errorMessage = err instanceof Error ? err.message.toUpperCase() : 'CORE RESET REQUIRED';
      setRenderStatus({ 
        status: RenderStatus.ERROR, 
        progress: 0, 
        message: errorMessage 
      });
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col text-slate-100 font-sans selection:bg-blue-900 overflow-hidden antialiased bg-slate-950">
      <header className="bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 p-3 flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center neon-blue shadow-blue-500/20">
            <Video className="w-5 h-5 text-white" strokeWidth={3} />
          </div>
          <h1 className="text-base font-black tracking-tighter text-white italic">VocalCanvas</h1>
        </div>
        <div className="px-3 py-1 bg-blue-900/30 border border-blue-500/40 rounded-full flex items-center gap-2">
           <span className="text-[7px] font-black text-blue-400 uppercase tracking-[0.2em] neon-text-blue">STABLE V2.5</span>
           <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 flex flex-col justify-center min-h-0 py-2 gap-3 overflow-hidden">
        <AnimatePresence mode="wait">
          {renderStatus.status === RenderStatus.ERROR && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="p-8 text-center bg-red-900/20 border border-red-500/50 rounded-[32px] w-full"
            >
               <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/40 animate-pulse">
                  <Zap className="w-8 h-8 text-white" strokeWidth={3} />
               </div>
               <h3 className="text-xl font-black text-white italic tracking-tight mb-2">SYSTEM CRITICAL</h3>
               <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-6 leading-relaxed">{renderStatus.message}</p>
               <button onClick={() => window.location.reload()} className="w-full py-4 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  EMERGENCY BOOT
               </button>
            </motion.div>
          )}

          {renderStatus.status === RenderStatus.IDLE && !resultVideoUrl && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-3"
            >
            <div className="text-center space-y-0.5">
              <h2 className="text-xl font-black text-white leading-none tracking-tighter">
                CONVERT MP3 TO <span className="text-cyan-400 neon-text-blue">HD VIDEO</span>
              </h2>
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-[0.25em] italic">High-Fidelity One-Page Console</p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-md p-4 rounded-[32px] border border-slate-800 flex flex-col gap-3 shadow-2xl">
              <div className="grid gap-2">
                <FileUploader 
                  label="1. Background Art" 
                  accept="image/*" 
                  selectedFileName={image.name}
                  previewUrl={image.previewUrl}
                  onFileSelect={(f) => {
                    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
                    setImage({ file: f, previewUrl: URL.createObjectURL(f), name: f.name });
                  }}
                  icon={<ImageIcon className="w-6 h-6" />} 
                />

                <FileUploader 
                  label="2. Master Audio (MP3)" 
                  accept="audio/*" 
                  selectedFileName={audio.name}
                  onFileSelect={(f) => {
                    if (audio.previewUrl) URL.revokeObjectURL(audio.previewUrl);
                    setAudio({ file: f, previewUrl: URL.createObjectURL(f), name: f.name });
                  }}
                  icon={<Music className="w-6 h-6" />} 
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
                <div 
                  className={`flex items-center gap-3 p-3 rounded-[20px] border transition-all duration-300 cursor-pointer ${agreed ? 'bg-blue-600/20 border-blue-500/50 neon-blue' : 'bg-slate-950/40 border-slate-800'}`}
                  onClick={() => setAgreed(!agreed)}
                >
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${agreed ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800 border border-slate-700'}`}>
                    {agreed && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${agreed ? 'text-blue-400' : 'text-slate-600'}`}>
                    Signal Chain Locked & Ready
                  </span>
                </div>

                <button 
                  disabled={!image.file || !audio.file || !agreed}
                  onClick={startConversion}
                  className="w-full py-4 bg-blue-600 disabled:bg-slate-800 disabled:text-slate-700 text-white rounded-[20px] font-black text-base shadow-[0_8px_16px_-4px_rgba(37,99,235,0.4)] transition-all active:scale-[0.96] flex items-center justify-center gap-3 italic"
                >
                  ENGAGE MASTERING
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {renderStatus.status === RenderStatus.RENDERING && (
          <motion.div 
            key="rendering"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex flex-col gap-4 max-h-[80vh] justify-center"
          >
            <div className="aspect-video rounded-[28px] overflow-hidden bg-black shadow-2xl relative border border-slate-800 shrink-0">
              <canvas ref={canvasRef} className="w-full h-full object-contain opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 flex flex-col justify-between p-4">
                 <div className="px-2.5 py-1 bg-red-600 rounded-md flex items-center gap-1.5 animate-pulse w-fit">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    <span className="text-[7px] text-white font-black uppercase tracking-widest">REC</span>
                 </div>
                 <div className="space-y-1">
                    <div className="w-full h-[1px] bg-white/5 overflow-hidden">
                       <div className="h-full bg-cyan-400 w-full animate-[slide_2s_infinite]" />
                    </div>
                    <p className="text-[8px] text-white/30 font-black tracking-[0.3em] uppercase">MASTERING ENGINE ACTIVE</p>
                 </div>
              </div>
            </div>
            
            <div className="space-y-4 px-2">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white italic uppercase neon-text-blue tracking-tight">Processing</h3>
                  <p className="text-[9px] text-cyan-400 font-black tracking-[0.1em] bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-800/30">
                    {renderStatus.message}
                  </p>
                </div>
                <span className="text-4xl font-black text-cyan-400 italic tabular-nums neon-text-blue leading-none">{renderStatus.progress}%</span>
              </div>
              
              <div className="h-5 w-full bg-slate-950 rounded-full p-1 border border-slate-800 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.4)]" 
                  style={{ width: `${renderStatus.progress}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {resultVideoUrl && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col gap-4 h-full max-h-[85vh] justify-center"
          >
            <div className="text-center space-y-1 shrink-0">
              <div className="w-14 h-14 bg-cyan-400 rounded-xl flex items-center justify-center mx-auto mb-1 shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                <CheckCircle2 className="w-8 h-8 text-slate-950" strokeWidth={3} />
              </div>
              <h2 className="text-xl font-black text-white italic tracking-tight neon-text-blue leading-none">MASTER FINALIZED</h2>
              <p className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">{totalTimeFormatted} Render Verified</p>
            </div>
            
            <div className="rounded-[28px] overflow-hidden shadow-2xl border border-slate-800 bg-black aspect-video shrink-0">
              <video src={resultVideoUrl} controls className="w-full h-full" />
            </div>
            
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = resultVideoUrl;
                  a.download = `VocalCanvas_Master_${Date.now()}.mp4`;
                  a.click();
                }}
                className="w-full py-5 bg-cyan-500 text-slate-950 rounded-[20px] font-black text-lg shadow-cyan-400/30 shadow-lg flex items-center justify-center gap-3 italic tracking-tight transition-transform active:scale-[0.96]"
              >
                <Download className="w-6 h-6" strokeWidth={3} />
                SAVE HD MASTER
              </button>
              <button onClick={() => window.location.reload()} className="text-slate-600 font-black text-[9px] uppercase tracking-[0.3em] py-2 flex items-center justify-center gap-2">
                <RefreshCw className="w-3 h-3" />
                RESTART CONSOLE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>

      <footer className="py-2.5 text-center border-t border-slate-900 bg-slate-950/60 shrink-0">
        <p className="text-slate-600 text-[7px] font-black uppercase tracking-[0.3em]">SECURE LOCAL MASTERING CORE • v2.5 FINAL</p>
      </footer>

      {/* No crossOrigin used for local blobs to avoid security blocks on phone browsers */}
      <audio 
        ref={audioRef} 
        src={audio.previewUrl || ''} 
        className="hidden" 
        playsInline 
        preload="auto"
      />
      
      <style>{`
        @keyframes slide {
          from { transform: translateX(-100%); }
          to { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default App;
