
import React, { useRef } from 'react';
import { Upload, CheckCircle2 } from 'lucide-react';

interface FileUploaderProps {
  label: string;
  accept: string;
  icon: React.ReactNode;
  onFileSelect: (file: File) => void;
  selectedFileName?: string;
  previewUrl?: string | null;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  label, 
  accept, 
  icon, 
  onFileSelect, 
  selectedFileName,
  previewUrl
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`
        relative group cursor-pointer border-2 border-dashed rounded-[28px] py-5 px-4 flex flex-col items-center justify-center transition-all duration-500 active:scale-[0.98] w-full
        ${selectedFileName 
          ? 'border-cyan-500 bg-cyan-950/20 neon-cyan shadow-inner' 
          : 'border-slate-800 bg-slate-900/40 hover:border-blue-500 hover:bg-slate-900/60 shadow-lg'}
      `}
    >
      <input 
        type="file" 
        ref={inputRef} 
        onChange={handleChange} 
        accept={accept} 
        className="hidden" 
      />
      
      <div className={`
        w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 overflow-hidden mb-2
        ${selectedFileName ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.6)]' : 'bg-slate-800 text-slate-500'}
      `}>
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="scale-110">{icon}</div>
        )}
      </div>
      
      <div className="text-center">
        <h3 className={`font-extrabold text-base tracking-tight leading-tight ${selectedFileName ? 'text-cyan-400 neon-text-blue' : 'text-slate-300'}`}>
          {selectedFileName ? (
            <span className="flex items-center gap-2 justify-center">
              {selectedFileName.length > 25 ? selectedFileName.substring(0, 22) + '...' : selectedFileName}
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            </span>
          ) : label}
        </h3>
        <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 ${selectedFileName ? 'text-cyan-500' : 'text-slate-600'}`}>
          {selectedFileName ? 'DATA LOCKED' : 'Tap to select from phone'}
        </p>
      </div>
    </div>
  );
};

export default FileUploader;
