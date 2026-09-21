/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { AccountModal } from './components/AccountModal';
import { SingleSpeakerTab } from './components/SingleSpeakerTab';
import { DialogueTab } from './components/DialogueTab';
import { ScriptTranscriptionView } from './components/ScriptTranscriptionView';
import { SpeechToTextView } from './components/SpeechToTextView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioPlayer } from './components/AudioPlayer';
import { HistoryDrawer } from './components/HistoryDrawer';
import { useScriptTranscriptionQueue } from './hooks/useScriptTranscriptionQueue';
import { DialogueLine, GenerationHistoryItem, NaturalnessMode } from './types';
import {
  Volume2,
  Mic,
  Users,
  Sparkles,
  AlertCircle,
  Headphones,
  CheckCircle2,
  Radio,
  FileText,
  Film,
  Layers,
  ArrowRight,
  LogOut,
  User as UserIcon,
  Settings,
  Shield,
  Loader2,
} from 'lucide-react';

const STORAGE_KEY = 'gemini_tts_history_v1';

export default function App() {
  const { user, token, isAuthenticated, isCheckingAuth, logout, fetchWithAuth } = useAuth();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'speech' | 'transcription' | 'single' | 'dialogue'>('speech');
  const [notification, setNotification] = useState<string | null>(null);

  // Script Transcription queue manager
  const transcriptionQueue = useScriptTranscriptionQueue();
  
  // Single speaker state
  const [text, setText] = useState<string>(
    'Hello Anurag! Welcome to the Gemini 3.1 Flash Text-to-Speech Studio. Your voice synthesizer is ready to turn any text into rich, expressive audio.'
  );
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [selectedStyle, setSelectedStyle] = useState<string>('cheerful');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [naturalnessMode, setNaturalnessMode] = useState<NaturalnessMode>('lifelike');

  // Dialogue state
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([
    { id: '1', speaker: 'Anurag', voice: 'Puck', text: 'Hey there! How natural does Gemini 3.1 Flash Text-to-Speech sound?' },
    { id: '2', speaker: 'Assistant', voice: 'Kore', text: 'It delivers lifelike cadence, emotional inflection, and multi-speaker dialogue rendering seamlessly!' },
  ]);

  // Loading & Current Audio state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<{
    id: string;
    audioData: string;
    title: string;
    subtitle: string;
  } | null>(null);

  // History state
  const [history, setHistory] = useState<GenerationHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Could not save history to localStorage:', e);
    }
  }, [history]);

  // Callback to handle sending transcribed scripts directly into TTS Studio
  const handleSendToTTS = (
    mode: 'single' | 'dialogue',
    singleText?: string,
    lines?: DialogueLine[]
  ) => {
    if (mode === 'dialogue' && lines && lines.length > 0) {
      setDialogueLines(lines);
      setActiveTab('dialogue');
      setNotification(`Loaded ${lines.length} dialogue lines into Multi-Speaker Studio!`);
    } else if (singleText) {
      setText(singleText);
      setActiveTab('single');
      setNotification('Loaded script into Single Speaker Voice Studio!');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleGenerateSingle = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetchWithAuth('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          style: selectedStyle,
          customStylePrompt: customPrompt,
          naturalnessMode,
          mode: 'single',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errMsg = typeof data.error === 'object' ? data.error?.message || JSON.stringify(data.error) : data.error;
        throw new Error(errMsg || 'Failed to synthesize speech audio');
      }

      const newId = String(Date.now());
      const historyItem: GenerationHistoryItem = {
        id: newId,
        timestamp: Date.now(),
        text: text.trim(),
        mode: 'single',
        voice: selectedVoice,
        style: customPrompt ? 'custom' : selectedStyle,
        audioData: data.audioData,
        durationEstimateSec: data.durationEstimateSec,
      };

      const engineLabel = data.isFallback ? 'High-Fidelity Voice Engine' : 'Gemini 3.1 Flash TTS';

      setHistory((prev) => [historyItem, ...prev]);
      setCurrentAudio({
        id: newId,
        audioData: data.audioData,
        title: `Speech in ${selectedVoice}'s Voice`,
        subtitle: `Mode: ${naturalnessMode} • Style: ${customPrompt ? 'Custom Director' : selectedStyle} • ${engineLabel}`,
      });
    } catch (err: any) {
      console.error('Synthesis error:', err);
      setErrorMsg(err.message || 'An error occurred during TTS generation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDialogue = async () => {
    const validLines = dialogueLines.filter((l) => l.text.trim().length > 0);
    if (validLines.length === 0) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetchWithAuth('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dialogue',
          naturalnessMode,
          dialogue: validLines,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errMsg = typeof data.error === 'object' ? data.error?.message || JSON.stringify(data.error) : data.error;
        throw new Error(errMsg || 'Failed to synthesize dialogue audio');
      }

      const newId = String(Date.now());
      const historyItem: GenerationHistoryItem = {
        id: newId,
        timestamp: Date.now(),
        text: validLines.map((l) => `${l.speaker}: ${l.text}`).join(' | '),
        mode: 'dialogue',
        voice: validLines.map((l) => l.voice).join(', '),
        audioData: data.audioData,
        durationEstimateSec: data.durationEstimateSec,
        dialogue: validLines,
      };

      const engineLabel = data.isFallback ? 'High-Fidelity Voice Engine' : 'Gemini 3.1 Flash TTS';

      setHistory((prev) => [historyItem, ...prev]);
      setCurrentAudio({
        id: newId,
        audioData: data.audioData,
        title: 'Multi-Speaker Dialogue Conversation',
        subtitle: `${validLines.length} lines • Mode: ${naturalnessMode} • ${engineLabel}`,
      });
    } catch (err: any) {
      console.error('Dialogue synthesis error:', err);
      setErrorMsg(err.message || 'An error occurred during dialogue synthesis.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistoryItem = (item: GenerationHistoryItem) => {
    setCurrentAudio({
      id: item.id,
      audioData: item.audioData,
      title: item.mode === 'dialogue' ? 'Multi-Speaker Dialogue' : `Speech in ${item.voice}'s Voice`,
      subtitle: `${item.style || 'Natural'} • Generated on ${new Date(item.timestamp).toLocaleTimeString()}`,
    });
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (currentAudio?.id === id) {
      setCurrentAudio(null);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    setCurrentAudio(null);
  };

  // If checking authentication on startup, show loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Headphones className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
            <span>Validating secure session...</span>
          </div>
        </div>
      </div>
    );
  }

  // If not logged in, show protected Login Page
  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  const totalScriptsCount = transcriptionQueue.scripts.length;
  const processingCount = transcriptionQueue.scripts.filter((s) => s.status === 'processing').length;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans selection:bg-sky-100 selection:text-sky-900">
      {/* Account Settings & User Management Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  Text to Speech & Script Transcription Studio
                </h1>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                  Gemini AI Powered
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Scalable Multi-Script Transcription • High-Volume Batch Processing • Natural Voice Synthesis
              </p>
            </div>
          </div>

          {/* User Profile & Session Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* User Badge / Account Button */}
            <button
              id="user-account-button"
              onClick={() => setIsAccountModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs text-slate-700 font-medium transition-colors cursor-pointer"
              title="Manage Account & Password"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-900">{user.displayName || user.username}</span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 border border-sky-200">
                {user.role}
              </span>
              <Settings className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Logout Button */}
            <button
              id="header-logout-button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
              title="Log Out of Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Notification Toast */}
        {notification && (
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-rose-900">TTS Synthesis Issue</h4>
              <p className="text-xs text-rose-700 mt-0.5">{errorMsg}</p>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs text-rose-600 hover:text-rose-900 font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Feature Mode Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              id="tab-speech-transcription"
              onClick={() => setActiveTab('speech')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'speech'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-sky-600" />
              <span>AI Speech to Text</span>
            </button>

            <button
              id="tab-script-transcription"
              onClick={() => setActiveTab('transcription')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'transcription'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Script Transcription</span>
              {totalScriptsCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  processingCount > 0 ? 'bg-indigo-100 text-indigo-700 animate-pulse' : 'bg-slate-200 text-slate-700'
                }`}>
                  {totalScriptsCount}
                </span>
              )}
            </button>

            <button
              id="tab-single-speaker"
              onClick={() => setActiveTab('single')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'single'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Single Speaker TTS</span>
            </button>

            <button
              id="tab-multi-dialogue"
              onClick={() => setActiveTab('dialogue')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dialogue'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Multi-Speaker Dialogue</span>
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 text-xs text-slate-500">
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            <span>AI Speech to Text • Bulk Audio & Video Transcription</span>
          </div>
        </div>

        {/* View Switcher: Speech vs Script Transcription vs TTS Studio Modes */}
        <ErrorBoundary fallbackTitle="Speech & Audio Studio Encountered an Issue">
          {activeTab === 'speech' ? (
            <SpeechToTextView
              authToken={token}
            />
          ) : activeTab === 'transcription' ? (
            <ScriptTranscriptionView
              queue={transcriptionQueue}
              onSendToTTS={handleSendToTTS}
            />
          ) : (
            /* Workspace Layout: 2 Columns for TTS Synthesizer */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Generator Form (8 cols on large) */}
              <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
                {activeTab === 'single' ? (
                  <SingleSpeakerTab
                    text={text}
                    setText={setText}
                    selectedVoice={selectedVoice}
                    setSelectedVoice={setSelectedVoice}
                    selectedStyle={selectedStyle}
                    setSelectedStyle={setSelectedStyle}
                    customPrompt={customPrompt}
                    setCustomPrompt={setCustomPrompt}
                    naturalnessMode={naturalnessMode}
                    setNaturalnessMode={setNaturalnessMode}
                    isLoading={isLoading}
                    onGenerate={handleGenerateSingle}
                  />
                ) : (
                  <DialogueTab
                    dialogueLines={dialogueLines}
                    setDialogueLines={setDialogueLines}
                    naturalnessMode={naturalnessMode}
                    setNaturalnessMode={setNaturalnessMode}
                    isLoading={isLoading}
                    onGenerate={handleGenerateDialogue}
                  />
                )}
              </div>

              {/* Right Column: Audio Output & History (5 cols on large) */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                {/* Active / Current Audio Player */}
                {currentAudio ? (
                  <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Now Playing</span>
                    </div>
                    <AudioPlayer
                      audioBase64={currentAudio.audioData}
                      title={currentAudio.title}
                      subtitle={currentAudio.subtitle}
                    />
                  </div>
                ) : (
                  <div className="p-6 text-center border border-slate-200 rounded-2xl bg-white shadow-xs">
                    <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
                      <Volume2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">Ready to Speak</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                      Preview any character voice with the <strong>▶ Preview</strong> button, add natural pauses, or synthesize scripts directly from the <strong>Script Transcription</strong> tab.
                    </p>
                  </div>
                )}

                {/* History Panel */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <HistoryDrawer
                    history={history}
                    onSelectAudio={handleSelectHistoryItem}
                    onDeleteHistoryItem={handleDeleteHistoryItem}
                    onClearHistory={handleClearHistory}
                    currentPlayingId={currentAudio?.id}
                  />
                </div>
              </div>
            </div>
          )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <span className="font-semibold text-slate-700">Gemini 3.7 Flash & 3.1 Flash TTS</span>
            <span>•</span>
            <span>Created for Anurag</span>
          </div>
          <div>Scalable Transcription & Voice Synthesis Studio</div>
        </div>
      </footer>
    </div>
  );
}

