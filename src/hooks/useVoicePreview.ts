import { useState, useRef, useCallback } from 'react';

interface VoicePreviewState {
  playingVoice: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useVoicePreview() {
  const [state, setState] = useState<VoicePreviewState>({
    playingVoice: null,
    isLoading: false,
    error: null,
  });

  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopPreview = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    setState((prev) => ({ ...prev, playingVoice: null }));
  }, []);

  const playPreview = useCallback(async (voiceName: string, sampleText?: string) => {
    // If clicking the same voice that is already playing, pause it
    if (state.playingVoice === voiceName && currentAudioRef.current && !currentAudioRef.current.paused) {
      stopPreview();
      return;
    }

    stopPreview();
    setState({ playingVoice: voiceName, isLoading: true, error: null });

    const cacheKey = `${voiceName}:${sampleText || ''}`;

    try {
      let audio = audioCacheRef.current.get(cacheKey);

      if (!audio) {
        const token = localStorage.getItem('gemini_tts_auth_token_v1');
        const response = await fetch('/api/voice-preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ voice: voiceName, sampleText }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          const errMsg = typeof data.error === 'object' ? data.error?.message || JSON.stringify(data.error) : data.error;
          throw new Error(errMsg || `Could not preview ${voiceName}`);
        }

        const audioUrl = `data:audio/wav;base64,${data.audioData}`;
        audio = new Audio(audioUrl);
        audioCacheRef.current.set(cacheKey, audio);
      }

      currentAudioRef.current = audio;

      audio.onended = () => {
        setState((prev) => ({ ...prev, playingVoice: null, isLoading: false }));
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setState((prev) => ({ ...prev, playingVoice: null, isLoading: false, error: 'Playback error' }));
        currentAudioRef.current = null;
      };

      await audio.play();
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (err: any) {
      console.error('Voice preview error:', err);
      setState({
        playingVoice: null,
        isLoading: false,
        error: err.message || 'Failed to play voice preview',
      });
    }
  }, [state.playingVoice, stopPreview]);

  return {
    playingVoice: state.playingVoice,
    isLoading: state.isLoading,
    previewError: state.error,
    playPreview,
    stopPreview,
  };
}
