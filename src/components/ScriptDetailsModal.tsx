import React, { useState } from 'react';
import { ScriptItem, DialogueLine } from '../types';
import { VOICES } from '../data/presets';
import { useVoicePreview } from '../hooks/useVoicePreview';
import {
  X,
  FileText,
  Clock,
  BookOpen,
  Volume2,
  Users,
  Download,
  Copy,
  Check,
  Play,
  Square,
  Sparkles,
  RefreshCw,
  Send,
  Sliders,
  Edit2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface ScriptDetailsModalProps {
  script: ScriptItem;
  onClose: () => void;
  onRename: (id: string, newName: string) => void;
  onRetry: (id: string) => void;
  onSendToTTS: (mode: 'single' | 'dialogue', text?: string, dialogueLines?: DialogueLine[]) => void;
}

export const ScriptDetailsModal: React.FC<ScriptDetailsModalProps> = ({
  script,
  onClose,
  onRename,
  onRetry,
  onSendToTTS,
}) => {
  const [activeTab, setActiveTab] = useState<'formatted' | 'dialogue' | 'raw' | 'summary'>('formatted');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>(script.fileName);
  const [copied, setCopied] = useState<boolean>(false);

  const { playingVoice, playPreview, stopPreview } = useVoicePreview();

  const transcription = script.transcription;

  const handleSaveTitle = () => {
    if (editedTitle.trim()) {
      onRename(script.id, editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: 'txt' | 'json' | 'srt') => {
    let content = '';
    let mimeType = 'text/plain';
    let ext = format;

    if (format === 'json') {
      content = JSON.stringify(
        {
          fileName: script.fileName,
          uploadedAt: script.uploadedAt,
          status: script.status,
          wordCount: script.wordCount,
          transcription: script.transcription,
        },
        null,
        2
      );
      mimeType = 'application/json';
    } else if (format === 'srt') {
      const lines = transcription?.dialogueLines || [];
      content = lines
        .map((l, i) => {
          const startSec = i * 4;
          const endSec = startSec + 3;
          const fmt = (s: number) =>
            `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')},000`;
          return `${i + 1}\n${fmt(startSec)} --> ${fmt(endSec)}\n${l.speaker}: ${l.text}\n`;
        })
        .join('\n');
    } else {
      content = transcription?.fullFormattedText || script.rawContent;
    }

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.fileName.replace(/\.[^/.]+$/, '')}_transcription.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToTTSDialogue = () => {
    if (transcription?.dialogueLines && transcription.dialogueLines.length > 0) {
      const lines: DialogueLine[] = transcription.dialogueLines.map((l, idx) => ({
        id: String(idx + 1),
        speaker: l.speaker,
        voice: l.voice || 'Kore',
        text: l.text,
      }));
      onSendToTTS('dialogue', undefined, lines);
      onClose();
    } else {
      onSendToTTS('single', script.rawContent);
      onClose();
    }
  };

  const handleSendToTTSSingle = () => {
    const textToSend = transcription?.fullFormattedText || script.rawContent;
    onSendToTTS('single', textToSend);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-base font-bold text-slate-900 px-2 py-0.5 border border-sky-400 rounded-md focus:outline-hidden"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTitle}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 truncate">
                    {script.fileName}
                  </h2>
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Rename script"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Status Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider shrink-0 ${
                  script.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : script.status === 'processing'
                    ? 'bg-sky-100 text-sky-800 animate-pulse'
                    : script.status === 'failed'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {script.status}
              </span>
            </div>

            {/* Sub-meta */}
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {script.wordCount} words (~{script.pageCount} pages)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Est. Duration ~{script.estimatedDurationSec}s ({Math.ceil(script.estimatedDurationSec / 60)} min)
              </span>
              {transcription?.language && (
                <>
                  <span>•</span>
                  <span>Lang: {transcription.language}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {script.status === 'failed' && (
              <button
                type="button"
                onClick={() => onRetry(script.id)}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action / Send to TTS Bar */}
        <div className="px-4 py-2.5 bg-sky-50/50 border-b border-sky-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-sky-900 font-medium">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <span>Ready for Voice Synthesis:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSendToTTSDialogue}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Synthesize in Dialogue Studio</span>
            </button>

            <button
              type="button"
              onClick={handleSendToTTSSingle}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Open in Single Voice</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <button
              type="button"
              onClick={() => handleCopyText(transcription?.fullFormattedText || script.rawContent)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
              title="Copy transcript to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload('txt')}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
              title="Download text file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>TXT</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload('json')}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
              title="Download structured JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-4 bg-white">
          <button
            onClick={() => setActiveTab('formatted')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'formatted'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Formatted Script
          </button>

          <button
            onClick={() => setActiveTab('dialogue')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dialogue'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Speaker Cues ({transcription?.dialogueLines?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'summary'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Overview & Speakers
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Original Raw Text</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-slate-800 text-sm">
          {/* Summary & Speakers Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              {transcription ? (
                <>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Summary & Context
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {transcription.summary}
                    </p>
                    <div className="flex gap-2 pt-1 flex-wrap text-[11px] text-slate-500">
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                        Style: <strong>{transcription.readingLevel || 'Conversational'}</strong>
                      </span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                        Cadence: <strong>{transcription.pacingNote || 'Natural'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Speakers Breakdown with Voice Preview Auditions */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Detected Characters / Speakers
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {transcription.speakers.map((spk, idx) => {
                        const isPlaying = playingVoice === spk.suggestedVoice;
                        const voiceData = VOICES.find((v) => v.id === spk.suggestedVoice);

                        return (
                          <div
                            key={idx}
                            className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900 text-xs">
                                {spk.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {spk.lineCount} lines
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 leading-snug">
                              {spk.toneDescription}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                                Voice: {spk.suggestedVoice}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  if (isPlaying) {
                                    stopPreview();
                                  } else {
                                    playPreview(spk.suggestedVoice, voiceData?.previewSampleText);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                                  isPlaying
                                    ? 'bg-rose-500 text-white animate-pulse'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isPlaying ? (
                                  <Square className="w-3 h-3 fill-current" />
                                ) : (
                                  <Play className="w-3 h-3 fill-current" />
                                )}
                                <span>{isPlaying ? 'Stop' : 'Audition'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Key Highlights */}
                  {transcription.keyHighlights && transcription.keyHighlights.length > 0 && (
                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                        Key Takeaways / Highlights
                      </h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
                        {transcription.keyHighlights.map((hl, i) => (
                          <li key={i}>{hl}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {script.status === 'processing'
                    ? 'Processing transcription overview...'
                    : 'Transcription is queued or has not started yet.'}
                </div>
              )}
            </div>
          )}

          {/* Formatted Script Tab */}
          {activeTab === 'formatted' && (
            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-wrap selection:bg-sky-200">
              {transcription?.fullFormattedText || script.rawContent}
            </div>
          )}

          {/* Dialogue Lines Tab */}
          {activeTab === 'dialogue' && (
            <div className="space-y-3">
              {transcription?.dialogueLines && transcription.dialogueLines.length > 0 ? (
                transcription.dialogueLines.map((line, idx) => {
                  const isPlaying = playingVoice === (line.voice || 'Kore');
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{line.speaker}</span>
                          {line.emotion && (
                            <span className="text-[10px] text-slate-500 italic">
                              ({line.emotion})
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                            {line.voice || 'Kore'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {line.timestamp && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {line.timestamp}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (isPlaying) {
                                stopPreview();
                              } else {
                                playPreview(line.voice || 'Kore', line.text);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                            title="Audition this line"
                          >
                            {isPlaying ? (
                              <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-800 leading-relaxed">{line.text}</p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No line-by-line dialogue parsed yet.
                </div>
              )}
            </div>
          )}

          {/* Raw Text Tab */}
          {activeTab === 'raw' && (
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[50vh]">
              {script.rawContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
