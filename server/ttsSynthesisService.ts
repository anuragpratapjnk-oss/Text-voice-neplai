import { GoogleGenAI, Modality } from "@google/genai";
import { spawnFfmpeg, formatFfmpegError } from "./ffmpegResolver.ts";

/**
 * Automatically detect language code for speech synthesis (English, Nepali, Hindi, Spanish, French, etc.)
 */
export function detectLanguage(text: string): string {
  if (!text) return "en";

  // Check for Devanagari script (Nepali and Hindi)
  if (/[\u0900-\u097F]/.test(text)) {
    // Specific Nepali markers and common vocab
    const nepaliPattern = /(छ|छन्|भयो|नेपाल|नेपाली|हो|लाई|बाट|थियो|गरेर|पनि|दिन|राम्रो|धेरै|गर्छ|गर्ने|कसरी|हुन|भने|यहाँ|कस्तो|तिमी|हामी|मेरो|तिम्रो)/;
    if (nepaliPattern.test(text)) {
      return "ne";
    }
    // Default Devanagari to Hindi
    return "hi";
  }

  // European and Asian language patterns
  if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
  if (/[àâçèêëîïôûùüÿœæ]/i.test(text)) return "fr";
  if (/[äöüß]/i.test(text)) return "de";
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";

  return "en";
}

// 24kHz 16-bit Mono WAV conversion
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitDepth: number = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF identifier
  header.write("RIFF", 0);
  // file length minus RIFF identifier & file length field
  header.writeUInt32LE(36 + dataSize, 4);
  // RIFF type
  header.write("WAVE", 8);
  // format chunk identifier
  header.write("fmt ", 12);
  // format chunk length
  header.writeUInt32LE(16, 16);
  // sample format (1 = PCM)
  header.writeUInt16LE(1, 20);
  // channel count
  header.writeUInt16LE(numChannels, 22);
  // sample rate
  header.writeUInt32LE(sampleRate, 24);
  // byte rate
  header.writeUInt32LE(byteRate, 28);
  // block align
  header.writeUInt16LE(blockAlign, 32);
  // bits per sample
  header.writeUInt16LE(bitDepth, 34);
  // data chunk identifier
  header.write("data", 36);
  // data chunk length
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Supported prebuilt Gemini voices
export const GEMINI_SUPPORTED_VOICES = new Set([
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Zephyr",
]);

// Map any voice ID to a supported Gemini voice
export function mapToGeminiVoice(voice: string): string {
  const v = voice?.trim() || "";
  if (GEMINI_SUPPORTED_VOICES.has(v)) {
    return v;
  }
  const lower = v.toLowerCase();
  if (lower.includes("soft") || lower.includes("kids") || lower.includes("explainer")) return "Kore";
  if (lower.includes("cartoon") && lower.includes("female")) return "Kore";
  if (lower.includes("cartoon") || lower.includes("funny") && lower.includes("male")) return "Puck";
  if (lower.includes("funny") && lower.includes("female")) return "Kore";
  if (lower.includes("neural") && lower.includes("male")) return "Charon";
  if (lower.includes("neural") && lower.includes("female")) return "Zephyr";
  if (lower === "aoede") return "Kore";
  if (lower === "fenrir") return "Fenrir";
  if (lower === "charon") return "Charon";
  if (lower === "puck") return "Puck";
  if (lower === "zephyr") return "Zephyr";
  return "Kore";
}

// Voice filter profiles for the high-fidelity acoustic engine
interface VoiceAcousticProfile {
  pitchMultiplier: number;
  tempoMultiplier: number;
  filterExtra: string;
}

export const VOICE_PROFILES: Record<string, VoiceAcousticProfile> = {
  Charon: {
    pitchMultiplier: 0.82,
    tempoMultiplier: 0.95,
    filterExtra: "bass=g=5:f=120,equalizer=f=3000:t=q:w=1:g=-2",
  },
  Fenrir: {
    pitchMultiplier: 0.87,
    tempoMultiplier: 0.98,
    filterExtra: "bass=g=4:f=150,treble=g=1:f=3500",
  },
  Puck: {
    pitchMultiplier: 1.14,
    tempoMultiplier: 1.06,
    filterExtra: "treble=g=2:f=3000",
  },
  Kore: {
    pitchMultiplier: 1.04,
    tempoMultiplier: 1.00,
    filterExtra: "equalizer=f=1000:t=q:w=1.5:g=1",
  },
  Zephyr: {
    pitchMultiplier: 1.06,
    tempoMultiplier: 0.93,
    filterExtra: "lowpass=f=4500,treble=g=-1:f=4000",
  },
  Aoede: {
    pitchMultiplier: 1.15,
    tempoMultiplier: 1.02,
    filterExtra: "treble=g=3:f=3500",
  },
  AICartoonMale: {
    pitchMultiplier: 1.34,
    tempoMultiplier: 1.14,
    filterExtra: "treble=g=6:f=4000,equalizer=f=800:t=q:w=2:g=-3",
  },
  "ai-cartoon-male": {
    pitchMultiplier: 1.34,
    tempoMultiplier: 1.14,
    filterExtra: "treble=g=6:f=4000,equalizer=f=800:t=q:w=2:g=-3",
  },
  AICartoonFemale: {
    pitchMultiplier: 1.52,
    tempoMultiplier: 1.16,
    filterExtra: "treble=g=7:f=4500,equalizer=f=600:t=q:w=2:g=-4",
  },
  "ai-cartoon-female": {
    pitchMultiplier: 1.52,
    tempoMultiplier: 1.16,
    filterExtra: "treble=g=7:f=4500,equalizer=f=600:t=q:w=2:g=-4",
  },
  AIFunnyMale: {
    pitchMultiplier: 1.20,
    tempoMultiplier: 1.08,
    filterExtra: "flanger=delay=1.5:depth=2:regen=0:width=71:speed=0.5:shape=sine,treble=g=3:f=3200",
  },
  "ai-funny-male": {
    pitchMultiplier: 1.20,
    tempoMultiplier: 1.08,
    filterExtra: "flanger=delay=1.5:depth=2:regen=0:width=71:speed=0.5:shape=sine,treble=g=3:f=3200",
  },
  AIFunnyFemale: {
    pitchMultiplier: 1.38,
    tempoMultiplier: 1.12,
    filterExtra: "flanger=delay=1.2:depth=2:regen=0:width=71:speed=0.6:shape=sine,treble=g=4:f=3500",
  },
  "ai-funny-female": {
    pitchMultiplier: 1.38,
    tempoMultiplier: 1.12,
    filterExtra: "flanger=delay=1.2:depth=2:regen=0:width=71:speed=0.6:shape=sine,treble=g=4:f=3500",
  },
  AINeuralMale: {
    pitchMultiplier: 0.94,
    tempoMultiplier: 1.00,
    filterExtra: "chorus=0.6:0.9:50:0.3:0.25:2,treble=g=2:f=3000",
  },
  "ai-neural-male": {
    pitchMultiplier: 0.94,
    tempoMultiplier: 1.00,
    filterExtra: "chorus=0.6:0.9:50:0.3:0.25:2,treble=g=2:f=3000",
  },
  AINeuralFemale: {
    pitchMultiplier: 1.12,
    tempoMultiplier: 1.02,
    filterExtra: "chorus=0.6:0.9:45:0.3:0.25:2,treble=g=3:f=3200",
  },
  "ai-neural-female": {
    pitchMultiplier: 1.12,
    tempoMultiplier: 1.02,
    filterExtra: "chorus=0.6:0.9:45:0.3:0.25:2,treble=g=3:f=3200",
  },
  SoftGirlKids: {
    pitchMultiplier: 1.09,
    tempoMultiplier: 0.91,
    filterExtra: "equalizer=f=1100:t=q:w=1.2:g=1.5,treble=g=1.5:f=3800,bass=g=1.5:f=180",
  },
  "soft-girl-kids-explainer": {
    pitchMultiplier: 1.09,
    tempoMultiplier: 0.91,
    filterExtra: "equalizer=f=1100:t=q:w=1.2:g=1.5,treble=g=1.5:f=3800,bass=g=1.5:f=180",
  },
  "soft-girl-kids": {
    pitchMultiplier: 1.09,
    tempoMultiplier: 0.91,
    filterExtra: "equalizer=f=1100:t=q:w=1.2:g=1.5,treble=g=1.5:f=3800,bass=g=1.5:f=180",
  },
};

// Split raw script or speech text into manageable chunks
export function splitTextIntoChunks(text: string, maxLen: number = 180): string[] {
  // Clean markdown tags & natural tags
  const cleaned = text
    .replace(/\[\/?emphasis\]/gi, " ")
    .replace(/\[short-pause\]/gi, ", ")
    .replace(/\[long-pause\]/gi, "... ")
    .replace(/\[pause\]/gi, "... ")
    .replace(/\[breath\]/gi, "... ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if ((current + " " + s).trim().length <= maxLen) {
      current = (current + " " + s).trim();
    } else {
      if (current) chunks.push(current);
      if (s.length <= maxLen) {
        current = s;
      } else {
        // Break sentence on commas or clauses
        const parts = s.split(/([,;:]\s*)/);
        let partChunk = "";
        for (const p of parts) {
          if ((partChunk + p).length <= maxLen) {
            partChunk += p;
          } else {
            if (partChunk.trim()) chunks.push(partChunk.trim());
            partChunk = p;
          }
        }
        current = partChunk.trim();
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [cleaned.slice(0, maxLen)];
}

// Fetch single speech segment audio buffer
async function fetchSpeechAudioChunk(text: string, lang: string = "en"): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
    lang
  )}&client=tw-ob&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Speech service request failed with HTTP ${response.status}`);
  }

  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
}

// Synthesize single speaker speech via high-fidelity acoustic engine
export async function synthesizeAcousticSpeech(
  text: string,
  voice: string = "Kore",
  sampleRate: number = 24000,
  languageOverride?: string
): Promise<{ wavBuffer: Buffer; durationSec: number }> {
  const lang = languageOverride || detectLanguage(text);
  const chunks = splitTextIntoChunks(text);
  if (chunks.length === 0) {
    throw new Error("No pronounceable text provided for synthesis.");
  }

  // Fetch all speech audio segments in order with correct language code
  const audioBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    const buf = await fetchSpeechAudioChunk(chunk, lang);
    audioBuffers.push(buf);
  }

  const combinedMp3 = Buffer.concat(audioBuffers);

  // Get voice profile
  const profile = VOICE_PROFILES[voice] || VOICE_PROFILES["Kore"] || {
    pitchMultiplier: 1.0,
    tempoMultiplier: 1.0,
    filterExtra: "",
  };

  const sampleRateShift = Math.round(sampleRate * profile.pitchMultiplier);
  const tempoAdjustment = (1 / profile.pitchMultiplier) * profile.tempoMultiplier;

  // Build audio filter chain
  const filters: string[] = [];
  filters.push(`asetrate=${sampleRateShift}`);
  if (Math.abs(tempoAdjustment - 1.0) > 0.02) {
    filters.push(`atempo=${tempoAdjustment.toFixed(4)}`);
  }
  if (profile.filterExtra) {
    filters.push(profile.filterExtra);
  }

  const filterString = filters.join(",");

  const ffmpegArgs = [
    "-i",
    "pipe:0",
    "-af",
    filterString,
    "-ar",
    String(sampleRate),
    "-ac",
    "1",
    "-f",
    "wav",
    "pipe:1",
  ];

  try {
    const ffmpeg = await spawnFfmpeg(ffmpegArgs, { timeoutMs: 35000 });
    return await new Promise<{ wavBuffer: Buffer; durationSec: number }>((resolve, reject) => {
      const wavChunks: Buffer[] = [];
      let stderr = "";

      ffmpeg.stdout.on("data", (chunk) => wavChunks.push(chunk));
      ffmpeg.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          console.error(`[FFmpeg Execution Failure] exit code ${code}: ${stderr.slice(-300)}`);
          return reject(
            new Error(`Audio processing error (code ${code}): ${stderr.slice(-200)}`)
          );
        }
        const wavBuffer = Buffer.concat(wavChunks);
        if (wavBuffer.length < 44) {
          return reject(new Error("Audio synthesis generated empty or invalid WAV stream."));
        }
        // WAV header is 44 bytes, 16-bit mono is 2 bytes per sample
        const dataBytes = Math.max(0, wavBuffer.length - 44);
        const durationSec = Number((dataBytes / (sampleRate * 2)).toFixed(2));
        resolve({ wavBuffer, durationSec });
      });

      ffmpeg.on("error", (err: any) => {
        console.error(`[FFmpeg Process Error]:`, err);
        const formatted = formatFfmpegError(err);
        reject(new Error(formatted));
      });

      ffmpeg.stdin.on("error", (err: any) => {
        console.warn(`[FFmpeg stdin stream warning]: ${err.message}`);
      });

      ffmpeg.stdin.write(combinedMp3);
      ffmpeg.stdin.end();
    });
  } catch (error: any) {
    console.error("[Acoustic Synthesis Error]:", error);
    const clean = formatFfmpegError(error);
    throw new Error(clean);
  }
}

// Generate silent WAV buffer of specified milliseconds
export function generateSilencePcm(durationMs: number, sampleRate: number = 24000): Buffer {
  const numSamples = Math.round((sampleRate * durationMs) / 1000);
  return Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample (all zeros = silence)
}

// Synthesize multi-speaker conversation via high-fidelity acoustic engine
export async function synthesizeAcousticDialogue(
  dialogue: Array<{ speaker: string; text: string; voice?: string }>,
  sampleRate: number = 24000
): Promise<{ wavBuffer: Buffer; durationSec: number }> {
  if (!Array.isArray(dialogue) || dialogue.length === 0) {
    throw new Error("Dialogue list is empty.");
  }

  const turnPcmBuffers: Buffer[] = [];
  const pauseBetweenTurns = generateSilencePcm(350, sampleRate); // 350ms pause

  for (let i = 0; i < dialogue.length; i++) {
    const line = dialogue[i];
    if (!line.text?.trim()) continue;

    const vName = line.voice || (i % 2 === 0 ? "Kore" : "Puck");
    const { wavBuffer } = await synthesizeAcousticSpeech(line.text, vName, sampleRate);
    
    // Extract raw PCM (skip 44-byte WAV header)
    const pcm = wavBuffer.subarray(44);
    turnPcmBuffers.push(pcm);

    if (i < dialogue.length - 1) {
      turnPcmBuffers.push(pauseBetweenTurns);
    }
  }

  const combinedPcm = Buffer.concat(turnPcmBuffers);
  const wavBuffer = pcmToWav(combinedPcm, sampleRate, 1, 16);
  const durationSec = Number((combinedPcm.length / (sampleRate * 2)).toFixed(2));

  return { wavBuffer, durationSec };
}

// Global Cooldown Tracker for Gemini TTS Quota / Rate Limits
let geminiTtsCooldownUntil = 0;

export function isGeminiTtsInCooldown(): boolean {
  return Date.now() < geminiTtsCooldownUntil;
}

export function parseRetryDelay(error: any): number {
  try {
    const raw = typeof error === "string" ? error : error?.message || JSON.stringify(error);
    const match = raw.match(/retry(?:Delay| in)?[:\s]+["']?(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  } catch {
    // ignore
  }
  return 60;
}

export function markGeminiTtsQuotaExceeded(retryDelaySeconds?: number): void {
  const cooldownSec = Math.max(30, retryDelaySeconds || 60);
  geminiTtsCooldownUntil = Date.now() + cooldownSec * 1000;
  console.log(`[TTS Engine] Gemini rate-limit reached. Switching seamlessly to High-Fidelity acoustic voice engine for ${cooldownSec}s.`);
}

export function resetGeminiTtsCooldown(): void {
  geminiTtsCooldownUntil = 0;
}

// Parse Gemini API and Audio processing errors cleanly into human-understandable messages
export function parseGeminiError(error: any): { isQuotaExceeded: boolean; cleanMessage: string } {
  const raw = String(error?.message || error || "");
  const isQuota =
    raw.includes("429") ||
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("quota") ||
    raw.includes("exceeded your current quota") ||
    raw.includes("GenerateRequestsPerDay");

  let cleanMessage = "An error occurred during speech synthesis.";

  if (
    raw.includes("ENOENT") ||
    raw.includes("spawn ffmpeg") ||
    raw.includes("ffmpeg: not found") ||
    raw.includes("FFmpeg is unavailable")
  ) {
    cleanMessage =
      "FFmpeg is unavailable on the server. Please check the FFmpeg installation and runtime PATH.";
  } else if (isQuota) {
    cleanMessage =
      "Gemini TTS Free Tier request quota has been reached (10 requests/day). High-Fidelity Speech Engine is now providing seamless voice synthesis.";
  } else {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) {
        cleanMessage = parsed.error.message;
      }
    } catch {
      cleanMessage = raw.length > 200 ? raw.slice(0, 200) + "..." : raw;
    }
  }

  return { isQuotaExceeded: isQuota, cleanMessage };
}
