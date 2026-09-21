import React, { useState, useMemo } from 'react';
import { ScriptItem, ScriptStatus, DialogueLine } from '../types';
import { ScriptUploadZone } from './ScriptUploadZone';
import { ScriptDetailsModal } from './ScriptDetailsModal';
import {
  FileText,
  Search,
  SlidersHorizontal,
  Download,
  Trash2,
  RefreshCw,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Eye,
  Send,
  MoreVertical,
  CheckSquare,
  Square,
  ArrowUpDown,
  Filter,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Archive,
  Edit2,
  FileCheck,
} from 'lucide-react';

interface ScriptTranscriptionViewProps {
  queue: {
    scripts: ScriptItem[];
    isQueuePaused: boolean;
    setIsQueuePaused: (paused: boolean) => void;
    uploadFiles: (files: FileList | File[]) => void;
    addRawScript: (title: string, content: string, fileType?: string) => void;
    loadPresetBatch: (presets: Array<{ fileName: string; content: string; fileType: string }>) => void;
    retryScript: (id: string) => void;
    retryAllFailed: () => void;
    processAllScripts: () => void;
    deleteScript: (id: string) => void;
    deleteMultipleScripts: (ids: string[]) => void;
    renameScript: (id: string, newFileName: string) => void;
    clearAllScripts: () => void;
    downloadTranscriptions: (ids: string[], mode?: 'zip' | 'merged_txt' | 'json' | 'txt') => Promise<void>;
  };
  onSendToTTS: (mode: 'single' | 'dialogue', text?: string, dialogueLines?: DialogueLine[]) => void;
}

export const ScriptTranscriptionView: React.FC<ScriptTranscriptionViewProps> = ({
  queue,
  onSendToTTS,
}) => {
  const {
    scripts,
    isQueuePaused,
    setIsQueuePaused,
    uploadFiles,
    addRawScript,
    loadPresetBatch,
    retryScript,
    retryAllFailed,
    processAllScripts,
    deleteScript,
    deleteMultipleScripts,
    renameScript,
    clearAllScripts,
    downloadTranscriptions,
  } = queue;

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScriptStatus>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'words_desc' | 'status'>('date_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal inspection state
  const [inspectedScript, setInspectedScript] = useState<ScriptItem | null>(null);

  // Rename inline state
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [tempRenameValue, setTempRenameValue] = useState<string>('');

  // Stats calculation
  const totalCount = scripts.length;
  const completedCount = scripts.filter((s) => s.status === 'completed').length;
  const processingCount = scripts.filter((s) => s.status === 'processing').length;
  const queuedCount = scripts.filter((s) => s.status === 'queued').length;
  const failedCount = scripts.filter((s) => s.status === 'failed').length;

  const totalWords = scripts.reduce((acc, s) => acc + (s.wordCount || 0), 0);
  const totalEstimatedSec = scripts.reduce((acc, s) => acc + (s.estimatedDurationSec || 0), 0);
  const totalAudioMins = Math.ceil(totalEstimatedSec / 60);

  // Filtered & Sorted scripts
  const filteredScripts = useMemo(() => {
    return scripts
      .filter((item) => {
        // Status filter
        if (statusFilter !== 'all' && item.status !== statusFilter) {
          return false;
        }
        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.fileName.toLowerCase().includes(q);
          const matchTitle = item.transcription?.title?.toLowerCase().includes(q);
          const matchContent = item.rawContent.toLowerCase().includes(q);
          const matchSpeaker = item.transcription?.speakers?.some((s) =>
            s.name.toLowerCase().includes(q)
          );
          return matchName || matchTitle || matchContent || matchSpeaker;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return b.uploadedAt - a.uploadedAt;
        if (sortBy === 'date_asc') return a.uploadedAt - b.uploadedAt;
        if (sortBy === 'name_asc') return a.fileName.localeCompare(b.fileName);
        if (sortBy === 'words_desc') return (b.wordCount || 0) - (a.wordCount || 0);
        if (sortBy === 'status') return a.status.localeCompare(b.status);
        return 0;
      });
  }, [scripts, statusFilter, searchQuery, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredScripts.length / pageSize));
  const paginatedScripts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredScripts.slice(start, start + pageSize);
  }, [filteredScripts, currentPage, pageSize]);

  // Adjust page if out of bounds
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllCurrentPage = () => {
    const pageIds = paginatedScripts.map((s) => s.id);
    const allPageSelected = pageIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllMatching = () => {
    const allIds = filteredScripts.map((s) => s.id);
    setSelectedIds(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk actions
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    deleteMultipleScripts(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkRetry = () => {
    selectedIds.forEach((id) => retryScript(id));
    setSelectedIds(new Set());
  };

  const handleBulkDownload = (format: 'zip' | 'merged_txt' | 'json') => {
    if (selectedIds.size === 0) return;
    downloadTranscriptions(Array.from(selectedIds), format);
  };

  const startInlineRename = (script: ScriptItem) => {
    setEditingScriptId(script.id);
    setTempRenameValue(script.fileName);
  };

  const saveInlineRename = (id: string) => {
    if (tempRenameValue.trim()) {
      renameScript(id, tempRenameValue.trim());
    }
    setEditingScriptId(null);
  };

  const isAllCurrentPageSelected =
    paginatedScripts.length > 0 && paginatedScripts.every((s) => selectedIds.has(s.id));

  return (
    <div className="space-y-6">
      {/* Top Metrics / Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Scripts
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 flex items-center justify-between">
            <span>{totalCount}</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
            Completed
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1 flex items-center justify-between">
            <span>{completedCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider">
            Processing / Queued
          </div>
          <div className="text-xl font-bold text-sky-700 mt-1 flex items-center justify-between">
            <span>{processingCount + queuedCount}</span>
            <RefreshCw
              className={`w-4 h-4 text-sky-500 ${processingCount > 0 ? 'animate-spin' : ''}`}
            />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">
            Failed / Retries
          </div>
          <div className="text-xl font-bold text-rose-700 mt-1 flex items-center justify-between">
            <span>{failedCount}</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Words & Duration
          </div>
          <div className="text-sm font-bold text-slate-800 mt-1.5 flex items-center justify-between">
            <span>
              {totalWords.toLocaleString()} w • ~{totalAudioMins}m
            </span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Upload & Dropzone Area */}
      <ScriptUploadZone
        onUploadFiles={uploadFiles}
        onAddRawScript={addRawScript}
        onLoadPresetBatch={loadPresetBatch}
        totalScriptsCount={totalCount}
      />

      {/* Main Scripts Management Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
        {/* Table Controls & Filter Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                id="search-scripts-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search scripts by title, speaker, or dialogue text..."
                className="w-full pl-9 pr-4 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Queue Operations & Bulk Process Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="transcribe-all-btn"
                onClick={processAllScripts}
                className="px-3 py-2 bg-sky-600 hover:bg-sky-700 active:scale-98 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="Process all queued scripts"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Transcribe All</span>
              </button>

              <button
                type="button"
                id="pause-resume-queue-btn"
                onClick={() => setIsQueuePaused(!isQueuePaused)}
                className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isQueuePaused
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {isQueuePaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-amber-700 fill-amber-700" />
                    <span>Resume Queue</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pause Queue</span>
                  </>
                )}
              </button>

              {failedCount > 0 && (
                <button
                  type="button"
                  id="retry-failed-btn"
                  onClick={retryAllFailed}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
                  <span>Retry All Failed ({failedCount})</span>
                </button>
              )}

              {totalCount > 0 && (
                <button
                  type="button"
                  id="clear-all-scripts-btn"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all uploaded scripts?')) {
                      clearAllScripts();
                      setSelectedIds(new Set());
                    }
                  }}
                  className="px-2.5 py-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  title="Clear all scripts"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Status Tabs & Sort Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'all', label: `All (${totalCount})` },
                  { id: 'completed', label: `Completed (${completedCount})` },
                  { id: 'processing', label: `Processing (${processingCount})` },
                  { id: 'queued', label: `Queued (${queuedCount})` },
                  { id: 'failed', label: `Failed (${failedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  id={`status-filter-${tab.id}`}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-sky-600 text-white shadow-2xs font-semibold'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sorting & Page Size Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  id="sort-by-select"
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="words_desc">Longest (Words)</option>
                  <option value="status">By Status</option>
                </select>
              </div>

              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden"
                title="Items per page"
              >
                <option value={10}>10 / page</option>
                <option value={15}>15 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar (if items selected) */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-200 flex items-center justify-between gap-3 flex-wrap animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-900">
                {selectedIds.size} of {filteredScripts.length} selected
              </span>
              <button
                type="button"
                onClick={handleSelectAllMatching}
                className="text-[11px] text-sky-700 hover:underline cursor-pointer"
              >
                Select all {filteredScripts.length} matching
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[11px] text-slate-500 hover:underline cursor-pointer ml-1"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleBulkDownload('zip')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-sky-600" />
                <span>Download as ZIP</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkDownload('merged_txt')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Merged TXT</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkDownload('json')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>JSON</span>
              </button>

              <button
                type="button"
                onClick={handleBulkRetry}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Script Table / List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-10">
                  <button
                    type="button"
                    onClick={handleSelectAllCurrentPage}
                    className="p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                    title="Select all on this page"
                  >
                    {isAllCurrentPageSelected ? (
                      <CheckSquare className="w-4 h-4 text-sky-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Script / File Name</th>
                <th className="py-3 px-4 w-48">Status & Progress</th>
                <th className="py-3 px-4 w-36">Words & Duration</th>
                <th className="py-3 px-4 w-44 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedScripts.length > 0 ? (
                paginatedScripts.map((script) => {
                  const isSelected = selectedIds.has(script.id);
                  const isEditing = editingScriptId === script.id;

                  return (
                    <tr
                      key={script.id}
                      id={`script-row-${script.id}`}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-sky-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(script.id)}
                          className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* File Name & Title */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold bg-slate-100 text-slate-600">
                              {script.fileType}
                            </span>

                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={tempRenameValue}
                                  onChange={(e) => setTempRenameValue(e.target.value)}
                                  className="text-xs font-semibold px-2 py-0.5 border border-sky-400 rounded focus:outline-hidden"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => saveInlineRename(script.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                >
                                  ✓
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <button
                                  type="button"
                                  onClick={() => setInspectedScript(script)}
                                  className="font-semibold text-slate-900 hover:text-sky-600 text-left transition-colors cursor-pointer truncate max-w-xs sm:max-w-md"
                                >
                                  {script.fileName}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startInlineRename(script)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5 transition-opacity cursor-pointer"
                                  title="Rename"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {script.transcription?.title && script.transcription.title !== script.fileName && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                              "{script.transcription.title}"
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status & Progress */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            {script.status === 'completed' && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Completed
                              </span>
                            )}

                            {script.status === 'processing' && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Processing
                              </span>
                            )}

                            {script.status === 'queued' && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Clock className="w-3 h-3" />
                                Queued
                              </span>
                            )}

                            {script.status === 'failed' && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertCircle className="w-3 h-3" />
                                Failed
                              </span>
                            )}
                          </div>

                          {/* Progress Bar for active states */}
                          {script.status === 'processing' && (
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-sky-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(15, script.progress)}%` }}
                              />
                            </div>
                          )}

                          <div className="text-[10px] text-slate-400 truncate">
                            {script.error ? (
                              <span className="text-rose-600 font-medium" title={script.error}>
                                {script.error}
                              </span>
                            ) : (
                              script.statusMessage
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Words & Duration */}
                      <td className="py-3 px-4 text-slate-600">
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-800">
                            {script.wordCount.toLocaleString()} words
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ~{script.estimatedDurationSec}s audio ({script.pageCount}p)
                          </div>
                          {script.transcription?.speakers && (
                            <div className="text-[10px] text-sky-700 font-medium">
                              {script.transcription.speakers.length} speakers
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Row Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setInspectedScript(script)}
                            className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="Inspect full transcript & dialogue"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {script.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (script.transcription?.dialogueLines) {
                                  const lines: DialogueLine[] = script.transcription.dialogueLines.map(
                                    (l, i) => ({
                                      id: String(i + 1),
                                      speaker: l.speaker,
                                      voice: l.voice || 'Kore',
                                      text: l.text,
                                    })
                                  );
                                  onSendToTTS('dialogue', undefined, lines);
                                } else {
                                  onSendToTTS('single', script.rawContent);
                                }
                              }}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Send to TTS Studio for Speech Synthesis"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          {script.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => retryScript(script.id)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Retry script transcription"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => downloadTranscriptions([script.id], 'txt')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Download transcript"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteScript(script.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete script"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    <div className="max-w-sm mx-auto space-y-2">
                      <FileText className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-700">No scripts found</p>
                      <p className="text-[11px] text-slate-400">
                        {searchQuery
                          ? 'No scripts match your search criteria. Try a different query.'
                          : 'Upload or paste scripts above to begin automated batch transcription.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Scalable Pagination Footer */}
        {filteredScripts.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing{' '}
              <strong className="text-slate-700">
                {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, filteredScripts.length)}
              </strong>{' '}
              of <strong className="text-slate-700">{filteredScripts.length}</strong> scripts
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="pagination-prev-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-2 text-xs font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </div>

              <button
                type="button"
                id="pagination-next-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Script Inspection Modal */}
      {inspectedScript && (
        <ScriptDetailsModal
          script={inspectedScript}
          onClose={() => setInspectedScript(null)}
          onRename={renameScript}
          onRetry={retryScript}
          onSendToTTS={onSendToTTS}
        />
      )}
    </div>
  );
};
