/**
 * Audio Extraction and Chunking Utility for Video Transcription
 * Decodes video audio tracks client-side, downsamples to 16kHz mono WAV chunks,
 * and handles smart chunking with overlap for unlimited duration video processing.
 */

export interface AudioChunk {
  chunkIndex: number;
  totalChunks: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  overlapSec: number;
  wavBase64: string;
}

export interface VideoMetadata {
  durationSec: number;
  fileSize: number;
  fileName: string;
  videoFormat: string;
  sampleRate: number;
  channels: number;
}

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
export function formatTime(seconds: number, forceHours: boolean = false): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0 || forceHours) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format seconds for SRT subtitles (00:00:00,000)
 */
export function formatSrtTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format seconds for VTT subtitles (00:00:00.000)
 */
export function formatVttTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Convert AudioBuffer channel data (Float32Array) slice to 16-bit 16kHz PCM WAV base64 string
 */
function encodeWAV(
  audioBuffer: AudioBuffer,
  startSample: number,
  sampleCount: number,
  targetSampleRate: number = 16000
): string {
  const sourceSampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  
  // Downsampling ratio
  const ratio = sourceSampleRate / targetSampleRate;
  const targetSampleCount = Math.floor(sampleCount / ratio);
  
  // Convert multi-channel to mono float array
  const sourceData = new Float32Array(sampleCount);
  let maxAbs = 0;
  for (let c = 0; c < numChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    const scale = 1 / numChannels;
    for (let i = 0; i < sampleCount; i++) {
      const sampleVal = (channelData[startSample + i] || 0) * scale;
      sourceData[i] += sampleVal;
      const absVal = Math.abs(sourceData[i]);
      if (absVal > maxAbs) maxAbs = absVal;
    }
  }

  // Automatic volume normalization: if audio is faint or quiet, boost gain up to safe ceiling (0.85)
  // to ensure speech clarity for the transcription engine
  const normGain = maxAbs > 0.005 && maxAbs < 0.7 ? Math.min(8.0, 0.85 / maxAbs) : 1.0;

  // Downsample to target sample rate using linear interpolation
  const pcm16 = new Int16Array(targetSampleCount);
  for (let i = 0; i < targetSampleCount; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, sampleCount - 1);
    const frac = srcIndex - i0;
    const sample = ((1 - frac) * sourceData[i0] + frac * sourceData[i1]) * normGain;
    
    // Clamp to -1.0 to 1.0 and scale to 16-bit integer
    const clamped = Math.max(-1, Math.min(1, sample));
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  // Build WAV Header
  const dataByteLength = pcm16.length * 2;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 for mono)
  view.setUint32(24, targetSampleRate, true); // SampleRate
  view.setUint32(28, targetSampleRate * 2, true); // ByteRate (SampleRate * 1 channel * 2 bytes)
  view.setUint16(32, 2, true); // BlockAlign (1 channel * 2 bytes)
  view.setUint16(34, 16, true); // BitsPerSample
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Write PCM data
  const uint8Data = new Uint8Array(buffer, 44);
  const pcmBytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  uint8Data.set(pcmBytes);

  // Convert ArrayBuffer to Base64 efficiently without huge callstack / array allocations
  return arrayBufferToBase64(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Memory-safe ArrayBuffer to Base64 conversion without stack overflow or excessive GC pressure
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

/**
 * Extract audio track from video file and produce chunked audio payload
 * for unlimited duration processing
 */
export async function extractAndChunkVideoAudio(
  file: File,
  chunkLengthSeconds: number = 240, // 4 minutes per chunk
  overlapSeconds: number = 3, // 3 seconds overlap for word continuity
  onProgress?: (stage: string, percent: number) => void
): Promise<{
  metadata: VideoMetadata;
  chunks: AudioChunk[];
}> {
  onProgress?.('Reading video file into memory...', 10);
  
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.('Decoding audio track from video...', 30);
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioCtx = new AudioContextClass();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (decodeErr: any) {
    console.error('AudioContext decodeAudioData error:', decodeErr);
    throw new Error(
      'Could not decode audio from video file. Please make sure the video has an audible audio track (AAC, MP3, Opus, etc.).'
    );
  } finally {
    try {
      if (audioCtx.state !== 'closed') {
        await audioCtx.close();
      }
    } catch {}
  }

  const totalDurationSec = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;

  onProgress?.('Extracting audio & preparing speech chunks...', 60);

  const metadata: VideoMetadata = {
    durationSec: totalDurationSec,
    fileSize: file.size,
    fileName: file.name,
    videoFormat: file.type || 'video/mp4',
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
  };

  // If video is short (e.g. <= 4.5 minutes), 1 chunk is sufficient
  if (totalDurationSec <= chunkLengthSeconds + 30) {
    const base64Wav = encodeWAV(audioBuffer, 0, totalSamples, 16000);
    onProgress?.('Audio extraction complete.', 100);
    return {
      metadata,
      chunks: [
        {
          chunkIndex: 0,
          totalChunks: 1,
          startSec: 0,
          endSec: totalDurationSec,
          durationSec: totalDurationSec,
          overlapSec: 0,
          wavBase64: base64Wav,
        },
      ],
    };
  }

  // Multi-chunk extraction for long-form video (unlimited length)
  const chunks: AudioChunk[] = [];
  const stepSeconds = chunkLengthSeconds - overlapSeconds;
  const numChunks = Math.ceil(totalDurationSec / stepSeconds);

  for (let i = 0; i < numChunks; i++) {
    const chunkStartSec = i * stepSeconds;
    const chunkEndSec = Math.min(totalDurationSec, chunkStartSec + chunkLengthSeconds);
    const chunkDuration = chunkEndSec - chunkStartSec;

    const startSample = Math.floor(chunkStartSec * sampleRate);
    const endSample = Math.min(totalSamples, Math.floor(chunkEndSec * sampleRate));
    const chunkSamples = endSample - startSample;

    if (chunkSamples <= 0) break;

    const wavBase64 = encodeWAV(audioBuffer, startSample, chunkSamples, 16000);
    chunks.push({
      chunkIndex: i,
      totalChunks: numChunks,
      startSec: chunkStartSec,
      endSec: chunkEndSec,
      durationSec: chunkDuration,
      overlapSec: i > 0 ? overlapSeconds : 0,
      wavBase64,
    });

    const percent = 60 + Math.floor(((i + 1) / numChunks) * 35);
    onProgress?.(`Extracting audio chunk ${i + 1} of ${numChunks}...`, percent);
  }

  onProgress?.('All audio chunks prepared for transcription.', 100);

  return {
    metadata,
    chunks,
  };
}
