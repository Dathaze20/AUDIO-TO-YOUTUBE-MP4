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
        w-full border-2 border-dashed rounded-2xl py-6 px-5 flex flex-col items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] min-h-[130px]
        ${selectedFileName
          ? 'border-emerald-500/60 bg-emerald-950/15'
          : 'border-slate-600/60 bg-slate-800/30'}
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
        w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden
        ${selectedFileName ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}
      `}>
        {previewUrl ? (
          <img src={previewUrl} alt="Selected cover preview" className="w-full h-full object-cover" />
        ) : (
          icon
        )}
      </div>

      {selectedFileName ? (
        <>
          <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
            {selectedFileName.length > 28 ? selectedFileName.substring(0, 25) + '...' : selectedFileName}
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          </span>
          <span className="text-xs text-slate-500">Tap to change</span>
        </>
      ) : (
        <>
          <span className="text-base font-semibold text-slate-200">{label}</span>
          <span className="text-xs text-slate-500">{hint}</span>
        </>
      )}
    </button>
  );
};

export default FileUploader;
