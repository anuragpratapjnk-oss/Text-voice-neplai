import React from 'react';
import { DialogueLine, NaturalnessMode } from '../types';
import { VOICES, DIALOGUE_SAMPLES, NATURAL_SPEECH_TAGS, NATURALNESS_MODES } from '../data/presets';
import { useVoicePreview } from '../hooks/useVoicePreview';
import {
  Users,
  Plus,
  Trash2,
  Volume2,
  RefreshCw,
  Sparkles,
  Play,
  Square,
  Sparkle,
  Bot,
  BookOpen,
} from 'lucide-react';

interface DialogueTabProps {
  dialogueLines: DialogueLine[];
  setDialogueLines: React.Dispatch<React.SetStateAction<DialogueLine[]>>;
  naturalnessMode: NaturalnessMode;
  setNaturalnessMode: (mode: NaturalnessMode) => void;
  isLoading: boolean;
  onGenerate: () => void;
}

export const DialogueTab: React.FC<DialogueTabProps> = ({
  dialogueLines,
  setDialogueLines,
  naturalnessMode,
  setNaturalnessMode,
  isLoading,
  onGenerate,
}) => {
  const { playingVoice, playPreview, stopPreview, isLoading: isPreviewLoading } = useVoicePreview();

  const addLine = () => {
    const lastLine = dialogueLines[dialogueLines.length - 1];
    const newSpeaker = lastLine?.speaker === 'Anurag' ? 'Assistant' : 'Anurag';
    const newVoice = lastLine?.voice === 'Puck' ? 'Kore' : 'Puck';

    setDialogueLines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        speaker: newSpeaker,
        voice: newVoice,
        text: '',
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (dialogueLines.length <= 1) return;
    setDialogueLines((prev) => prev.filter((line) => line.id !== id));
  };

  const updateLine = (id: string, field: keyof DialogueLine, value: string) => {
    setDialogueLines((prev) =>
      prev.map((line) => {
        if (line.id === id) {
          return { ...line, [field]: value };
        }
        return line;
      })
    );
  };

  const insertTagToLine = (id: string, tagText: string) => {
    setDialogueLines((prev) =>
      prev.map((line) => {
        if (line.id === id) {
          return { ...line, text: (line.text || '') + tagText };
        }
        return line;
      })
    );
  };

  const loadSampleDialogue = (sampleIndex: number) => {
    const sample = DIALOGUE_SAMPLES[sampleIndex];
    if (sample) {
      setDialogueLines(
        sample.lines.map((l) => ({
          ...l,
          id: String(Math.random()),
        }))
      );
    }
  };

  const isValid = dialogueLines.some((l) => l.text.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* Dialogue Presets */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          Dialogue Templates
        </label>
        <div className="flex flex-wrap gap-2">
          {DIALOGUE_SAMPLES.map((sample, idx) => (
            <button
              key={sample.title}
              id={`dialogue-sample-${idx}`}
              onClick={() => loadSampleDialogue(idx)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>{sample.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Voice Previews Strip */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>Quick Character Voice Auditions:</span>
          <span className="text-[11px] text-slate-400 font-normal">Click to test voices before assigning</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {VOICES.map((v) => {
            const isPlayingThisVoice = playingVoice === v.id;
            const isCartoon = v.isAiCartoon || v.category === 'ai-cartoon';
            const isFunny = (v.isAiFunny && !isCartoon) || v.category === 'ai-funny';
            const isNeural = (v.isAiNeural && !isCartoon && !isFunny) || v.category === 'ai-neural';
            const isKids = v.isKidsExplainer || v.category === 'kids-explainer' || v.id === 'SoftGirlKids';
            const isAi = isCartoon || isFunny || isNeural || isKids;
            return (
              <button
                key={v.id}
                type="button"
                id={`audition-dialogue-voice-${v.id}`}
                onClick={() => {
                  if (isPlayingThisVoice) {
                    stopPreview();
                  } else {
                    playPreview(v.id, v.previewSampleText);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium border transition-all cursor-pointer ${
                  isPlayingThisVoice
                    ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                    : isKids
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900'
                    : isCartoon
                    ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-800'
                    : isFunny
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                    : isNeural
                    ? 'bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-800'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {isPlayingThisVoice ? (
                  <>
                    <Square className="w-3 h-3 fill-current" />
                    <div className="flex items-end gap-0.5 h-3 px-0.5" title="Equalizer active">
                      <span className="w-0.5 bg-white rounded-full animate-eq-1" />
                      <span className="w-0.5 bg-white rounded-full animate-eq-2" />
                      <span className="w-0.5 bg-white rounded-full animate-eq-3" />
                    </div>
                  </>
                ) : (
                  <>
                    {isKids ? (
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    ) : isCartoon ? (
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                    ) : isAi ? (
                      <Bot className={`w-3.5 h-3.5 ${isFunny ? 'text-amber-600' : 'text-violet-600'}`} />
                    ) : (
                      <Play className="w-3 h-3 fill-current text-sky-600" />
                    )}
                  </>
                )}
                <span>
                  {v.name} ({isKids ? 'Kids Explainer' : isCartoon ? `Cartoon ${v.gender}` : isAi ? `AI ${v.gender}` : v.gender})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Script Lines List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-600" />
            Dialogue Script (Multi-Speaker)
          </label>
          <button
            id="add-dialogue-line-btn"
            onClick={addLine}
            className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Line
          </button>
        </div>

        <div className="space-y-3">
          {dialogueLines.map((line, index) => (
            <div
              key={line.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <span className="text-xs font-mono text-slate-400">#{index + 1}</span>
                  <input
                    id={`speaker-name-input-${index}`}
                    type="text"
                    value={line.speaker}
                    onChange={(e) => updateLine(line.id, 'speaker', e.target.value)}
                    placeholder="Speaker Name"
                    className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-sky-500 w-32"
                  />
                  <div className="flex items-center gap-1">
                    <select
                      id={`speaker-voice-select-${index}`}
                      value={line.voice}
                      onChange={(e) => updateLine(line.id, 'voice', e.target.value)}
                      className="px-2 py-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                    >
                      {VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.isAiCartoon ? `Cartoon ${v.gender}` : v.isAiFunny ? `Funny AI ${v.gender}` : v.isAiNeural ? `AI ${v.gender}` : v.gender})
                        </option>
                      ))}
                    </select>

                    {/* Mini inline voice preview */}
                    <button
                      type="button"
                      id={`inline-preview-voice-${index}`}
                      onClick={() => {
                        if (playingVoice === line.voice) {
                          stopPreview();
                        } else {
                          const voiceObj = VOICES.find((v) => v.id === line.voice);
                          playPreview(line.voice, voiceObj?.previewSampleText);
                        }
                      }}
                      className="p-1 rounded-md text-slate-500 hover:text-sky-600 hover:bg-slate-100 cursor-pointer"
                      title="Audition selected character voice"
                    >
                      {playingVoice === line.voice ? (
                        <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                    </button>
                  </div>
                </div>

                {dialogueLines.length > 1 && (
                  <button
                    id={`delete-line-btn-${index}`}
                    onClick={() => removeLine(line.id)}
                    className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors cursor-pointer"
                    title="Remove line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <textarea
                id={`dialogue-text-input-${index}`}
                rows={2}
                value={line.text}
                onChange={(e) => updateLine(line.id, 'text', e.target.value)}
                placeholder={`What does ${line.speaker || 'this speaker'} say? Use [pause] or ... for natural flow.`}
                className="w-full p-2.5 text-xs text-slate-800 bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-y"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Add pause:</span>
                  <button
                    type="button"
                    onClick={() => insertTagToLine(line.id, ' [pause] ')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 rounded text-[10px] font-medium text-slate-600 cursor-pointer"
                  >
                    + pause (0.5s)
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTagToLine(line.id, ' [breath] ')}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 rounded text-[10px] font-medium text-slate-600 cursor-pointer"
                  >
                    + breath
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Naturalness Optimization Mode for Dialogue */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          Conversational Naturalness Tuning
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {NATURALNESS_MODES.map((mode) => {
            const isSelected = naturalnessMode === mode.id;
            return (
              <button
                key={mode.id}
                id={`dialogue-naturalness-btn-${mode.id}`}
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

      {/* Generate Action Button */}
      <div className="pt-2">
        <button
          id="generate-dialogue-tts-btn"
          onClick={onGenerate}
          disabled={isLoading || !isValid}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isLoading || !isValid
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-sky-600 hover:bg-sky-700 active:scale-98 text-white shadow-md shadow-sky-600/15'
          }`}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Synthesizing Natural Multi-Speaker Conversation...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Synthesize Dialogue Conversation</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
