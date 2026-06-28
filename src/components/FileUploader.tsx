import React, { useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';

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
        w-full flex-1 rounded-2xl flex flex-col items-center justify-center gap-2.5 p-4
        transition-all duration-200 active:scale-[0.98] min-h-[100px] max-h-[200px]
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500
        ${selectedFileName
          ? 'bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_20px_-3px_rgba(16,185,129,0.15)]'
          : 'bg-slate-800/40 border border-slate-700/40 shadow-lg shadow-black/20'}
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
        w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden
        ${selectedFileName
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-gradient-to-br from-slate-700/60 to-slate-700/30 text-slate-400'}
      `}>
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : icon}
      </div>

      <div className="text-center min-w-0">
        <div className="flex items-center justify-center gap-1.5">
          <span className={`text-base font-semibold truncate ${selectedFileName ? 'text-emerald-400' : 'text-white'}`}>
            {selectedFileName || label}
          </span>
          {selectedFileName && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        </div>
        <span className="text-xs text-slate-500 block mt-1">
          {selectedFileName ? 'Tap to change' : hint}
        </span>
      </div>
    </button>
  );
};

export default FileUploader;
