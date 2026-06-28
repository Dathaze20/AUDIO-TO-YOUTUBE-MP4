import React, { useRef } from 'react';
import { Upload, CheckCircle2 } from 'lucide-react';

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
        w-full text-left border-2 border-dashed rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 active:scale-[0.98]
        ${selectedFileName
          ? 'border-emerald-500/60 bg-emerald-950/20'
          : 'border-slate-700 bg-slate-800/40 hover:border-indigo-500/60 hover:bg-slate-800/60'}
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
        ${selectedFileName ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400'}
      `}>
        {previewUrl ? (
          <img src={previewUrl} alt="Selected cover preview" className="w-full h-full object-cover" />
        ) : (
          icon
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm truncate ${selectedFileName ? 'text-emerald-400' : 'text-slate-200'}`}>
            {selectedFileName || label}
          </span>
          {selectedFileName && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {selectedFileName ? 'Tap to change' : hint}
        </p>
      </div>

      {!selectedFileName && (
        <Upload className="w-5 h-5 text-slate-500 shrink-0" />
      )}
    </button>
  );
};

export default FileUploader;
