import React, { useState, useRef } from 'react';
import { VOICES, TONE_STYLES, SAMPLE_TEXTS, NATURAL_SPEECH_TAGS, NATURALNESS_MODES } from '../data/presets';
import { VoiceOption, ToneStyle, NaturalnessMode } from '../types';
import { useVoicePreview } from '../hooks/useVoicePreview';
import {
  Sparkles,
  Wand2,
  Volume2,
  Mic,
  Sliders,
  RefreshCw,
  Play,
  Square,
  Sparkle,
  MessageSquarePlus,
  HelpCircle,
  Bot,
  Cpu,
  CheckCircle2,
  Activity,
  Zap,
  BookOpen,
} from 'lucide-react';

interface SingleSpeakerTabProps {
  text: string;
  setText: (text: string) => void;
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  naturalnessMode: NaturalnessMode;
  setNaturalnessMode: (mode: NaturalnessMode) => void;
  isLoading: boolean;
  onGenerate: () => void;
}

export const SingleSpeakerTab: React.FC<SingleSpeakerTabProps> = ({
  text,
  setText,
  selectedVoice,
  setSelectedVoice,
  selectedStyle,
  setSelectedStyle,
  customPrompt,
  setCustomPrompt,
  naturalnessMode,
  setNaturalnessMode,
  isLoading,
  onGenerate,
}) => {
  const [showCustomPrompt, setShowCustomPrompt] = useState<boolean>(false);
  const [showNaturalTips, setShowNaturalTips] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { playingVoice, isLoading: isPreviewLoading, playPreview, stopPreview } = useVoicePreview();

  const handleSelectPreset = (sampleId: string) => {
    const sample = SAMPLE_TEXTS.find((s) => s.id === sampleId);
    if (sample) {
      setText(sample.text);
      setSelectedVoice(sample.voice);
      setSelectedStyle(sample.style);
    }
  };

  const handleInsertTag = (tagText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText(text + tagText);
      return;
    }

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + tagText + after;
    setText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagText.length, start + tagText.length);
    }, 10);
  };

  // Enhance text naturally with cadence & conversational breathing
  const handleEnhanceNaturalness = () => {
    if (!text.trim()) return;
    let polished = text.trim();
    // Add natural conversational flow if not present
    if (!polished.includes('...') && !polished.includes('[pause]')) {
      polished = polished
        .replace(/\. /g, '... ')
        .replace(/, /g, ', [short-pause] ');
    }
    setText(polished);
  };

  const characterCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.max(1, Math.round(wordCount / 2.5));

  return (
    <div className="space-y-6">
      {/* Sample Quick Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            Quick Presets
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEXTS.map((sample) => (
            <button
              key={sample.id}
              id={`preset-btn-${sample.id}`}
              onClick={() => handleSelectPreset(sample.id)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>{sample.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Script & Natural Text Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="tts-text-input" className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <span>Script / Text to Speak</span>
          </label>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>{characterCount} chars</span> • <span>~{estimatedSeconds}s audio</span>
          </div>
        </div>

        {/* Natural Expression & Pause Tag Insertion Bar */}
        <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <Sparkle className="w-3 h-3 text-amber-500" />
              <span>Natural Cadence Tags:</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                id="auto-polish-natural-btn"
                onClick={handleEnhanceNaturalness}
                className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium transition-colors border border-amber-200 cursor-pointer flex items-center gap-1"
                title="Format with natural pauses and breathing cadence"
              >
                <Wand2 className="w-3 h-3 text-amber-600" />
                <span>Polish Natural Pacing</span>
              </button>
              <button
                type="button"
                id="toggle-natural-tips-btn"
                onClick={() => setShowNaturalTips(!showNaturalTips)}
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="View natural speech guide"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {NATURAL_SPEECH_TAGS.map((tag) => (
              <button
                key={tag.label}
                type="button"
                id={`insert-tag-${tag.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => handleInsertTag(tag.insertText)}
                className="text-[11px] px-2 py-1 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-800 rounded-md font-medium transition-colors cursor-pointer shadow-2xs"
                title={tag.description}
              >
                + {tag.label}
              </button>
            ))}
          </div>

          {showNaturalTips && (
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1 animate-in fade-in">
              <p className="font-semibold text-slate-800">Pro-Tips for 100% Lifelike Natural Speech:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-500">
                <li>Use commas <code>,</code> and ellipses <code>...</code> for subtle organic speech cadence.</li>
                <li>Insert <code>[pause]</code> to let the voice take an authentic conversational pause before key points.</li>
                <li>Insert <code>[breath]</code> to trigger gentle micro-breathing cadence before long sentences.</li>
                <li>Select the <strong>Human Lifelike</strong> mode below for acoustic naturalness optimization.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            id="tts-text-input"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste the text you want Gemini TTS to speak naturally..."
            className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm leading-relaxed transition-all resize-y shadow-2xs"
          />
          {text.length > 0 && (
            <button
              id="clear-text-btn"
              onClick={() => setText('')}
              className="absolute top-3 right-3 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Voice Selection & Character Previews */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-sky-600" />
            <span>Select Voice & Audition Preview</span>
          </label>
          <span className="text-[11px] text-slate-400">Click ▶ to listen to any voice sample</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {VOICES.map((v: VoiceOption) => {
            const isSelected = selectedVoice === v.id;
            const isPlayingThisVoice = playingVoice === v.id;
            const isCartoon = v.isAiCartoon || v.category === 'ai-cartoon';
            const isFunny = (v.isAiFunny && !isCartoon) || v.category === 'ai-funny';
            const isNeural = (v.isAiNeural && !isCartoon && !isFunny) || v.category === 'ai-neural';
            const isKids = v.isKidsExplainer || v.category === 'kids-explainer' || v.id === 'SoftGirlKids';
            const isAi = isCartoon || isFunny || isNeural || isKids;

            return (
              <div
                key={v.id}
                id={`voice-card-${v.id}`}
                onClick={() => setSelectedVoice(v.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left flex flex-col justify-between relative group ${
                  isSelected
                    ? isKids
                      ? 'border-emerald-500 bg-emerald-50/60 shadow-xs ring-2 ring-emerald-500/80'
                      : isCartoon
                      ? 'border-rose-500 bg-rose-50/60 shadow-xs ring-2 ring-rose-500/80'
                      : isFunny
                      ? 'border-amber-500 bg-amber-50/60 shadow-xs ring-2 ring-amber-500/80'
                      : isNeural
                      ? 'border-violet-500 bg-violet-50/50 shadow-xs ring-2 ring-violet-500/80'
                      : 'border-sky-500 bg-sky-50/50 shadow-xs ring-2 ring-sky-500/80'
                    : isKids
                    ? 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 hover:border-emerald-300 hover:shadow-2xs'
                    : isCartoon
                    ? 'border-rose-200 bg-gradient-to-br from-white to-rose-50/30 hover:border-rose-300 hover:shadow-2xs'
                    : isFunny
                    ? 'border-amber-200 bg-gradient-to-br from-white to-amber-50/25 hover:border-amber-300 hover:shadow-2xs'
                    : isNeural
                    ? 'border-violet-200 bg-gradient-to-br from-white to-violet-50/20 hover:border-violet-300 hover:shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5 gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isAi ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-2xs ${
                              isKids
                                ? 'bg-gradient-to-tr from-emerald-500 to-teal-500'
                                : isCartoon
                                ? 'bg-gradient-to-tr from-rose-500 to-amber-500'
                                : isFunny
                                ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                                : 'bg-gradient-to-tr from-violet-600 to-indigo-600'
                            }`}
                          >
                            {isKids ? <BookOpen className="w-3.5 h-3.5" /> : isCartoon ? <Sparkles className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{v.name}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-900 text-sm">{v.name}</span>
                      )}

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isKids
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isCartoon
                            ? v.gender === 'Female'
                              ? 'bg-pink-100 text-pink-800 border border-pink-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isFunny
                            ? v.gender === 'Female'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-orange-100 text-orange-800 border border-orange-200'
                            : isNeural
                            ? v.gender === 'Female'
                              ? 'bg-violet-100 text-violet-700 border border-violet-200'
                              : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isKids ? 'Kids Explainer' : isCartoon ? `Cartoon ${v.gender}` : isAi ? `AI ${v.gender}` : v.gender}
                      </span>

                      {isSelected && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>

                    {/* Preview Audition Button & Waveform Equalizer */}
                    <div className="flex items-center gap-1">
                      {/* Audio Waveform Equalizer Animation */}
                      {isPlayingThisVoice && (
                        <div
                          className="flex items-end gap-0.5 h-4 px-1 py-0.5 bg-slate-900/80 rounded-md"
                          title="Audio equalizer visualizer active"
                        >
                          <span className="w-0.5 bg-rose-400 rounded-full animate-eq-1" />
                          <span className="w-0.5 bg-rose-400 rounded-full animate-eq-2" />
                          <span className="w-0.5 bg-rose-400 rounded-full animate-eq-3" />
                          <span className="w-0.5 bg-rose-400 rounded-full animate-eq-4" />
                        </div>
                      )}

                      <button
                        type="button"
                        id={`preview-voice-btn-${v.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPlayingThisVoice) {
                            stopPreview();
                          } else {
                            playPreview(v.id, v.previewSampleText);
                          }
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                          isPlayingThisVoice
                            ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                            : isKids
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-200'
                            : isCartoon
                            ? 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-200'
                            : isFunny
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200'
                            : isNeural
                            ? 'bg-violet-100 hover:bg-violet-200 text-violet-800 border border-violet-200'
                            : 'bg-sky-100 hover:bg-sky-200 text-sky-800'
                        }`}
                        title={`Listen to ${v.name} (${v.gender}) audition sample`}
                      >
                        {isPlayingThisVoice ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : isPreviewLoading && isPlayingThisVoice ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                            <span>Preview</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-1.5">
                    {v.description}
                  </p>

                  <div className="text-[11px] text-slate-500 italic mb-2">
                    {v.toneProfile}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-1 pt-1.5 border-t border-slate-100/80">
                  {v.traits.map((trait) => (
                    <span
                      key={trait}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isKids
                          ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200/60'
                          : isCartoon
                          ? 'bg-rose-100/80 text-rose-800 border border-rose-200/60'
                          : isFunny
                          ? 'bg-amber-100/80 text-amber-800 border border-amber-200/60'
                          : isNeural && trait.includes('AI')
                          ? 'bg-violet-100/80 text-violet-700 border border-violet-200/60'
                          : 'text-slate-600 bg-slate-100'
                      }`}
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Naturalness Optimization Mode */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          Natural Speech Engine Optimization
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {NATURALNESS_MODES.map((mode) => {
            const isSelected = naturalnessMode === mode.id;
            return (
              <button
                key={mode.id}
                id={`naturalness-mode-btn-${mode.id}`}
                onClick={() => setNaturalnessMode(mode.id as NaturalnessMode)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/70 text-sky-900 ring-1 ring-sky-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-xs font-semibold">{mode.label}</div>
                <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                  {mode.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tone & Style Presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            Speaking Tone & Delivery Style
          </label>
          <button
            id="toggle-custom-tone-btn"
            onClick={() => setShowCustomPrompt(!showCustomPrompt)}
            className="text-xs text-sky-600 hover:text-sky-700 font-medium cursor-pointer flex items-center gap-1"
          >
            <Wand2 className="w-3 h-3" />
            {showCustomPrompt ? 'Hide Director Prompt' : 'Custom Tone Director'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TONE_STYLES.map((st: ToneStyle) => {
            const isSelected = selectedStyle === st.id && !customPrompt;
            return (
              <button
                key={st.id}
                id={`style-btn-${st.id}`}
                onClick={() => {
                  setSelectedStyle(st.id);
                  if (customPrompt) setCustomPrompt('');
                }}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50 text-sky-900 font-medium ring-1 ring-sky-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-xs font-medium leading-snug">{st.label}</div>
                <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{st.description}</div>
              </button>
            );
          })}
        </div>

        {showCustomPrompt && (
          <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <label htmlFor="custom-director-prompt" className="text-xs font-semibold text-sky-900 flex items-center gap-1">
                <Wand2 className="w-3.5 h-3.5 text-sky-600" />
                Director Prompt (Voice Instruction)
              </label>
              <span className="text-[11px] text-sky-700">Sent as direct acoustic directive to Gemini TTS</span>
            </div>
            <input
              id="custom-director-prompt"
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Speak like an inspiring, warm podcast host with natural pauses and authentic inflection"
              className="w-full px-3 py-2 text-xs bg-white border border-sky-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        )}
      </div>

      {/* Generate Action Button */}
      <div className="pt-2">
        <button
          id="generate-tts-btn"
          onClick={onGenerate}
          disabled={isLoading || !text.trim()}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isLoading || !text.trim()
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-sky-600 hover:bg-sky-700 active:scale-98 text-white shadow-md shadow-sky-600/15'
          }`}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Synthesizing Speech with Gemini 3.1 Flash TTS...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Synthesize Natural Speech</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
