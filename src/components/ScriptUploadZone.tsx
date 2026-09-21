import React, { useState, useRef } from 'react';
import { SAMPLE_SCRIPT_PRESETS } from '../data/sampleScripts';
import {
  Upload,
  FileText,
  Sparkles,
  Plus,
  FolderUp,
  AlertCircle,
  CheckCircle2,
  FileCode,
  FileAudio,
  Layers,
} from 'lucide-react';

interface ScriptUploadZoneProps {
  onUploadFiles: (files: FileList | File[]) => void;
  onAddRawScript: (title: string, content: string, fileType?: string) => void;
  onLoadPresetBatch: (presets: Array<{ fileName: string; content: string; fileType: string }>) => void;
  totalScriptsCount: number;
}

export const ScriptUploadZone: React.FC<ScriptUploadZoneProps> = ({
  onUploadFiles,
  onAddRawScript,
  onLoadPresetBatch,
  totalScriptsCount,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pastedTitle, setPastedTitle] = useState<string>('Custom Script');
  const [pastedContent, setPastedContent] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setWarningMessage(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // reset input
    e.target.value = '';
  };

  const processFiles = (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const validFiles: File[] = [];
    const rejected: string[] = [];

    fileList.forEach((file) => {
      // 25MB max check per file
      if (file.size > 25 * 1024 * 1024) {
        rejected.push(`${file.name} (exceeds 25MB limit)`);
      } else {
        validFiles.push(file);
      }
    });

    if (rejected.length > 0) {
      setWarningMessage(`Some files were skipped: ${rejected.join(', ')}`);
    }

    if (validFiles.length > 0) {
      onUploadFiles(validFiles);
    }
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedContent.trim()) return;

    onAddRawScript(pastedTitle.trim() || 'Untitled Script', pastedContent.trim(), 'txt');
    setPastedContent('');
    setPastedTitle('Custom Script');
    setShowPasteModal(false);
  };

  const handleLoadSampleBatch = (count: number) => {
    const selected = SAMPLE_SCRIPT_PRESETS.slice(0, count);
    onLoadPresetBatch(
      selected.map((s) => ({
        fileName: s.fileName,
        content: s.content,
        fileType: s.fileType,
      }))
    );
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop Hero Box */}
      <div
        id="script-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all bg-white shadow-2xs ${
          isDragging
            ? 'border-sky-500 bg-sky-50/60 ring-4 ring-sky-500/10'
            : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="script-file-input"
          multiple
          accept=".txt,.md,.fountain,.json,.csv,.srt,.vtt,.docx,.pdf,.mp3,.wav,.m4a,.ogg"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <input
          ref={(node) => {
            folderInputRef.current = node;
            if (node) {
              node.setAttribute('webkitdirectory', '');
              node.setAttribute('directory', '');
            }
          }}
          type="file"
          id="script-folder-input"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="max-w-xl mx-auto space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-sky-100/70 text-sky-700 flex items-center justify-center mx-auto shadow-2xs">
            <Upload className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Upload Scripts & Recordings in Bulk
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Drag & drop as many script files as you need, or select files/folders. Supports{' '}
              <strong className="text-slate-700 font-medium">TXT, Markdown, Fountain screenplays, SRT/VTT subtitles, JSON</strong>, and audio speech files.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              id="upload-files-btn"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:scale-98 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Select Script Files</span>
            </button>

            <button
              type="button"
              id="upload-folder-btn"
              onClick={() => folderInputRef.current?.click()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Upload an entire directory containing scripts"
            >
              <FolderUp className="w-4 h-4 text-slate-500" />
              <span>Upload Folder</span>
            </button>

            <button
              type="button"
              id="paste-raw-script-btn"
              onClick={() => setShowPasteModal(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Paste Text</span>
            </button>
          </div>

          {/* Fast Sample Batch Loaders */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 flex-wrap text-xs text-slate-500">
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Test with Sample Batches:
            </span>
            <button
              type="button"
              id="load-sample-5-btn"
              onClick={() => handleLoadSampleBatch(5)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
            >
              + 5 Diverse Scripts
            </button>
            <button
              type="button"
              id="load-sample-10-btn"
              onClick={() => handleLoadSampleBatch(10)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
            >
              + 10 Scale Batch (All Genres)
            </button>
          </div>
        </div>
      </div>

      {/* Warning message if any */}
      {warningMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{warningMessage}</span>
          <button
            type="button"
            onClick={() => setWarningMessage(null)}
            className="ml-auto text-amber-900 font-bold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Paste Script Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-sky-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Paste Script or Dialogue</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 bg-slate-100 rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handlePasteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Script Title / File Name
                </label>
                <input
                  type="text"
                  value={pastedTitle}
                  onChange={(e) => setPastedTitle(e.target.value)}
                  placeholder="e.g. Episode_3_Podcast_Script"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Script Text Content
                </label>
                <textarea
                  rows={8}
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder="Paste screenplays, interview lines, speech transcripts, or raw dialogues here..."
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 font-mono leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  {pastedContent.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasteModal(false)}
                    className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!pastedContent.trim()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-all cursor-pointer"
                  >
                    Add to Queue
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
