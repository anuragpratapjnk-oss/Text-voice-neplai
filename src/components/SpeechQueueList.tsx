import React from 'react';
import {
  FileAudio,
  FileVideo,
  Play,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { SpeechTranscriptionJob } from '../types';
import { formatTime } from '../utils/audioExtractor';

interface SpeechQueueListProps {
  jobs: SpeechTranscriptionJob[];
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  onStartTranscription: (id: string) => void;
  onRetryJob: (id: string) => void;
  onDeleteJob: (id: string) => void;
  onTranscribeAll: () => void;
  onClearQueue: () => void;
  onExportAllZip: () => void;
  isProcessingQueue: boolean;
}

export const SpeechQueueList: React.FC<SpeechQueueListProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onStartTranscription,
  onRetryJob,
  onDeleteJob,
  onTranscribeAll,
  onClearQueue,
  onExportAllZip,
  isProcessingQueue,
}) => {
  if (jobs.length === 0) {
    return null;
  }

  const idleCount = jobs.filter((j) => j.status === 'idle').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div id="speech-queue-list-container" className="space-y-4">
      {/* Queue Header & Batch Operations Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-slate-800">
            Transcription Queue ({jobs.length})
          </h3>
          <div className="flex items-center gap-1.5 text-xs">
            {completedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                {completedCount} completed
              </span>
            )}
            {idleCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {idleCount} waiting
              </span>
            )}
            {failedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                {failedCount} failed
              </span>
            )}
          </div>
        </div>

        {/* Batch actions */}
        <div className="flex items-center gap-2">
          {idleCount > 0 && (
            <button
              id="speech-transcribe-all-btn"
              type="button"
              onClick={onTranscribeAll}
              disabled={isProcessingQueue}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isProcessingQueue ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Transcribe All ({idleCount})</span>
            </button>
          )}

          {completedCount > 0 && (
            <button
              id="speech-download-all-zip-btn"
              type="button"
              onClick={onExportAllZip}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download All (ZIP)</span>
            </button>
          )}

          <button
            id="speech-clear-queue-btn"
            type="button"
            onClick={onClearQueue}
            className="text-xs font-medium text-slate-400 hover:text-red-600 px-2 py-1.5 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* List of Queue Cards */}
      <div className="space-y-2.5">
        {jobs.map((job, index) => {
          const isSelected = selectedJobId === job.id;
          const isAudio = job.mediaType === 'audio';
          const isDone = job.status === 'completed';
          const isError = job.status === 'failed';
          const isWorking =
            job.status === 'extracting_audio' ||
            job.status === 'detecting_language' ||
            job.status === 'transcribing' ||
            job.status === 'formatting';

          return (
            <div
              key={job.id}
              id={`speech-job-card-${job.id}`}
              onClick={() => onSelectJob(job.id)}
              className={`group relative rounded-2xl border transition-all duration-200 p-4 cursor-pointer ${
                isSelected
                  ? 'border-sky-500 bg-sky-50/40 ring-2 ring-sky-100 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: Index & Media Icon */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-xs font-mono font-medium text-slate-400 w-5">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isAudio
                        ? 'bg-sky-50 text-sky-600 border border-sky-100'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    }`}
                  >
                    {isAudio ? (
                      <FileAudio className="w-5 h-5" />
                    ) : (
                      <FileVideo className="w-5 h-5" />
                    )}
                  </div>

                  {/* File Title & Metadata */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-800 truncate max-w-xs md:max-w-md">
                        {job.fileName}
                      </h4>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          isAudio
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {isAudio ? 'Audio' : 'Video'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{formatFileSize(job.fileSize)}</span>
                      {job.durationSec > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(job.durationSec, true)}
                          </span>
                        </>
                      )}
                      {job.primaryLanguage && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600 font-medium">
                            {job.primaryLanguage}
                          </span>
                        </>
                      )}
                      {job.segments && job.segments.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{job.segments.length} segments</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status badge & action buttons */}
                <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Status Indicator */}
                  {isWorking && (
                    <div className="flex items-center gap-2 text-xs font-medium text-sky-600 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="hidden sm:inline">{job.statusMessage}</span>
                      <span>({job.progress}%)</span>
                    </div>
                  )}

                  {isDone && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ready</span>
                    </div>
                  )}

                  {isError && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 max-w-xs">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span className="truncate">{job.error || 'Transcription failed'}</span>
                    </div>
                  )}

                  {/* Actions */}
                  {job.status === 'idle' && (
                    <button
                      id={`speech-transcribe-btn-${job.id}`}
                      type="button"
                      onClick={() => onStartTranscription(job.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Transcribe</span>
                    </button>
                  )}

                  {isDone && (
                    <button
                      id={`speech-view-editor-btn-${job.id}`}
                      type="button"
                      onClick={() => onSelectJob(job.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open Editor</span>
                    </button>
                  )}

                  {isError && (
                    <button
                      id={`speech-retry-btn-${job.id}`}
                      type="button"
                      onClick={() => onRetryJob(job.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}

                  <button
                    id={`speech-delete-btn-${job.id}`}
                    type="button"
                    onClick={() => onDeleteJob(job.id)}
                    title="Remove from queue"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* In-progress progress bar strip */}
              {isWorking && (
                <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, job.progress)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
