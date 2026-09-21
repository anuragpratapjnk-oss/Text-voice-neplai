import React, { useState } from 'react';
import {
  Mic,
  Sparkles,
  ShieldCheck,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import { useSpeechTranscriptionQueue } from '../hooks/useSpeechTranscriptionQueue';
import { SpeechBulkUploader } from './SpeechBulkUploader';
import { SpeechSettingsBar } from './SpeechSettingsBar';
import { SpeechQueueList } from './SpeechQueueList';
import { SpeechTranscriptEditor } from './SpeechTranscriptEditor';

interface SpeechToTextViewProps {
  authToken?: string | null;
}

export const SpeechToTextView: React.FC<SpeechToTextViewProps> = ({ authToken }) => {
  const {
    jobs,
    selectedJob,
    selectedJobId,
    setSelectedJobId,
    options,
    setOptions,
    isProcessingQueue,
    addFiles,
    startTranscription,
    transcribeAll,
    retryJob,
    deleteJob,
    clearQueue,
    updateSegment,
    renameSpeaker,
    exportAllAsZip,
  } = useSpeechTranscriptionQueue(authToken);

  const [activeViewMode, setActiveViewMode] = useState<'queue' | 'editor'>('queue');

  const handleSelectJob = (id: string) => {
    setSelectedJobId(id);
    const target = jobs.find((j) => j.id === id);
    if (target && target.status === 'completed') {
      setActiveViewMode('editor');
    }
  };

  // If user is viewing the editor for a selected completed job
  if (activeViewMode === 'editor' && selectedJob && selectedJob.status === 'completed') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <SpeechTranscriptEditor
          job={selectedJob}
          onBack={() => setActiveViewMode('queue')}
          onUpdateSegment={(segId, newText) => updateSegment(selectedJob.id, segId, newText)}
          onRenameSpeaker={(oldSpk, newSpk) => renameSpeaker(selectedJob.id, oldSpk, newSpk)}
        />
      </div>
    );
  }

  return (
    <div id="speech-to-text-view" className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
              AI Speech to Text
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              High Accuracy
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Transcribe audio and video files with first-class support for English, Nepali, Hindi, speaker diarization, audio event tagging, and word-level timestamps.
          </p>
        </div>

        {/* Feature summary pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Nepali & Hindi in Devanagari</span>
          </span>
          <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>Server FFmpeg Extraction</span>
          </span>
        </div>
      </div>

      {/* Bulk Drag-and-Drop Area */}
      <SpeechBulkUploader onFilesAdded={addFiles} disabled={isProcessingQueue} />

      {/* Settings Bar */}
      <SpeechSettingsBar
        options={options}
        onChange={setOptions}
        disabled={isProcessingQueue}
      />

      {/* Queue and Job List */}
      <SpeechQueueList
        jobs={jobs}
        selectedJobId={selectedJobId}
        onSelectJob={handleSelectJob}
        onStartTranscription={startTranscription}
        onRetryJob={retryJob}
        onDeleteJob={deleteJob}
        onTranscribeAll={transcribeAll}
        onClearQueue={clearQueue}
        onExportAllZip={exportAllAsZip}
        isProcessingQueue={isProcessingQueue}
      />
    </div>
  );
};
