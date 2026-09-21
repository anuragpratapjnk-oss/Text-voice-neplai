import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileAudio,
  FileVideo,
  Sparkles,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';

interface SpeechBulkUploaderProps {
  onFilesAdded: (files: FileList | File[]) => void;
  disabled?: boolean;
}

const SUPPORTED_AUDIO = ['MP3', 'WAV', 'M4A', 'AAC', 'FLAC', 'OGG', 'OPUS'];
const SUPPORTED_VIDEO = ['MP4', 'MOV', 'AVI', 'MKV', 'WEBM', 'MPEG'];

export const SpeechBulkUploader: React.FC<SpeechBulkUploaderProps> = ({
  onFilesAdded,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(e.target.files);
      // Reset input value so the same file can be uploaded again if needed
      e.target.value = '';
    }
  };

  return (
    <div
      id="speech-bulk-uploader"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`relative group cursor-pointer transition-all duration-300 rounded-2xl border-2 border-dashed p-8 md:p-10 text-center ${
        isDragOver
          ? 'border-sky-500 bg-sky-50/80 ring-4 ring-sky-100 shadow-lg'
          : 'border-slate-300 hover:border-sky-400 bg-white hover:bg-slate-50/70 shadow-sm'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.mp4,.mov,.avi,.mkv,.webm,.mpeg,.wmv"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
        id="speech-file-input"
      />

      <div className="flex flex-col items-center justify-center max-w-xl mx-auto space-y-4">
        {/* Upload Icon Circle with subtle pulse */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 ${
            isDragOver
              ? 'bg-sky-500 text-white scale-110 shadow-md shadow-sky-200'
              : 'bg-slate-100 group-hover:bg-sky-100 text-slate-600 group-hover:text-sky-600'
          }`}
        >
          <UploadCloud className="w-8 h-8" />
        </div>

        {/* Primary Prompt */}
        <div className="space-y-1">
          <h3 className="text-lg md:text-xl font-semibold text-slate-800 tracking-tight">
            Drop your audio or video files here
          </h3>
          <p className="text-sm text-slate-500">
            or{' '}
            <span className="text-sky-600 font-medium hover:underline inline-flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" /> browse from your computer
            </span>
          </p>
        </div>

        {/* High Accuracy & Features Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Bulk upload (up to 50 files)
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> English, Nepali & Hindi First-Class
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-medium">
            Speaker Diarization & Word Timestamps
          </span>
        </div>

        {/* Formats list chips */}
        <div className="pt-2 border-t border-slate-100 w-full flex flex-col md:flex-row items-center justify-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <FileAudio className="w-3.5 h-3.5 text-sky-500" />
            <span className="font-medium text-slate-600">Audio:</span>
            <span>{SUPPORTED_AUDIO.join(', ')}</span>
          </div>
          <span className="hidden md:inline text-slate-300">•</span>
          <div className="flex items-center gap-1.5">
            <FileVideo className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-medium text-slate-600">Video:</span>
            <span>{SUPPORTED_VIDEO.join(', ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
