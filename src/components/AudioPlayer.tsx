import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Download, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface AudioPlayerProps {
  audioBase64: string;
  title?: string;
  subtitle?: string;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBase64,
  title = 'Generated Audio',
  subtitle = 'Gemini 3.1 Flash TTS',
  onPlayStateChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioSrc = `data:audio/wav;base64,${audioBase64}`;

  // Initialize Web Audio API Analyser for visualizer
  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || audioCtxRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (e) {
      console.warn('Web Audio Context initialization warning:', e);
    }
  }, []);

  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    if (analyserRef.current && isPlaying) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * (height * 0.85);

        // Smooth subtle gradient
        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#0284c7'); // sky-600
        gradient.addColorStop(1, '#38bdf8'); // sky-400

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, Math.max(barWidth - 2, 2), barHeight, [3, 3, 0, 0]);
        ctx.fill();

        x += barWidth;
      }
    } else {
      // Idle wave representation
      ctx.clearRect(0, 0, width, height);
      const bars = 40;
      const barWidth = width / bars;
      for (let i = 0; i < bars; i++) {
        const pseudoHeight = Math.sin(i * 0.3) * 6 + 10;
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.roundRect(i * barWidth + 2, height / 2 - pseudoHeight / 2, Math.max(barWidth - 4, 2), pseudoHeight, [2, 2, 2, 2]);
        ctx.fill();
      }
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(drawVisualizer);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(drawVisualizer);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      drawVisualizer();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, drawVisualizer]);

  // Audio element listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
      setCurrentTime(0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlayStateChange?.(true);
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [onPlayStateChange]);

  const togglePlayPause = async () => {
    if (!audioRef.current) return;
    setupAudioContext();

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      try {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
        await audioRef.current.play();
      } catch (err) {
        console.error('Audio playback error:', err);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      if (!isPlaying) {
        togglePlayPause();
      }
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 1;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const downloadWav = () => {
    const link = document.createElement('a');
    link.href = audioSrc;
    link.download = `gemini-tts-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-all">
      <audio ref={audioRef} src={audioSrc} preload="auto" />

      {/* Header with Title & Download */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-semibold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base leading-tight">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="download-wav-btn"
            onClick={downloadWav}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Download WAV Audio File"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download WAV</span>
          </button>
        </div>
      </div>

      {/* Visualizer Canvas */}
      <div className="w-full h-16 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center p-2 mb-4 relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={64}
          className="w-full h-full object-cover"
        />
        {isPlaying && (
          <span className="absolute top-2 right-2 text-[10px] uppercase font-mono tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
            Playing • 24kHz
          </span>
        )}
      </div>

      {/* Scrubber / Progress Bar */}
      <div className="space-y-1.5 mb-4">
        <input
          id="audio-seek-slider"
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600 focus:outline-hidden"
        />
        <div className="flex justify-between text-xs text-slate-500 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="play-pause-btn"
            onClick={togglePlayPause}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-sky-600 hover:bg-sky-700 active:scale-95 text-white transition-transform cursor-pointer shadow-xs"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
          </button>

          <button
            id="restart-audio-btn"
            onClick={handleRestart}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Replay from start"
            aria-label="Restart audio"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {[0.75, 1, 1.25, 1.5].map((speed) => (
            <button
              key={speed}
              id={`speed-btn-${speed}`}
              onClick={() => changeSpeed(speed)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                playbackRate === speed
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Volume Controls */}
        <div className="flex items-center gap-2">
          <button
            id="mute-toggle-btn"
            onClick={toggleMute}
            className="text-slate-500 hover:text-slate-700 cursor-pointer"
            aria-label="Toggle mute"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            id="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
};
