import { GoogleGenAI } from "@google/genai";

export interface TranscriptionRequestOptions {
  audioData: string; // base64 WAV (16kHz mono)
  mimeType?: string;
  fileName?: string;
  chunkIndex: number;
  totalChunks: number;
  chunkStartSec: number;
  chunkDurationSec: number;
  language?: string; // 'auto', 'en', 'ne', 'hi', or name
  detectSpeakers?: boolean;
  speakerCount?: number | "auto";
  detectAudioEvents?: boolean;
  cleanTranscript?: boolean;
  wordTimestamps?: boolean;
  keyTerms?: string;
  previousContext?: string;
}

export interface WordTimestampResult {
  word: string;
  startSec: number;
  endSec: number;
  confidence?: number;
}

export interface AudioEventResult {
  type: string;
  label: string;
  startSec: number;
  endSec: number;
}

export interface SegmentResult {
  id: string;
  startSec: number;
  endSec: number;
  timestamp: string;
  speaker: string;
  text: string;
  language?: string;
  words?: WordTimestampResult[];
  events?: AudioEventResult[];
}

export interface ChunkTranscriptionResult {
  chunkIndex: number;
  totalChunks: number;
  detectedLanguage: string;
  detectedLanguages: string[];
  speakers: string[];
  segments: SegmentResult[];
  chunkSummary: string;
  speechDetected: boolean;
  providerUsed: string;
}

/**
 * Format seconds to HH:MM:SS or MM:SS
 */
function formatTimeStr(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export interface ITranscriptionProvider {
  name: string;
  transcribeChunk(
    ai: GoogleGenAI,
    options: TranscriptionRequestOptions
  ): Promise<ChunkTranscriptionResult>;
}

/**
 * Primary High-Accuracy Provider (Gemini 3.7 Flash)
 */
export class PrimaryGeminiProvider implements ITranscriptionProvider {
  name = "gemini-3.7-flash";

  async transcribeChunk(
    ai: GoogleGenAI,
    options: TranscriptionRequestOptions
  ): Promise<ChunkTranscriptionResult> {
    const {
      audioData,
      mimeType = "audio/wav",
      chunkIndex,
      totalChunks,
      chunkStartSec,
      chunkDurationSec,
      language = "auto",
      detectSpeakers = true,
      speakerCount = "auto",
      detectAudioEvents = true,
      cleanTranscript = true,
      wordTimestamps = true,
      keyTerms = "",
      previousContext = "",
    } = options;

    const languageDirective =
      language && language.toLowerCase() !== "auto"
        ? `PRIMARY LANGUAGE TARGET: ${language}. Listen specifically for this language and accurately capture spoken dialogue.`
        : `LANGUAGE DETECTION: Auto-detect the spoken language(s). Accurately identify transitions and code-switching.`;

    const keyTermsDirective = keyTerms && keyTerms.trim().length > 0
      ? `IMPORTANT CUSTOM VOCABULARY & KEY TERMS:\nPrioritize recognition of these names, brands, technical terms, or jargon:\n"${keyTerms.trim()}"`
      : "";

    const contextDirective = previousContext && previousContext.trim().length > 0
      ? `PREVIOUS DIALOGUE CONTEXT (for continuity of speakers & terminology):\n"${previousContext.slice(0, 400)}"`
      : "";

    const speakerDirective = detectSpeakers
      ? `SPEAKER DIARIZATION: Detect distinct speakers (e.g. "Speaker 1", "Speaker 2", or named hosts/guests). ${
          typeof speakerCount === "number" ? `Estimated speaker count: ${speakerCount}.` : ""
        }`
      : `SPEAKER DETECTION: Assign all speech to "Speaker 1".`;

    const audioEventDirective = detectAudioEvents
      ? `AUDIO EVENT DETECTION: When distinct sound events occur (e.g. laughter, applause, music, door closing, background noise), tag them in brackets or in the events array (e.g. "[laughter]", "[applause]", "[music]"). Do not confuse sound events with spoken words.`
      : `AUDIO EVENTS: Focus only on spoken vocal speech.`;

    const wordTimestampsDirective = wordTimestamps
      ? `WORD-LEVEL TIMESTAMPS: For each segment, output the array of words with "relStartSec" and "relEndSec" (relative to chunk start 0.0s to ${chunkDurationSec.toFixed(1)}s).`
      : `WORD-LEVEL TIMESTAMPS: Not required.`;

    const cleanDirective = cleanTranscript
      ? `TEXT FORMATTING: Automatically apply correct capitalization, punctuation (periods, question marks, commas), and natural sentence boundaries without altering the speaker's original words or meaning.`
      : `TEXT FORMATTING: Keep verbatim formatting.`;

    const promptText = `You are a world-class production speech-to-text AI engine.
Transcribe all vocal speech from the provided audio recording with maximum accuracy.

${languageDirective}
${keyTermsDirective}
${contextDirective}
${speakerDirective}
${audioEventDirective}
${wordTimestampsDirective}
${cleanDirective}

CRITICAL LANGUAGE & ACCURACY MANDATES:
1. NEPALI (नेपाली):
   - Treat Nepali as a first-class language.
   - When Nepali is spoken, transcribe in authentic Devanagari script Unicode (e.g., "नमस्कार सबैलाई, आज हामी आर्टिफिसियल इन्टेलिजेन्सको बारेमा कुरा गर्नेछौं।").
   - Do NOT force English or convert Nepali into Romanized script unless the speaker was explicitly speaking Romanized colloquial words.
2. HINDI (हिन्दी):
   - Treat Hindi as a first-class language.
   - When Hindi is spoken, transcribe in authentic Devanagari script (e.g., "नमस्ते दोस्तों, आज हम AI के बारे में बात करेंगे।").
   - Do NOT output unnecessary English transliteration.
3. CODE-SWITCHING & MIXED LANGUAGE:
   - Handle bilingual and mixed-language speech (Hinglish, Nepali + English, etc.) naturally, keeping English technical terms in English and Devanagari words in Devanagari (e.g. "आज हामी artificial intelligence को बारेमा कुरा गर्नेछौं।").
4. ACCENTS & NOISE:
   - Accurately transcribe accented speech (Indian, Nepali, British, American, etc.), low-volume voices, background noise, or background music.
5. NO HALLUCINATIONS:
   - Only transcribe words that were actually spoken. If no words were spoken in a section, do NOT invent text.

Return strictly valid JSON matching this schema:
{
  "detectedLanguage": "Main detected language (e.g. Nepali, Hindi, English, Hinglish, Nepali + English)",
  "detectedLanguages": ["Nepali", "English"],
  "speakers": ["Speaker 1", "Speaker 2"],
  "segments": [
    {
      "relStartSec": 0.0,
      "relEndSec": 4.5,
      "speaker": "Speaker 1",
      "text": "Transcribed spoken sentence.",
      "language": "Nepali",
      "words": [
        { "word": "नमस्कार", "relStartSec": 0.0, "relEndSec": 0.8 },
        { "word": "सबैलाई", "relStartSec": 0.9, "relEndSec": 1.4 }
      ],
      "events": [
        { "type": "music", "label": "[music]", "relStartSec": 0.0, "relEndSec": 1.0 }
      ]
    }
  ],
  "chunkSummary": "One brief sentence summarizing the spoken content"
}`;

    const response = await ai.models.generateContent({
      model: this.name,
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioData,
              },
            },
            { text: promptText },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Failed to parse JSON response from primary transcription provider.");
    }

    const rawSegments = Array.isArray(parsed?.segments) ? parsed.segments : [];
    const absoluteSegments: SegmentResult[] = rawSegments
      .map((seg: any, idx: number) => {
        const relStart = typeof seg.relStartSec === "number" ? seg.relStartSec : idx * 3;
        const relEnd = typeof seg.relEndSec === "number" ? seg.relEndSec : relStart + 3;
        const absStart = Number((chunkStartSec + Math.max(0, relStart)).toFixed(2));
        const absEnd = Number((chunkStartSec + Math.max(relStart + 0.3, relEnd)).toFixed(2));

        const words: WordTimestampResult[] = Array.isArray(seg.words)
          ? seg.words.map((w: any) => ({
              word: String(w.word || "").trim(),
              startSec: Number((chunkStartSec + (typeof w.relStartSec === "number" ? w.relStartSec : relStart)).toFixed(2)),
              endSec: Number((chunkStartSec + (typeof w.relEndSec === "number" ? w.relEndSec : relEnd)).toFixed(2)),
            })).filter((w: any) => w.word.length > 0)
          : [];

        const events: AudioEventResult[] = Array.isArray(seg.events)
          ? seg.events.map((e: any) => ({
              type: String(e.type || "event"),
              label: String(e.label || `[${e.type || "event"}]`),
              startSec: Number((chunkStartSec + (typeof e.relStartSec === "number" ? e.relStartSec : relStart)).toFixed(2)),
              endSec: Number((chunkStartSec + (typeof e.relEndSec === "number" ? e.relEndSec : relEnd)).toFixed(2)),
            }))
          : [];

        return {
          id: `chunk_${chunkIndex}_seg_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          startSec: absStart,
          endSec: absEnd,
          timestamp: formatTimeStr(absStart),
          speaker: String(seg.speaker || (detectSpeakers ? `Speaker 1` : "Speaker")).trim(),
          text: String(seg.text || "").trim(),
          language: String(seg.language || parsed?.detectedLanguage || "Auto"),
          words: words.length > 0 ? words : undefined,
          events: events.length > 0 ? events : undefined,
        };
      })
      .filter((s: SegmentResult) => s.text.length > 0);

    return {
      chunkIndex,
      totalChunks,
      detectedLanguage: parsed?.detectedLanguage || language || "Auto-detected",
      detectedLanguages: Array.isArray(parsed?.detectedLanguages)
        ? parsed.detectedLanguages
        : [parsed?.detectedLanguage || language || "Auto-detected"],
      speakers: Array.isArray(parsed?.speakers) ? parsed.speakers : ["Speaker 1"],
      segments: absoluteSegments,
      chunkSummary: parsed?.chunkSummary || "",
      speechDetected: absoluteSegments.length > 0,
      providerUsed: this.name,
    };
  }
}

/**
 * Secondary Fallback High-Fidelity Provider (Gemini 2.5 Flash)
 */
export class FallbackGeminiProvider implements ITranscriptionProvider {
  name = "gemini-2.5-flash";

  async transcribeChunk(
    ai: GoogleGenAI,
    options: TranscriptionRequestOptions
  ): Promise<ChunkTranscriptionResult> {
    const {
      audioData,
      mimeType = "audio/wav",
      chunkIndex,
      totalChunks,
      chunkStartSec,
      chunkDurationSec,
      language = "auto",
      detectSpeakers = true,
      keyTerms = "",
    } = options;

    const fallbackPrompt = `There is vocal dialogue in this audio recording. Listen closely to any speech, words, sentences, or greetings.
Accurately transcribe all spoken words into dialogue segments with timestamps.
If spoken in Nepali or Hindi, write in authentic Devanagari script.
${keyTerms ? `Custom key terms to watch for: ${keyTerms}` : ""}

Return valid JSON:
{
  "detectedLanguage": "Language",
  "speakers": ["Speaker 1"],
  "segments": [
    {
      "relStartSec": 0.0,
      "relEndSec": 4.0,
      "speaker": "Speaker 1",
      "text": "Transcribed speech",
      "language": "${language || "Auto"}",
      "words": [
        { "word": "Transcribed", "relStartSec": 0.0, "relEndSec": 2.0 },
        { "word": "speech", "relStartSec": 2.1, "relEndSec": 4.0 }
      ]
    }
  ],
  "chunkSummary": "Brief overview"
}`;

    const resp = await ai.models.generateContent({
      model: this.name,
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: audioData } },
            { text: fallbackPrompt },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const rawSegments = Array.isArray(parsed?.segments) ? parsed.segments : [];
    const absoluteSegments: SegmentResult[] = rawSegments
      .map((seg: any, idx: number) => {
        const relStart = typeof seg.relStartSec === "number" ? seg.relStartSec : idx * 3;
        const relEnd = typeof seg.relEndSec === "number" ? seg.relEndSec : relStart + 3;
        const absStart = Number((chunkStartSec + Math.max(0, relStart)).toFixed(2));
        const absEnd = Number((chunkStartSec + Math.max(relStart + 0.3, relEnd)).toFixed(2));

        const words: WordTimestampResult[] = Array.isArray(seg.words)
          ? seg.words.map((w: any) => ({
              word: String(w.word || "").trim(),
              startSec: Number((chunkStartSec + (typeof w.relStartSec === "number" ? w.relStartSec : relStart)).toFixed(2)),
              endSec: Number((chunkStartSec + (typeof w.relEndSec === "number" ? w.relEndSec : relEnd)).toFixed(2)),
            })).filter((w: any) => w.word.length > 0)
          : [];

        return {
          id: `chunk_${chunkIndex}_seg_${idx}_${Date.now()}_fallback`,
          startSec: absStart,
          endSec: absEnd,
          timestamp: formatTimeStr(absStart),
          speaker: String(seg.speaker || (detectSpeakers ? `Speaker 1` : "Speaker")).trim(),
          text: String(seg.text || "").trim(),
          language: String(seg.language || parsed?.detectedLanguage || "Auto"),
          words: words.length > 0 ? words : undefined,
        };
      })
      .filter((s: SegmentResult) => s.text.length > 0);

    return {
      chunkIndex,
      totalChunks,
      detectedLanguage: parsed?.detectedLanguage || language || "Auto-detected",
      detectedLanguages: Array.isArray(parsed?.detectedLanguages)
        ? parsed.detectedLanguages
        : [parsed?.detectedLanguage || language || "Auto-detected"],
      speakers: Array.isArray(parsed?.speakers) ? parsed.speakers : ["Speaker 1"],
      segments: absoluteSegments,
      chunkSummary: parsed?.chunkSummary || "",
      speechDetected: absoluteSegments.length > 0,
      providerUsed: this.name,
    };
  }
}

/**
 * Multi-Provider Service Orchestrator
 * Allows seamless switching, primary -> fallback escalation, and future provider expansion
 */
export class TranscriptionService {
  private primary: ITranscriptionProvider;
  private fallback: ITranscriptionProvider;

  constructor() {
    this.primary = new PrimaryGeminiProvider();
    this.fallback = new FallbackGeminiProvider();
  }

  async transcribeChunk(
    ai: GoogleGenAI,
    options: TranscriptionRequestOptions
  ): Promise<ChunkTranscriptionResult> {
    try {
      console.log(
        `[TranscriptionService] Invoking primary provider (${this.primary.name}) for Chunk ${options.chunkIndex + 1}/${options.totalChunks}...`
      );
      const result = await this.primary.transcribeChunk(ai, options);
      if (result.segments.length > 0) {
        return result;
      }
      console.warn(
        `[TranscriptionService] Primary provider returned 0 segments. Escalating to fallback provider (${this.fallback.name})...`
      );
    } catch (primaryErr: any) {
      console.warn(
        `[TranscriptionService] Primary provider failed: ${primaryErr.message}. Escalating to fallback (${this.fallback.name})...`
      );
    }

    // Try fallback
    try {
      const fallbackResult = await this.fallback.transcribeChunk(ai, options);
      return fallbackResult;
    } catch (fallbackErr: any) {
      console.error(`[TranscriptionService] Fallback provider also failed:`, fallbackErr);
      throw new Error(`Speech transcription failed across all providers: ${fallbackErr.message}`);
    }
  }
}

export const defaultTranscriptionService = new TranscriptionService();
