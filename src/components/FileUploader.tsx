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
        w-full border-2 border-dashed rounded-2xl p-4 flex items-center gap-4
        transition-all duration-200 active:scale-[0.98]
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500
        ${selectedFileName
          ? 'border-emerald-500/50 bg-emerald-950/10'
          : 'border-slate-600/50 bg-slate-800/20'}
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
        ${selectedFileName ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/40 text-slate-400'}
      `}>
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : icon}
      </div>

      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold truncate ${selectedFileName ? 'text-emerald-400' : 'text-slate-200'}`}>
            {selectedFileName || label}
          </span>
          {selectedFileName && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        </div>
        <span className="text-xs text-slate-500 block mt-0.5">
          {selectedFileName ? 'Tap to change' : hint}
        </span>
      </div>
    </button>
  );
};

export default FileUploader;
