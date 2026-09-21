export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Female' | 'Male' | 'Neutral';
  description: string;
  traits: string[];
  color: string;
  previewSampleText: string;
  accent?: string;
  toneProfile: string;
  isAiNeural?: boolean;
  isAiFunny?: boolean;
  isAiCartoon?: boolean;
  isKidsExplainer?: boolean;
  category?: 'ai-cartoon' | 'ai-funny' | 'ai-neural' | 'kids-explainer' | 'human';
}

export type NaturalnessMode = 'lifelike' | 'expressive' | 'storytelling' | 'casual' | 'standard';

export interface NaturalTag {
  label: string;
  insertText: string;
  description: string;
  iconName?: string;
}

export interface ToneStyle {
  id: string;
  label: string;
  iconName: string;
  promptPrefix: string;
  description: string;
}

export interface DialogueLine {
  id: string;
  speaker: string;
  voice: string;
  text: string;
}

export interface GenerationHistoryItem {
  id: string;
  timestamp: number;
  text: string;
  mode: 'single' | 'dialogue';
  voice: string;
  style?: string;
  audioData: string; // base64 WAV
  durationEstimateSec?: number;
  dialogue?: DialogueLine[];
}

export interface TTSRequestPayload {
  text?: string;
  voice?: string;
  style?: string;
  customStylePrompt?: string;
  mode: 'single' | 'dialogue';
  dialogue?: Array<{ speaker: string; text: string; voice: string }>;
}

export interface TTSResponseData {
  success: boolean;
  audioData: string;
  mimeType: string;
  sampleRate: number;
  durationEstimateSec: number;
  error?: string;
}

export type ScriptStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ScriptSpeaker {
  name: string;
  suggestedVoice: string;
  lineCount: number;
  toneDescription?: string;
}

export interface ScriptDialogueCue {
  id: string;
  speaker: string;
  text: string;
  timestamp?: string;
  emotion?: string;
  voice?: string;
}

export interface ScriptTranscriptionData {
  title: string;
  summary: string;
  language: string;
  speakers: ScriptSpeaker[];
  dialogueLines: ScriptDialogueCue[];
  fullFormattedText: string;
  keyHighlights: string[];
  readingLevel?: string;
  pacingNote?: string;
  completedAt: number;
}

export interface ScriptItem {
  id: string;
  fileName: string;
  originalSize: number; // in bytes
  fileType: string;
  uploadedAt: number;
  status: ScriptStatus;
  progress: number; // 0 - 100
  statusMessage: string;
  rawContent: string;
  wordCount: number;
  pageCount: number;
  estimatedDurationSec: number;
  transcription?: ScriptTranscriptionData;
  error?: string;
  retryCount?: number;
}

export interface BatchFilterOptions {
  searchQuery: string;
  statusFilter: 'all' | ScriptStatus;
  sortBy: 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'words_desc' | 'status';
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  email?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
  message?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SpeechWord {
  word: string;
  startSec: number;
  endSec: number;
  confidence?: number;
}

export type AudioEventType = 'laughter' | 'applause' | 'music' | 'background_noise' | 'door_closing' | 'chime' | 'cough' | string;

export interface AudioEvent {
  type: AudioEventType;
  label: string;
  startSec: number;
  endSec: number;
}

export type SpeechProcessingStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'extracting_audio'
  | 'detecting_language'
  | 'transcribing'
  | 'formatting'
  | 'completed'
  | 'failed';

export interface SpeechTranscriptSegment {
  id: string;
  startSec: number;
  endSec: number;
  timestamp: string; // e.g. "00:00:15"
  speaker: string; // e.g. "Speaker 1"
  text: string;
  language?: string;
  confidence?: number;
  words?: SpeechWord[];
  events?: AudioEvent[];
}

export interface SpeechTranscriptionOptions {
  language: string; // 'auto', 'en', 'ne', 'hi', or other
  detectSpeakers: boolean;
  speakerCount?: number | 'auto';
  detectAudioEvents: boolean;
  cleanTranscript: boolean;
  wordTimestamps: boolean;
  keyTerms: string;
  exportFormat?: TranscriptionExportFormat;
}

export interface SpeechTranscriptionJob {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mediaType: 'audio' | 'video';
  durationSec: number;
  mediaBlobUrl?: string;
  status: SpeechProcessingStatus;
  progress: number;
  statusMessage: string;
  currentChunk?: number;
  totalChunks?: number;
  options: SpeechTranscriptionOptions;
  detectedLanguages: string[];
  primaryLanguage: string;
  segments: SpeechTranscriptSegment[];
  fullText: string;
  speakers: string[];
  summary?: string;
  keyTopics?: string[];
  keyHighlights?: string[];
  uploadedAt: number;
  completedAt?: number;
  error?: string;
  retryCount?: number;
}

export type VideoProcessingStatus =
  | 'idle'
  | 'extracting_audio'
  | 'detecting_language'
  | 'transcribing'
  | 'merging'
  | 'completed'
  | 'failed';

export interface VideoTranscriptSegment extends SpeechTranscriptSegment {}

export interface VideoTranscriptionJob extends SpeechTranscriptionJob {
  videoFormat?: string;
  videoBlobUrl?: string;
}

export type TranscriptionExportFormat = 'txt' | 'docx' | 'pdf' | 'srt' | 'vtt' | 'csv' | 'json';

