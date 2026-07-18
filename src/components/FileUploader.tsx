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
      className="w-full flex-1 rounded-2xl flex flex-col items-center justify-center gap-2.5 p-4 transition-all duration-200 active:scale-[0.98] min-h-[100px] max-h-[200px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      style={selectedFileName ? {
        background: 'rgba(16,185,129,0.06)',
        border: '1px solid rgba(52,211,153,0.25)',
        boxShadow: '0 0 20px -4px rgba(16,185,129,0.12), inset 0 1px 0 rgba(52,211,153,0.08)',
        backdropFilter: 'blur(12px)',
      } : {
        background: 'rgba(15,15,35,0.5)',
        border: '1px solid rgba(99,102,241,0.15)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
      }}
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

      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
        style={selectedFileName ? {
          background: 'rgba(16,185,129,0.15)',
          border: '1px solid rgba(52,211,153,0.2)',
          color: '#6ee7b7',
        } : {
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
          border: '1px solid rgba(99,102,241,0.15)',
          color: 'rgba(148,163,184,0.7)',
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : icon}
      </div>

      <div className="text-center min-w-0 w-full px-2 overflow-hidden">
        <div className="flex items-center justify-center gap-1.5">
          <span
            className="text-sm font-semibold truncate max-w-[80%]"
            style={selectedFileName
              ? { background: 'linear-gradient(90deg, #6ee7b7, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
              : { color: 'rgba(224,231,255,0.85)' }
            }
          >
            {selectedFileName || label}
          </span>
          {selectedFileName && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        </div>
        <span className="text-xs block mt-0.5" style={{ color: 'rgba(100,116,139,0.7)' }}>
          {selectedFileName ? 'Tap to change' : hint}
        </span>
      </div>
    </button>
  );
};

export default FileUploader;
