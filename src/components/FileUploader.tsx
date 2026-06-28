import React, { useRef } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';

interface FileUploaderProps {
  label: string;
  accept: string;
  hint: string;
  icon: React.ReactNode;
  onFileSelect: (file: File) => void;
  selectedFileName?: string;
  previewUrl?: string | null;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  label,
  accept,
  hint,
  icon,
  onFileSelect,
  selectedFileName,
  previewUrl
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={`
        w-full rounded-2xl p-4 flex items-center gap-3.5
        transition-all duration-200 active:scale-[0.98]
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500
        ${selectedFileName
          ? 'bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]'
          : 'bg-slate-800/60 border border-slate-700/50 shadow-lg shadow-black/20'}
      `}
      aria-label={selectedFileName ? `${label}: ${selectedFileName}. Tap to change.` : `${label}. Tap to select file.`}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = '';
        }}
        accept={accept}
        className="hidden"
      />

      <div className={`
        w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden
        ${selectedFileName
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-gradient-to-br from-slate-700/60 to-slate-700/30 text-slate-300'}
      `}>
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : icon}
      </div>

      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold truncate ${selectedFileName ? 'text-emerald-400' : 'text-white'}`}>
            {selectedFileName || label}
          </span>
          {selectedFileName && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        </div>
        <span className="text-xs text-slate-500 block mt-0.5">
          {selectedFileName ? 'Tap to change' : hint}
        </span>
      </div>

      <ChevronRight className={`w-4 h-4 shrink-0 ${selectedFileName ? 'text-emerald-500/40' : 'text-slate-600'}`} />
    </button>
  );
};

export default FileUploader;
