import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SpeechTranscriptionJob,
  SpeechTranscriptSegment,
  SpeechTranscriptionOptions,
  SpeechProcessingStatus,
} from '../types';
import { downloadBulkZip } from '../utils/transcriptExporter';

const STORAGE_KEY = 'speech_transcription_jobs_v1';
const OPTIONS_STORAGE_KEY = 'speech_transcription_options_v1';

const DEFAULT_OPTIONS: SpeechTranscriptionOptions = {
  language: 'auto',
  detectSpeakers: true,
  speakerCount: 'auto',
  detectAudioEvents: true,
  cleanTranscript: true,
  wordTimestamps: true,
  keyTerms: '',
  exportFormat: 'txt',
};

export function useSpeechTranscriptionQueue(authToken?: string | null) {
  const [jobs, setJobs] = useState<SpeechTranscriptionJob[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean out pending states from previous sessions
        return parsed.map((j: SpeechTranscriptionJob) => ({
          ...j,
          mediaBlobUrl: undefined, // Object URLs expire across page reloads
          status: j.status === 'completed' ? 'completed' : j.status === 'failed' ? 'failed' : 'idle',
        }));
      }
    } catch {}
    return [];
  });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [options, setOptions] = useState<SpeechTranscriptionOptions>(() => {
    try {
      const saved = localStorage.getItem(OPTIONS_STORAGE_KEY);
      if (saved) return { ...DEFAULT_OPTIONS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_OPTIONS;
  });

  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const localFileBlobsRef = useRef<Map<string, File>>(new Map());

  // Save jobs to localStorage
  useEffect(() => {
    try {
      const lightweight = jobs.map((j) => ({
        ...j,
        mediaBlobUrl: undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight.slice(0, 30)));
    } catch {}
  }, [jobs]);

  // Save options to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
    } catch {}
  }, [options]);

  const updateJob = useCallback((id: string, updater: (prev: SpeechTranscriptionJob) => SpeechTranscriptionJob) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? updater(j) : j)));
  }, []);

  /**
   * Add files to the transcription queue
   */
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newJobs: SpeechTranscriptionJob[] = [];
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg|opus|wma)$/i.test(file.name);
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|mpeg|wmv|m4v|flv)$/i.test(file.name);

        if (!isAudio && !isVideo) continue;

        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        localFileBlobsRef.current.set(jobId, file);

        const blobUrl = URL.createObjectURL(file);

        newJobs.push({
          id: jobId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || (isAudio ? 'audio/mpeg' : 'video/mp4'),
          mediaType: isVideo ? 'video' : 'audio',
          durationSec: 0,
          mediaBlobUrl: blobUrl,
          status: 'idle',
          progress: 0,
          statusMessage: 'Ready in queue',
          options: { ...options },
          detectedLanguages: [],
          primaryLanguage: options.language !== 'auto' ? options.language : 'Auto-detecting...',
          segments: [],
          fullText: '',
          speakers: [],
          uploadedAt: Date.now(),
        });
      }

      if (newJobs.length > 0) {
        setJobs((prev) => [...newJobs, ...prev]);
        if (!selectedJobId) {
          setSelectedJobId(newJobs[0].id);
        }
      }
    },
    [options, selectedJobId]
  );

  /**
   * Core transcription execution for a single job
   */
  const transcribeJob = useCallback(
    async (jobId: string) => {
      const job = jobs.find((j) => j.id === jobId);
      const file = localFileBlobsRef.current.get(jobId);

      if (!file) {
        updateJob(jobId, (j) => ({
          ...j,
          status: 'failed',
          error: 'Original media file is missing or expired. Please re-upload.',
          statusMessage: 'File missing',
        }));
        return;
      }

      const controller = new AbortController();
      abortControllersRef.current.set(jobId, controller);

      const authHeaders: Record<string, string> = {};
      if (authToken) {
        authHeaders['Authorization'] = `Bearer ${authToken}`;
      }

      try {
        // Step 1: Upload and probe/extract audio track
        updateJob(jobId, (j) => ({
          ...j,
          status: 'extracting_audio',
          progress: 10,
          statusMessage: 'Analyzing media track & normalizing audio...',
          error: undefined,
        }));

        const formData = new FormData();
        formData.append('media', file);

        const uploadRes = await fetch('/api/speech/upload-and-extract', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
          signal: controller.signal,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Media extraction failed (${uploadRes.status})`);
        }

        const extractData = await uploadRes.json();
        const { durationSec, chunks = [], totalChunks = 1 } = extractData;

        updateJob(jobId, (j) => ({
          ...j,
          durationSec: durationSec || j.durationSec,
          totalChunks,
          currentChunk: 1,
          progress: 25,
          statusMessage: `Audio extracted (${(durationSec || 0).toFixed(0)}s). Starting AI transcription...`,
        }));

        // Step 2: Transcribe each audio chunk
        const collectedSegments: SpeechTranscriptSegment[] = [];
        const detectedLanguagesSet = new Set<string>();
        const speakersSet = new Set<string>();
        let previousDialogueContext = '';

        for (let i = 0; i < chunks.length; i++) {
          if (controller.signal.aborted) throw new Error('Transcription cancelled by user.');

          const chunk = chunks[i];
          const chunkProgress = 25 + Math.round(((i + 1) / chunks.length) * 60);

          updateJob(jobId, (j) => ({
            ...j,
            status: 'transcribing',
            currentChunk: i + 1,
            progress: chunkProgress,
            statusMessage: `Transcribing chunk ${i + 1} of ${chunks.length}...`,
          }));

          const chunkRes = await fetch('/api/speech/transcribe-chunk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify({
              audioData: chunk.wavBase64,
              chunkIndex: chunk.chunkIndex,
              totalChunks: chunk.totalChunks,
              chunkStartSec: chunk.startSec,
              chunkDurationSec: chunk.durationSec,
              language: job?.options?.language || options.language,
              detectSpeakers: job?.options?.detectSpeakers ?? options.detectSpeakers,
              speakerCount: job?.options?.speakerCount ?? options.speakerCount,
              detectAudioEvents: job?.options?.detectAudioEvents ?? options.detectAudioEvents,
              cleanTranscript: job?.options?.cleanTranscript ?? options.cleanTranscript,
              wordTimestamps: job?.options?.wordTimestamps ?? options.wordTimestamps,
              keyTerms: job?.options?.keyTerms || options.keyTerms,
              previousContext: previousDialogueContext,
            }),
            signal: controller.signal,
          });

          if (!chunkRes.ok) {
            const errData = await chunkRes.json().catch(() => ({}));
            throw new Error(errData.error || `Chunk ${i + 1} transcription failed.`);
          }

          const chunkResult = await chunkRes.json();
          if (Array.isArray(chunkResult.segments)) {
            collectedSegments.push(...chunkResult.segments);
            // Collect dialogue for next chunk context
            const lastTexts = chunkResult.segments
              .slice(-3)
              .map((s: SpeechTranscriptSegment) => `${s.speaker}: ${s.text}`)
              .join(' ');
            if (lastTexts) previousDialogueContext = lastTexts;
          }

          if (chunkResult.detectedLanguage) {
            detectedLanguagesSet.add(chunkResult.detectedLanguage);
          }
          if (Array.isArray(chunkResult.detectedLanguages)) {
            chunkResult.detectedLanguages.forEach((l: string) => detectedLanguagesSet.add(l));
          }
          if (Array.isArray(chunkResult.speakers)) {
            chunkResult.speakers.forEach((s: string) => speakersSet.add(s));
          }

          // Incremental update so user can see transcription streaming in
          updateJob(jobId, (j) => ({
            ...j,
            segments: [...collectedSegments],
            speakers: Array.from(speakersSet),
            detectedLanguages: Array.from(detectedLanguagesSet),
            primaryLanguage: Array.from(detectedLanguagesSet)[0] || 'English',
            fullText: collectedSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n\n'),
          }));
        }

        // Step 3: Formatting & Summarization (if transcript has substantive text)
        updateJob(jobId, (j) => ({
          ...j,
          status: 'formatting',
          progress: 92,
          statusMessage: 'Generating summary and key takeaways...',
        }));

        let summary = '';
        let keyHighlights: string[] = [];
        let keyTopics: string[] = [];

        if (collectedSegments.length > 0) {
          const fullText = collectedSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
          try {
            const sumRes = await fetch('/api/speech/summarize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ fullText, fileName: file.name }),
              signal: controller.signal,
            });
            if (sumRes.ok) {
              const sumData = await sumRes.json();
              summary = sumData.summary || '';
              keyHighlights = sumData.keyHighlights || [];
              keyTopics = sumData.topics || [];
            }
          } catch (e) {
            console.warn('[Queue] Summary generation warning:', e);
          }
        }

        // Complete!
        updateJob(jobId, (j) => ({
          ...j,
          status: 'completed',
          progress: 100,
          statusMessage: 'Completed',
          completedAt: Date.now(),
          segments: collectedSegments,
          summary,
          keyHighlights,
          keyTopics,
          fullText: collectedSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n\n'),
        }));
      } catch (err: any) {
        if (err.name === 'AbortError') {
          updateJob(jobId, (j) => ({
            ...j,
            status: 'idle',
            progress: 0,
            statusMessage: 'Cancelled',
          }));
        } else {
          console.error(`[Queue] Transcription error on ${jobId}:`, err);
          updateJob(jobId, (j) => ({
            ...j,
            status: 'failed',
            error: err.message || 'Transcription failed',
            statusMessage: 'Failed',
          }));
        }
      } finally {
        abortControllersRef.current.delete(jobId);
      }
    },
    [jobs, authToken, options, updateJob]
  );

  /**
   * Transcribe all idle or failed jobs
   */
  const transcribeAll = useCallback(async () => {
    const queueable = jobs.filter((j) => j.status === 'idle' || j.status === 'failed');
    if (queueable.length === 0) return;

    setIsProcessingQueue(true);
    // Process 2 files in parallel for optimal throughput
    const pool = [...queueable];
    const worker = async () => {
      while (pool.length > 0) {
        const nextJob = pool.shift();
        if (nextJob) {
          await transcribeJob(nextJob.id);
        }
      }
    };

    await Promise.all([worker(), worker()]);
    setIsProcessingQueue(false);
  }, [jobs, transcribeJob]);

  /**
   * Cancel an in-progress job
   */
  const cancelJob = useCallback(
    (jobId: string) => {
      const controller = abortControllersRef.current.get(jobId);
      if (controller) {
        controller.abort();
      }
      updateJob(jobId, (j) => ({
        ...j,
        status: 'idle',
        progress: 0,
        statusMessage: 'Cancelled by user',
      }));
    },
    [updateJob]
  );

  /**
   * Retry a failed job
   */
  const retryJob = useCallback(
    (jobId: string) => {
      updateJob(jobId, (j) => ({
        ...j,
        status: 'idle',
        progress: 0,
        error: undefined,
        retryCount: (j.retryCount || 0) + 1,
      }));
      setTimeout(() => {
        transcribeJob(jobId);
      }, 50);
    },
    [transcribeJob, updateJob]
  );

  /**
   * Remove a job from queue
   */
  const deleteJob = useCallback((jobId: string) => {
    const controller = abortControllersRef.current.get(jobId);
    if (controller) controller.abort();
    abortControllersRef.current.delete(jobId);
    localFileBlobsRef.current.delete(jobId);

    setJobs((prev) => {
      const filtered = prev.filter((j) => j.id !== jobId);
      return filtered;
    });

    setSelectedJobId((current) => (current === jobId ? null : current));
  }, []);

  /**
   * Clear all jobs from queue
   */
  const clearQueue = useCallback(() => {
    abortControllersRef.current.forEach((c) => c.abort());
    abortControllersRef.current.clear();
    localFileBlobsRef.current.clear();
    setJobs([]);
    setSelectedJobId(null);
  }, []);

  /**
   * Edit transcript text for a specific segment
   */
  const updateSegment = useCallback(
    (jobId: string, segmentId: string, newText: string) => {
      updateJob(jobId, (job) => {
        const newSegments = job.segments.map((seg) => (seg.id === segmentId ? { ...seg, text: newText } : seg));
        return {
          ...job,
          segments: newSegments,
          fullText: newSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n\n'),
        };
      });
    },
    [updateJob]
  );

  /**
   * Global speaker rename across entire transcript
   */
  const renameSpeaker = useCallback(
    (jobId: string, oldSpeaker: string, newSpeaker: string) => {
      const cleanNew = newSpeaker.trim();
      if (!cleanNew) return;

      updateJob(jobId, (job) => {
        const newSegments = job.segments.map((seg) =>
          seg.speaker === oldSpeaker ? { ...seg, speaker: cleanNew } : seg
        );
        const newSpeakers = job.speakers.map((s) => (s === oldSpeaker ? cleanNew : s));

        return {
          ...job,
          speakers: Array.from(new Set(newSpeakers)),
          segments: newSegments,
          fullText: newSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n\n'),
        };
      });
    },
    [updateJob]
  );

  /**
   * Bulk download all completed jobs in a zip file
   */
  const exportAllAsZip = useCallback(async () => {
    const completed = jobs.filter((j) => j.status === 'completed');
    if (completed.length === 0) {
      throw new Error('No completed transcripts in the queue yet.');
    }
    await downloadBulkZip(completed);
  }, [jobs]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;

  return {
    jobs,
    selectedJob,
    selectedJobId,
    setSelectedJobId,
    options,
    setOptions,
    isProcessingQueue,
    addFiles,
    startTranscription: transcribeJob,
    transcribeAll,
    cancelJob,
    retryJob,
    deleteJob,
    clearQueue,
    updateSegment,
    renameSpeaker,
    exportAllAsZip,
  };
}
