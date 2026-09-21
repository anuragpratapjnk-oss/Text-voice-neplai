import { useState, useEffect, useRef, useCallback } from 'react';
import { ScriptItem, ScriptStatus } from '../types';
import JSZip from 'jszip';

const STORAGE_KEY = 'gemini_transcription_scripts_v1';
const MAX_CONCURRENT_WORKERS = 2; // Process 2 scripts in parallel for fast throughput

export function useScriptTranscriptionQueue() {
  const [scripts, setScripts] = useState<ScriptItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Reset any interrupted processing state to queued on reload
        return parsed.map((s: ScriptItem) =>
          s.status === 'processing'
            ? { ...s, status: 'queued', progress: 0, statusMessage: 'Queued for processing' }
            : s
        );
      }
    } catch (e) {
      console.error('Failed to load transcription scripts:', e);
    }
    return [];
  });

  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const activeWorkerCountRef = useRef<number>(0);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    } catch (e) {
      console.error('Failed to save scripts to localStorage:', e);
    }
  }, [scripts]);

  // Update single script in state helper
  const updateScriptItem = useCallback((id: string, updater: Partial<ScriptItem> | ((prev: ScriptItem) => ScriptItem)) => {
    setScripts((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (typeof updater === 'function') {
            return updater(item);
          }
          return { ...item, ...updater };
        }
        return item;
      })
    );
  }, []);

  // Process a single script via API
  const processScriptItem = useCallback(async (item: ScriptItem) => {
    updateScriptItem(item.id, {
      status: 'processing',
      progress: 15,
      statusMessage: 'Reading & parsing script structure...',
      error: undefined,
    });

    try {
      // Progress tick
      const progressTimer = setInterval(() => {
        setScripts((prev) =>
          prev.map((s) => {
            if (s.id === item.id && s.status === 'processing' && s.progress < 85) {
              const nextProgress = s.progress + Math.floor(Math.random() * 15) + 5;
              let nextMsg = 'Analyzing speakers, dialogue & timestamps...';
              if (nextProgress > 50) nextMsg = 'Formatting speech cues & audio readiness...';
              if (nextProgress > 75) nextMsg = 'Finalizing structured transcript...';
              return { ...s, progress: Math.min(nextProgress, 85), statusMessage: nextMsg };
            }
            return s;
          })
        );
      }, 700);

      const token = localStorage.getItem('gemini_tts_auth_token_v1');
      const response = await fetch('/api/transcribe-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileName: item.fileName,
          fileType: item.fileType,
          content: item.rawContent,
        }),
      });

      clearInterval(progressTimer);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to transcribe script.');
      }

      updateScriptItem(item.id, {
        status: 'completed',
        progress: 100,
        statusMessage: 'Completed',
        transcription: data.transcription,
        wordCount: data.wordCount || item.wordCount,
        pageCount: data.pageCount || item.pageCount,
        estimatedDurationSec: data.estimatedDurationSec || item.estimatedDurationSec,
      });
    } catch (err: any) {
      console.error(`Error transcribing script ${item.fileName}:`, err);
      updateScriptItem(item.id, {
        status: 'failed',
        progress: 0,
        statusMessage: 'Failed to transcribe',
        error: err.message || 'Unknown transcription error',
      });
    }
  }, [updateScriptItem]);

  // Queue runner worker
  useEffect(() => {
    if (isQueuePaused) return;

    const queuedItems = scripts.filter((s) => s.status === 'queued');
    if (queuedItems.length === 0) return;

    if (activeWorkerCountRef.current >= MAX_CONCURRENT_WORKERS) return;

    const itemsToProcess = queuedItems.slice(0, MAX_CONCURRENT_WORKERS - activeWorkerCountRef.current);

    itemsToProcess.forEach((item) => {
      activeWorkerCountRef.current += 1;
      processScriptItem(item).finally(() => {
        activeWorkerCountRef.current = Math.max(0, activeWorkerCountRef.current - 1);
      });
    });
  }, [scripts, isQueuePaused, processScriptItem]);

  // Upload multiple files
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: ScriptItem[] = [];

    for (const file of fileArray) {
      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'txt';
        let rawContent = '';

        if (file.type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg'].includes(fileExt)) {
          // Read audio as base64
          rawContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              // strip data:audio/...;base64,
              const base64 = res.split(',')[1] || res;
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } else {
          // Read text files (txt, pdf, docx, json, csv, fountain, md, srt, etc.)
          rawContent = await file.text();
        }

        const wordCount = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0;
        const pageCount = Math.max(1, Math.ceil(wordCount / 250));
        const estimatedDurationSec = Math.max(2, Math.round(wordCount / 2.5));

        const newItem: ScriptItem = {
          id: `script_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          fileName: file.name,
          originalSize: file.size,
          fileType: fileExt,
          uploadedAt: Date.now(),
          status: 'queued',
          progress: 0,
          statusMessage: 'Queued for processing',
          rawContent: rawContent.slice(0, 150000), // support rich multi-page scripts up to 150kb text
          wordCount,
          pageCount,
          estimatedDurationSec,
        };

        newItems.push(newItem);
      } catch (err) {
        console.error('Failed reading file:', file.name, err);
      }
    }

    if (newItems.length > 0) {
      setScripts((prev) => [...newItems, ...prev]);
    }
  }, []);

  // Add raw script text directly
  const addRawScript = useCallback((title: string, content: string, fileType = 'txt') => {
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const pageCount = Math.max(1, Math.ceil(wordCount / 250));
    const estimatedDurationSec = Math.max(2, Math.round(wordCount / 2.5));

    const newItem: ScriptItem = {
      id: `script_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      fileName: title.endsWith(`.${fileType}`) ? title : `${title}.${fileType}`,
      originalSize: new Blob([content]).size,
      fileType,
      uploadedAt: Date.now(),
      status: 'queued',
      progress: 0,
      statusMessage: 'Queued for processing',
      rawContent: content,
      wordCount,
      pageCount,
      estimatedDurationSec,
    };

    setScripts((prev) => [newItem, ...prev]);
  }, []);

  // Load sample scripts in bulk
  const loadPresetBatch = useCallback((presets: Array<{ fileName: string; content: string; fileType: string }>) => {
    const newItems: ScriptItem[] = presets.map((p, idx) => {
      const wordCount = p.content.trim() ? p.content.trim().split(/\s+/).length : 0;
      const pageCount = Math.max(1, Math.ceil(wordCount / 250));
      const estimatedDurationSec = Math.max(2, Math.round(wordCount / 2.5));

      return {
        id: `script_preset_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        fileName: p.fileName,
        originalSize: new Blob([p.content]).size,
        fileType: p.fileType,
        uploadedAt: Date.now() + idx,
        status: 'queued',
        progress: 0,
        statusMessage: 'Queued for processing',
        rawContent: p.content,
        wordCount,
        pageCount,
        estimatedDurationSec,
      };
    });

    setScripts((prev) => [...newItems, ...prev]);
  }, []);

  // Retry individual script
  const retryScript = useCallback((id: string) => {
    updateScriptItem(id, (prev) => ({
      ...prev,
      status: 'queued',
      progress: 0,
      statusMessage: 'Queued for retry',
      error: undefined,
      retryCount: (prev.retryCount || 0) + 1,
    }));
  }, [updateScriptItem]);

  // Retry all failed
  const retryAllFailed = useCallback(() => {
    setScripts((prev) =>
      prev.map((item) => {
        if (item.status === 'failed') {
          return {
            ...item,
            status: 'queued',
            progress: 0,
            statusMessage: 'Queued for retry',
            error: undefined,
            retryCount: (item.retryCount || 0) + 1,
          };
        }
        return item;
      })
    );
  }, []);

  // Force Transcribe All
  const processAllScripts = useCallback(() => {
    setIsQueuePaused(false);
    setScripts((prev) =>
      prev.map((item) => {
        if (item.status === 'failed' || item.status === 'queued') {
          return {
            ...item,
            status: 'queued',
            progress: 0,
            statusMessage: 'Queued for processing',
          };
        }
        return item;
      })
    );
  }, []);

  // Delete single
  const deleteScript = useCallback((id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Delete multiple
  const deleteMultipleScripts = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setScripts((prev) => prev.filter((s) => !idSet.has(s.id)));
  }, []);

  // Rename script
  const renameScript = useCallback((id: string, newFileName: string) => {
    updateScriptItem(id, { fileName: newFileName });
  }, [updateScriptItem]);

  // Clear all
  const clearAllScripts = useCallback(() => {
    setScripts([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed clearing localStorage:', e);
    }
  }, []);

  // Download individual or bulk
  const downloadTranscriptions = useCallback(async (ids: string[], mode: 'zip' | 'merged_txt' | 'json' | 'txt' = 'zip') => {
    const selected = scripts.filter((s) => ids.includes(s.id));
    if (selected.length === 0) return;

    if (selected.length === 1 && mode !== 'zip') {
      const item = selected[0];
      const text = item.transcription?.fullFormattedText || item.rawContent;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.fileName.replace(/\.[^/.]+$/, '')}_transcript.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (mode === 'merged_txt') {
      let combined = `# BATCH SCRIPT TRANSCRIPTION ARCHIVE\nGenerated on: ${new Date().toLocaleString()}\nTotal Scripts: ${selected.length}\n\n`;
      combined += '='.repeat(60) + '\n\n';

      selected.forEach((item, idx) => {
        combined += `SCRIPT #${idx + 1}: ${item.fileName}\n`;
        if (item.transcription?.title) combined += `TITLE: ${item.transcription.title}\n`;
        if (item.transcription?.summary) combined += `SUMMARY: ${item.transcription.summary}\n`;
        combined += `STATUS: ${item.status.toUpperCase()} | WORDS: ${item.wordCount} | EST. DURATION: ~${item.estimatedDurationSec}s\n`;
        combined += '-'.repeat(40) + '\n';
        combined += item.transcription?.fullFormattedText || item.rawContent;
        combined += '\n\n' + '='.repeat(60) + '\n\n';
      });

      const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_transcriptions_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (mode === 'json') {
      const exportData = selected.map((s) => ({
        id: s.id,
        fileName: s.fileName,
        fileType: s.fileType,
        uploadedAt: s.uploadedAt,
        status: s.status,
        wordCount: s.wordCount,
        pageCount: s.pageCount,
        transcription: s.transcription,
      }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scripts_transcriptions_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Default: ZIP archive with individual clean files
    const zip = new JSZip();
    const folder = zip.folder('transcriptions');

    selected.forEach((item) => {
      const cleanName = item.fileName.replace(/\.[^/.]+$/, '');
      const transcriptContent = item.transcription?.fullFormattedText || item.rawContent;
      folder?.file(`${cleanName}_transcript.txt`, transcriptContent);

      if (item.transcription) {
        folder?.file(
          `${cleanName}_metadata.json`,
          JSON.stringify(
            {
              title: item.transcription.title,
              summary: item.transcription.summary,
              language: item.transcription.language,
              speakers: item.transcription.speakers,
              dialogueLines: item.transcription.dialogueLines,
              keyHighlights: item.transcription.keyHighlights,
              wordCount: item.wordCount,
              estimatedDurationSec: item.estimatedDurationSec,
            },
            null,
            2
          )
        );
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcriptions_batch_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scripts]);

  return {
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
  };
}
