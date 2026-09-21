import React, { useState } from 'react';
import {
  Settings2,
  Globe2,
  Users2,
  Volume2,
  FileCheck2,
  Clock3,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';
import { SpeechTranscriptionOptions } from '../types';

interface SpeechSettingsBarProps {
  options: SpeechTranscriptionOptions;
  onChange: (updated: SpeechTranscriptionOptions) => void;
  disabled?: boolean;
}

const LANGUAGES = [
  { value: 'auto', label: 'Auto Detect Language', flag: '🌐' },
  { value: 'Nepali', label: 'Nepali (नेपाली)', flag: '🇳🇵', badge: 'First-Class' },
  { value: 'Hindi', label: 'Hindi (हिन्दी)', flag: '🇮🇳', badge: 'First-Class' },
  { value: 'English', label: 'English (US/UK/Global)', flag: '🇬🇧' },
  { value: 'Mixed', label: 'Mixed / Code-Switching', flag: '🔀' },
  { value: 'Spanish', label: 'Spanish (Español)', flag: '🇪🇸' },
  { value: 'French', label: 'French (Français)', flag: '🇫🇷' },
  { value: 'German', label: 'German (Deutsch)', flag: '🇩🇪' },
  { value: 'Japanese', label: 'Japanese (日本語)', flag: '🇯🇵' },
  { value: 'Arabic', label: 'Arabic (العربية)', flag: '🇸🇦' },
  { value: 'Bengali', label: 'Bengali (বাংলা)', flag: '🇧🇩' },
];

export const SpeechSettingsBar: React.FC<SpeechSettingsBarProps> = ({
  options,
  onChange,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = <K extends keyof SpeechTranscriptionOptions>(
    field: K,
    value: SpeechTranscriptionOptions[K]
  ) => {
    onChange({
      ...options,
      [field]: value,
    });
  };

  return (
    <div
      id="speech-settings-bar"
      className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 transition-all duration-200"
    >
      {/* Top compact controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Language & Primary Diarization toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Language:
            </span>
            <div className="relative">
              <select
                id="speech-language-select"
                value={options.language}
                onChange={(e) => updateField('language', e.target.value)}
                disabled={disabled}
                className="appearance-none bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-medium py-1.5 pl-3 pr-8 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.flag} {lang.label} {lang.badge ? `(${lang.badge})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Speaker Diarization Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700">
            <input
              id="speech-detect-speakers-toggle"
              type="checkbox"
              checked={options.detectSpeakers}
              onChange={(e) => updateField('detectSpeakers', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <Users2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Detect Speakers</span>
          </label>

          {/* Audio Events Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700">
            <input
              id="speech-detect-events-toggle"
              type="checkbox"
              checked={options.detectAudioEvents}
              onChange={(e) => updateField('detectAudioEvents', e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Audio Events ([music], [laughter])</span>
          </label>
        </div>

        {/* Right: Expand advanced settings button */}
        <button
          id="speech-advanced-settings-btn"
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-sky-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Advanced Settings</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Expandable Advanced Options Section */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Speaker Count Hint */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Users2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Expected Speaker Count</span>
            </label>
            <select
              id="speech-speaker-count-select"
              value={options.speakerCount || 'auto'}
              onChange={(e) =>
                updateField(
                  'speakerCount',
                  e.target.value === 'auto' ? 'auto' : parseInt(e.target.value, 10)
                )
              }
              disabled={!options.detectSpeakers || disabled}
              className="w-full bg-slate-50 text-slate-800 text-xs font-medium py-1.5 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            >
              <option value="auto">Auto-detect number of speakers</option>
              <option value="1">1 Speaker (Monologue / Solo)</option>
              <option value="2">2 Speakers (Dialogue / Interview)</option>
              <option value="3">3 Speakers</option>
              <option value="4">4 Speakers</option>
              <option value="5">5+ Speakers (Panel / Meeting)</option>
            </select>
          </div>

          {/* Text Formatting & Cleanup */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Automatic Text Formatting</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer py-1 text-xs text-slate-600">
              <input
                id="speech-clean-text-toggle"
                type="checkbox"
                checked={options.cleanTranscript}
                onChange={(e) => updateField('cleanTranscript', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
              <span>Smart capitalization & punctuation without altering spoken meaning</span>
            </label>
          </div>

          {/* Word-level Timestamps */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5 text-sky-600" />
              <span>Word-Level Timestamps</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer py-1 text-xs text-slate-600">
              <input
                id="speech-word-timestamps-toggle"
                type="checkbox"
                checked={options.wordTimestamps}
                onChange={(e) => updateField('wordTimestamps', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
              <span>Generate precise start and end times for each individual word</span>
            </label>
          </div>

          {/* Custom Vocabulary / Key Terms (Full width across cols) */}
          <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-sky-600" />
              <span>Custom Vocabulary & Key Terms</span>
              <span className="text-[11px] font-normal text-slate-400">
                (Comma-separated list of names, brands, acronyms, or technical terms)
              </span>
            </label>
            <input
              id="speech-key-terms-input"
              type="text"
              value={options.keyTerms}
              onChange={(e) => updateField('keyTerms', e.target.value)}
              disabled={disabled}
              placeholder="e.g. Kathmandu, Dharan, PyTorch, Gemini, Anurag, Nepal Telecom, ElevenLabs"
              className="w-full bg-slate-50 text-slate-800 text-xs py-2 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
};
