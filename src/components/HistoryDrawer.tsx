import React from 'react';
import { GenerationHistoryItem } from '../types';
import { Play, Download, Trash2, Clock, Volume2, History } from 'lucide-react';

interface HistoryDrawerProps {
  history: GenerationHistoryItem[];
  onSelectAudio: (item: GenerationHistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
  currentPlayingId?: string;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  history,
  onSelectAudio,
  onDeleteHistoryItem,
  onClearHistory,
  currentPlayingId,
}) => {
  if (history.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">No Audio Generations Yet</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Synthesize any text or dialogue above and your generated speech clips will appear here for instant replay and download.
        </p>
      </div>
    );
  }

  const downloadItemWav = (item: GenerationHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = `data:audio/wav;base64,${item.audioData}`;
    link.download = `gemini-tts-${item.id}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>Recent Generations ({history.length})</span>
        </div>
        <button
          id="clear-all-history-btn"
          onClick={onClearHistory}
          className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {history.map((item) => {
          const isCurrent = currentPlayingId === item.id;
          const formattedDate = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={item.id}
              id={`history-item-${item.id}`}
              onClick={() => onSelectAudio(item)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isCurrent
                  ? 'border-sky-500 bg-sky-50/60 shadow-2xs ring-1 ring-sky-400'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  id={`play-history-btn-${item.id}`}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform ${
                    isCurrent ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-sky-100 hover:text-sky-700'
                  }`}
                  aria-label="Play item"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate leading-snug">
                    {item.text || (item.dialogue ? `Dialogue (${item.dialogue.length} lines)` : 'Audio')}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-600 flex items-center gap-0.5">
                      <Volume2 className="w-3 h-3 text-sky-600" />
                      {item.voice}
                    </span>
                    {item.style && item.style !== 'neutral' && (
                      <span className="capitalize bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                        {item.style}
                      </span>
                    )}
                    <span>•</span>
                    <span>{formattedDate}</span>
                    {item.durationEstimateSec && (
                      <>
                        <span>•</span>
                        <span>{item.durationEstimateSec}s</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  id={`download-history-item-${item.id}`}
                  onClick={(e) => downloadItemWav(item, e)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                  title="Download WAV"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  id={`delete-history-item-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteHistoryItem(item.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                  title="Delete from history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
