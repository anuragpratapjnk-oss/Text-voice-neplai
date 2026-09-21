import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  X,
  ChevronDown,
  Download,
  Copy,
  Check,
  Edit2,
  Users,
  Sparkles,
  Volume2,
  FileAudio,
  FileVideo,
  Clock,
  ExternalLink,
  ChevronUp,
} from 'lucide-react';
import {
  SpeechTranscriptionJob,
  SpeechTranscriptSegment,
  SpeechWord,
  TranscriptionExportFormat,
} from '../types';
import {
  generateTxt,
  generateSrt,
  generateVtt,
  generateCsv,
  generateJson,
  generateDocxBlob,
  downloadPdfTranscript,
  downloadFile,
  getBaseFileName,
} from '../utils/transcriptExporter';
import { formatTime } from '../utils/audioExtractor';

interface SpeechTranscriptEditorProps {
  job: SpeechTranscriptionJob;
  onBack: () => void;
  onUpdateSegment: (segmentId: string, newText: string) => void;
  onRenameSpeaker: (oldSpeaker: string, newSpeaker: string) => void;
}

export const SpeechTranscriptEditor: React.FC<SpeechTranscriptEditorProps> = ({
  job,
  onBack,
  onUpdateSegment,
  onRenameSpeaker,
}) => {
  // Media playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(job.durationSec || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  // Edit states
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [renamingSpeaker, setRenamingSpeaker] = useState<string | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');

  // UI state
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  // Media element refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  const isVideo = job.mediaType === 'video';

  // Handle media time update
  const handleTimeUpdate = () => {
    const mediaEl = isVideo ? videoRef.current : audioRef.current;
    if (mediaEl) {
      setCurrentTime(mediaEl.currentTime);
      if (mediaEl.duration && !isNaN(mediaEl.duration) && mediaEl.duration > 0) {
        setDuration(mediaEl.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    const mediaEl = isVideo ? videoRef.current : audioRef.current;
    if (mediaEl && mediaEl.duration) {
      setDuration(mediaEl.duration);
    }
  };

  const togglePlay = () => {
    const mediaEl = isVideo ? videoRef.current : audioRef.current;
    if (!mediaEl) return;
    if (isPlaying) {
      mediaEl.pause();
      setIsPlaying(false);
    } else {
      mediaEl.play();
      setIsPlaying(true);
    }
  };

  const seekTo = (seconds: number) => {
    const mediaEl = isVideo ? videoRef.current : audioRef.current;
    if (mediaEl) {
      mediaEl.currentTime = Math.max(0, Math.min(seconds, duration || 99999));
      setCurrentTime(mediaEl.currentTime);
    }
  };

  const skipTime = (delta: number) => {
    const mediaEl = isVideo ? videoRef.current : audioRef.current;
    if (mediaEl) {
      seekTo(mediaEl.currentTime + delta);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    const mediaEl = isVideo ? videoRef.current : audioRef.current;
    if (mediaEl) {
      mediaEl.playbackRate = rate;
    }
  };

  // Find active segment matching currentTime
  const activeSegment = useMemo(() => {
    if (!job.segments || job.segments.length === 0) return null;
    return (
      job.segments.find(
        (seg) => currentTime >= seg.startSec && currentTime <= seg.endSec
      ) || null
    );
  }, [job.segments, currentTime]);

  // Filtered search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const matches: { segmentId: string; index: number }[] = [];
    job.segments.forEach((seg, idx) => {
      if (
        seg.text.toLowerCase().includes(query) ||
        seg.speaker.toLowerCase().includes(query)
      ) {
        matches.push({ segmentId: seg.id, index: idx });
      }
    });
    return matches;
  }, [job.segments, searchQuery]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeSearchIndex + 1) % searchMatches.length;
    setActiveSearchIndex(nextIdx);
    const targetMatch = searchMatches[nextIdx];
    const seg = job.segments.find((s) => s.id === targetMatch.segmentId);
    if (seg) seekTo(seg.startSec);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx =
      (activeSearchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveSearchIndex(prevIdx);
    const targetMatch = searchMatches[prevIdx];
    const seg = job.segments.find((s) => s.id === targetMatch.segmentId);
    if (seg) seekTo(seg.startSec);
  };

  // Copy full transcript text
  const handleCopyTranscript = () => {
    const text = generateTxt(job.segments, true, true);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export handlers
  const handleExport = (format: TranscriptionExportFormat) => {
    setShowExportMenu(false);
    const baseName = getBaseFileName(job.fileName);

    switch (format) {
      case 'txt':
        downloadFile(generateTxt(job.segments, true, true), `${baseName}_transcript.txt`, 'text/plain;charset=utf-8');
        break;
      case 'srt':
        downloadFile(generateSrt(job.segments), `${baseName}_subtitles.srt`, 'text/plain;charset=utf-8');
        break;
      case 'vtt':
        downloadFile(generateVtt(job.segments, job.fileName), `${baseName}_subtitles.vtt`, 'text/vtt;charset=utf-8');
        break;
      case 'json':
        downloadFile(generateJson(job), `${baseName}_transcript.json`, 'application/json;charset=utf-8');
        break;
      case 'csv':
        downloadFile(generateCsv(job.segments), `${baseName}_transcript.csv`, 'text/csv;charset=utf-8');
        break;
      case 'docx':
        downloadFile(generateDocxBlob(job), `${baseName}_transcript.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        break;
      case 'pdf':
        downloadPdfTranscript(job);
        break;
    }
  };

  // Inline edit segment
  const startEditingSegment = (seg: SpeechTranscriptSegment) => {
    setEditingSegmentId(seg.id);
    setEditingText(seg.text);
  };

  const saveEditingSegment = (segmentId: string) => {
    if (editingText.trim()) {
      onUpdateSegment(segmentId, editingText.trim());
    }
    setEditingSegmentId(null);
  };

  // Global speaker rename
  const startRenamingSpeaker = (speaker: string) => {
    setRenamingSpeaker(speaker);
    setNewSpeakerName(speaker);
  };

  const saveRenamingSpeaker = () => {
    if (renamingSpeaker && newSpeakerName.trim()) {
      onRenameSpeaker(renamingSpeaker, newSpeakerName.trim());
    }
    setRenamingSpeaker(null);
  };

  const totalWords = useMemo(() => {
    return job.segments.reduce((acc, s) => acc + (s.text.match(/\S+/g)?.length || 0), 0);
  }, [job.segments]);

  return (
    <div id="speech-transcript-editor" className="flex flex-col h-full min-h-[85vh] bg-slate-50/50 rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            id="speech-editor-back-btn"
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Queue</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-800 truncate max-w-md">
              {job.fileName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                {job.primaryLanguage || 'Auto-Detected'}
              </span>
              <span>•</span>
              <span>{totalWords.toLocaleString()} words</span>
              <span>•</span>
              <span>{formatTime(duration || job.durationSec, true)}</span>
              {job.speakers && job.speakers.length > 0 && (
                <>
                  <span>•</span>
                  <span>{job.speakers.length} speakers</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Copy & Export */}
        <div className="flex items-center gap-2 relative">
          <button
            id="speech-copy-transcript-btn"
            type="button"
            onClick={handleCopyTranscript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Text</span>
              </>
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              id="speech-export-dropdown-btn"
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showExportMenu && (
              <div
                id="speech-export-menu"
                className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs text-slate-700 divide-y divide-slate-100"
              >
                <div className="py-1">
                  <button
                    onClick={() => handleExport('txt')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Plain Text (.txt)</span>
                    <span className="text-[10px] text-slate-400">Verbatim</span>
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Word Document (.docx)</span>
                    <span className="text-[10px] text-sky-600 font-medium">Styled</span>
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>PDF Document (.pdf)</span>
                    <span className="text-[10px] text-slate-400">Direct download</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => handleExport('srt')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>SubRip Subtitles (.srt)</span>
                    <span className="text-[10px] text-slate-400">Video sync</span>
                  </button>
                  <button
                    onClick={() => handleExport('vtt')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>WebVTT Subtitles (.vtt)</span>
                    <span className="text-[10px] text-slate-400">Web captions</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Structured JSON (.json)</span>
                    <span className="text-[10px] text-slate-400">With word times</span>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Spreadsheet (.csv)</span>
                    <span className="text-[10px] text-slate-400">Timestamp table</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Panel Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Panel: Media Player (5 cols on lg) */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-900 text-white flex flex-col justify-between p-6">
          {/* Media Viewport */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
            {isVideo && job.mediaBlobUrl ? (
              <video
                ref={videoRef}
                src={job.mediaBlobUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="w-full max-h-[360px] rounded-xl bg-black object-contain shadow-md"
              />
            ) : (
              <div className="w-full flex flex-col items-center justify-center p-6 bg-slate-800/80 rounded-2xl border border-slate-700/60 shadow-inner">
                {/* Audio Waveform Simulation */}
                <div className="w-16 h-16 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-4">
                  <Volume2 className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-semibold text-slate-200 text-center max-w-xs truncate mb-2">
                  {job.fileName}
                </h4>

                {/* Animated sound bars when playing */}
                <div className="flex items-center gap-1 h-8 my-2">
                  {[40, 70, 90, 60, 30, 80, 100, 50, 75, 45, 85, 60, 30, 65, 95].map(
                    (height, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-150 ${
                          isPlaying ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'
                        }`}
                        style={{
                          height: isPlaying ? `${Math.max(15, height * (0.4 + Math.random() * 0.6))}%` : '20%',
                          animationDelay: `${i * 80}ms`,
                        }}
                      />
                    )
                  )}
                </div>

                {job.mediaBlobUrl && (
                  <audio
                    ref={audioRef}
                    src={job.mediaBlobUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                )}
              </div>
            )}
          </div>

          {/* Player Controls Bar */}
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            {/* Scrub slider */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Play/Pause & Speed Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => skipTime(-5)}
                  title="Rewind 5s"
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-xl bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-sky-500/20"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => skipTime(5)}
                  title="Forward 5s"
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {/* Speed selector */}
              <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl text-xs">
                {[0.75, 1, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handlePlaybackRateChange(rate)}
                    className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                      playbackRate === rate
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Interactive Synchronized Transcript (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col bg-white overflow-hidden">
          {/* Transcript Search Bar */}
          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="speech-search-transcript-input"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveSearchIndex(0);
                }}
                placeholder="Search transcript words or speakers..."
                className="w-full bg-white text-xs pl-9 pr-8 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searchMatches.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>
                  {activeSearchIndex + 1} of {searchMatches.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-600"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-600"
                  >
                    ↓
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Executive Summary Card (Collapsible) */}
          {job.summary && (
            <div className="px-6 py-3 border-b border-slate-100 bg-sky-50/40">
              <div
                onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                className="flex items-center justify-between cursor-pointer py-1 select-none"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-sky-800">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Executive Summary & Key Takeaways</span>
                </div>
                {isSummaryExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-sky-600" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                )}
              </div>

              {isSummaryExpanded && (
                <div className="mt-2 space-y-2 text-xs text-slate-700">
                  <p className="leading-relaxed">{job.summary}</p>
                  {job.keyHighlights && job.keyHighlights.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-slate-600 pt-1">
                      {job.keyHighlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Segments Transcript Scroll List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {job.segments.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p>No speech dialogue detected in this media file.</p>
              </div>
            ) : (
              job.segments.map((seg) => {
                const isActive = activeSegment?.id === seg.id;
                const isEditing = editingSegmentId === seg.id;

                return (
                  <div
                    key={seg.id}
                    ref={isActive ? activeSegmentRef : undefined}
                    id={`speech-seg-${seg.id}`}
                    className={`group rounded-2xl p-4 transition-all duration-200 border ${
                      isActive
                        ? 'bg-sky-50/60 border-sky-300 ring-1 ring-sky-200 shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200/70'
                    }`}
                  >
                    {/* Segment Header: Speaker & Timestamp */}
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {/* Clickable speaker label with rename button */}
                        <div className="relative group/spk flex items-center gap-1.5">
                          {renamingSpeaker === seg.speaker ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={newSpeakerName}
                                onChange={(e) => setNewSpeakerName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveRenamingSpeaker()}
                                className="text-xs font-bold px-2 py-0.5 rounded border border-sky-400 bg-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={saveRenamingSpeaker}
                                className="p-1 rounded bg-sky-500 text-white text-[10px]"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-sky-700 bg-sky-100/60 px-2 py-0.5 rounded-md">
                                {seg.speaker || 'Speaker 1'}
                              </span>
                              <button
                                type="button"
                                onClick={() => startRenamingSpeaker(seg.speaker)}
                                title="Rename speaker globally"
                                className="opacity-0 group-hover/spk:opacity-100 p-1 text-slate-400 hover:text-sky-600 transition-opacity"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Clickable timestamp tag */}
                        <button
                          type="button"
                          onClick={() => seekTo(seg.startSec)}
                          className="flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-400 hover:text-sky-600 hover:bg-sky-50 px-2 py-0.5 rounded transition-colors"
                          title="Click to jump player to this timestamp"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{seg.timestamp || formatTime(seg.startSec)}</span>
                        </button>
                      </div>

                      {/* Right actions: Edit text toggle */}
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditingSegment(seg)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-sky-600 flex items-center gap-1 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {/* Audio Events Chips (e.g. [music], [laughter]) */}
                    {seg.events && seg.events.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {seg.events.map((evt, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80"
                          >
                            <Volume2 className="w-3 h-3 text-amber-500" />
                            {evt.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Spoken Text or Inline Editor */}
                    {isEditing ? (
                      <div className="space-y-2 mt-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          className="w-full text-sm p-2 rounded-xl border border-sky-400 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingSegmentId(null)}
                            className="px-3 py-1 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditingSegment(seg.id)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed text-slate-800">
                        {seg.words && seg.words.length > 0 ? (
                          // Word-Level Interactive Clickable Spans
                          <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                            {seg.words.map((w, wIdx) => {
                              const isWordActive =
                                currentTime >= w.startSec && currentTime <= w.endSec;
                              return (
                                <span
                                  key={wIdx}
                                  onClick={() => seekTo(w.startSec)}
                                  className={`cursor-pointer rounded px-0.5 transition-colors ${
                                    isWordActive
                                      ? 'bg-sky-500 text-white font-medium shadow-sm'
                                      : 'hover:bg-sky-100 hover:text-sky-900'
                                  }`}
                                  title={`Seek to ${formatTime(w.startSec)}`}
                                >
                                  {w.word}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p>{seg.text}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
