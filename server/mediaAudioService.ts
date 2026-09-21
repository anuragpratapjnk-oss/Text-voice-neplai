import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { getVerifiedFfmpegPath, getVerifiedFfprobePath } from "./ffmpegResolver.ts";

const execPromise = promisify(exec);

export interface MediaProbeResult {
  hasAudioStream: boolean;
  hasVideoStream: boolean;
  mediaType: "audio" | "video";
  audioCodec?: string;
  videoCodec?: string;
  sampleRate?: number;
  channels?: number;
  durationSec: number;
  formatName?: string;
  bitrate?: number;
}

export interface VolumeAnalysisResult {
  maxVolumeDb: number;
  meanVolumeDb: number;
  isSilent: boolean;
}

export interface ExtractedAudioChunk {
  chunkIndex: number;
  totalChunks: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  wavBase64: string;
}

export interface MediaExtractionResult {
  durationSec: number;
  fileSize: number;
  mediaType: "audio" | "video";
  probe: MediaProbeResult;
  volume: VolumeAnalysisResult;
  chunks: ExtractedAudioChunk[];
}

/**
 * Run ffprobe to inspect streams, detecting audio and video channels
 */
export async function probeMedia(filePath: string): Promise<MediaProbeResult> {
  console.log(`[FFprobe] Probing media file: ${filePath}`);
  try {
    const ffprobePath = await getVerifiedFfprobePath();
    const { stdout } = await execPromise(
      `"${ffprobePath}" -v error -show_entries format=duration,format_name,bit_rate:stream=codec_type,codec_name,sample_rate,channels -of json "${filePath}"`
    );
    const parsed = JSON.parse(stdout);
    const streams = parsed.streams || [];
    const format = parsed.format || {};

    const audioStream = streams.find((s: any) => s.codec_type === "audio");
    const videoStream = streams.find((s: any) => s.codec_type === "video");

    const duration = parseFloat(format.duration || audioStream?.duration || videoStream?.duration || "0");
    const hasAudio = !!audioStream;
    const hasVideo = !!videoStream;

    const result: MediaProbeResult = {
      hasAudioStream: hasAudio,
      hasVideoStream: hasVideo,
      mediaType: hasVideo ? "video" : "audio",
      audioCodec: audioStream?.codec_name,
      videoCodec: videoStream?.codec_name,
      sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined,
      channels: audioStream?.channels ? parseInt(audioStream.channels, 10) : undefined,
      durationSec: isNaN(duration) ? 0 : duration,
      formatName: format.format_name,
      bitrate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
    };

    console.log(
      `[FFprobe] Result: mediaType=${result.mediaType}, hasAudio=${result.hasAudioStream}, hasVideo=${result.hasVideoStream}, duration=${result.durationSec.toFixed(2)}s, audioCodec=${result.audioCodec}`
    );
    return result;
  } catch (error: any) {
    console.warn(`[FFprobe] Probe failed or warning:`, error.message);
    throw new Error(`This media file appears to be corrupted or unsupported.`);
  }
}

/**
 * Measure audio volume levels (peak and RMS) using ffmpeg volumedetect
 */
export async function analyzeAudioVolume(filePath: string): Promise<VolumeAnalysisResult> {
  console.log(`[FFmpeg] Analyzing audio volume levels for: ${filePath}`);
  try {
    const ffmpegPath = await getVerifiedFfmpegPath();
    const { stderr } = await execPromise(
      `"${ffmpegPath}" -i "${filePath}" -af "volumedetect" -f null /dev/null 2>&1 || true`
    );

    const maxVolMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
    const meanVolMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);

    const maxVolumeDb = maxVolMatch ? parseFloat(maxVolMatch[1]) : -20;
    const meanVolumeDb = meanVolMatch ? parseFloat(meanVolMatch[1]) : -35;
    // Audio is considered silent if peak volume is lower than -65 dB or infinite silence
    const isSilent = maxVolumeDb <= -65 || stderr.includes("max_volume: -inf dB");

    console.log(
      `[Audio Validation] Volume analysis: max_volume=${maxVolumeDb} dB, mean_volume=${meanVolumeDb} dB, isSilent=${isSilent}`
    );
    return {
      maxVolumeDb,
      meanVolumeDb,
      isSilent,
    };
  } catch (error: any) {
    console.warn(`[FFmpeg] Volume analysis warning:`, error.message);
    return {
      maxVolumeDb: -15,
      meanVolumeDb: -30,
      isSilent: false,
    };
  }
}

/**
 * Extract audio track to normalized 16kHz mono 16-bit PCM WAV,
 * applying loudness normalization so quiet voices and phone recordings are audible.
 */
export async function extractAndNormalizeWav(
  inputPath: string,
  outputPath: string
): Promise<void> {
  console.log(`[FFmpeg] Normalizing media to 16kHz mono PCM WAV...`);
  const ffmpegPath = await getVerifiedFfmpegPath();

  // Attempt loudnorm filter for speech optimization
  try {
    await execPromise(
      `"${ffmpegPath}" -y -i "${inputPath}" -vn -ac 1 -ar 16000 -c:a pcm_s16le -af "loudnorm=I=-16:TP=-1.5:LRA=11" "${outputPath}"`
    );
    console.log(`[FFmpeg] Loudness normalization complete.`);
    return;
  } catch (loudnormErr: any) {
    console.warn(
      `[FFmpeg] loudnorm filter failed (short or irregular file), falling back to standard extraction:`,
      loudnormErr.message
    );
  }

  // Fallback extraction
  await execPromise(
    `"${ffmpegPath}" -y -i "${inputPath}" -vn -ac 1 -ar 16000 -c:a pcm_s16le "${outputPath}"`
  );
  console.log(`[FFmpeg] Standard extraction complete.`);
}

/**
 * Split a WAV file into chunks of chunkDurationSec with overlapSec
 */
export async function chunkWavFile(
  wavPath: string,
  totalDurationSec: number,
  chunkLengthSec: number = 240, // 4 minutes
  overlapSec: number = 3 // 3 seconds overlap
): Promise<ExtractedAudioChunk[]> {
  console.log(
    `[FFmpeg] Chunking WAV: totalDuration=${totalDurationSec.toFixed(2)}s, chunkLength=${chunkLengthSec}s, overlap=${overlapSec}s`
  );

  // If audio is short, return single chunk directly
  if (totalDurationSec <= chunkLengthSec + 20) {
    const buffer = await fs.promises.readFile(wavPath);
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        startSec: 0,
        endSec: totalDurationSec,
        durationSec: totalDurationSec,
        wavBase64: buffer.toString("base64"),
      },
    ];
  }

  const chunks: ExtractedAudioChunk[] = [];
  const stepSec = chunkLengthSec - overlapSec;
  const numChunks = Math.ceil(totalDurationSec / stepSec);
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "speech_chunk_"));
  const ffmpegPath = await getVerifiedFfmpegPath();

  try {
    for (let i = 0; i < numChunks; i++) {
      const chunkStart = i * stepSec;
      const chunkEnd = Math.min(totalDurationSec, chunkStart + chunkLengthSec);
      const chunkDur = chunkEnd - chunkStart;

      if (chunkDur <= 0.5) break;

      const chunkOutPath = path.join(tempDir, `chunk_${i}.wav`);
      await execPromise(
        `"${ffmpegPath}" -y -ss ${chunkStart.toFixed(3)} -t ${chunkDur.toFixed(3)} -i "${wavPath}" -c copy "${chunkOutPath}"`
      );

      const chunkBuffer = await fs.promises.readFile(chunkOutPath);
      chunks.push({
        chunkIndex: i,
        totalChunks: numChunks,
        startSec: chunkStart,
        endSec: chunkEnd,
        durationSec: chunkDur,
        wavBase64: chunkBuffer.toString("base64"),
      });

      try {
        await fs.promises.unlink(chunkOutPath);
      } catch {}
    }
  } finally {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {}
  }

  console.log(`[FFmpeg] Generated ${chunks.length} audio chunks for transcription.`);
  return chunks;
}

/**
 * Universal processing pipeline for Audio and Video media files:
 * 1. Validate file exists & size
 * 2. Probe streams (audio & video)
 * 3. Enforce audio stream presence (distinguish "No audio track was found in this video" vs "No speech detected")
 * 4. Analyze volume & silence
 * 5. Extract & normalize to 16kHz mono PCM WAV
 * 6. Chunk into time slices with overlap
 */
export async function processMediaFileForTranscription(
  filePath: string,
  fileName: string
): Promise<MediaExtractionResult> {
  const stats = await fs.promises.stat(filePath);
  const fileSize = stats.size;
  console.log(`[Media Pipeline] Processing media file: "${fileName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);

  // Step 1: Probe media
  const probe = await probeMedia(filePath);

  // Step 2: Validate audio track exists
  if (!probe.hasAudioStream) {
    if (probe.hasVideoStream) {
      throw new Error(
        `No audio track was found in this video. Please upload a file containing speech.`
      );
    } else {
      throw new Error(
        `No audio track found. Please upload an audio or video file containing speech.`
      );
    }
  }

  // Step 3: Analyze audio volume
  const volume = await analyzeAudioVolume(filePath);
  if (volume.isSilent) {
    console.warn(`[Media Pipeline] Warning: Audio stream in "${fileName}" appears silent (peak: ${volume.maxVolumeDb} dB).`);
  }

  // Step 4: Extract & normalize to 16kHz mono PCM WAV
  const tempWavPath = path.join(
    os.tmpdir(),
    `norm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.wav`
  );

  try {
    await extractAndNormalizeWav(filePath, tempWavPath);

    // Read normalized WAV duration
    const wavProbe = await probeMedia(tempWavPath);
    const duration = wavProbe.durationSec > 0 ? wavProbe.durationSec : probe.durationSec;

    // Step 5: Chunk WAV
    const chunks = await chunkWavFile(tempWavPath, duration);

    return {
      durationSec: duration,
      fileSize,
      mediaType: probe.mediaType,
      probe,
      volume,
      chunks,
    };
  } finally {
    try {
      await fs.promises.unlink(tempWavPath);
    } catch {}
  }
}

export const processVideoFileForTranscription = processMediaFileForTranscription;
