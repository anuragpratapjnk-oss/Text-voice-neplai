import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import {
  authenticateUser,
  verifyAuthToken,
  changeUserPassword,
  createAdditionalUser,
  requireAuthMiddleware,
} from "./server/auth";
import {
  processMediaFileForTranscription,
  processVideoFileForTranscription,
  probeMedia,
  analyzeAudioVolume,
} from "./server/mediaAudioService";
import { defaultTranscriptionService } from "./server/transcriptionService";
import {
  mapToGeminiVoice,
  synthesizeAcousticSpeech,
  synthesizeAcousticDialogue,
  parseGeminiError,
  isGeminiTtsInCooldown,
  markGeminiTtsQuotaExceeded,
  parseRetryDelay,
  resetGeminiTtsCooldown,
} from "./server/ttsSynthesisService";
import { detectFfmpeg, detectFfprobe } from "./server/ffmpegResolver";

dotenv.config();

function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitDepth: number = 16): Buffer {
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
  // sample format (raw PCM = 1)
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

async function startServer() {
  console.log("[Server Startup] Verifying FFmpeg and media runtime tools...");
  await detectFfmpeg();
  await detectFfprobe();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // Ensure upload directory exists for temporary video extraction
  const videoUploadsDir = path.join(os.tmpdir(), "video_uploads");
  try {
    fs.mkdirSync(videoUploadsDir, { recursive: true });
  } catch {}

  const upload = multer({
    dest: videoUploadsDir,
    limits: {
      fileSize: 1024 * 1024 * 1000, // 1GB
    },
  });

  // Shared Gemini client
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // Resilient Gemini generateContent helper with backoff and multi-model fallbacks
  const generateWithFallback = async (
    ai: ReturnType<typeof getGeminiClient>,
    params: {
      primaryModel?: string;
      fallbackModels?: string[];
      contents: any[];
      config?: any;
    }
  ) => {
    const candidateModels = [
      params.primaryModel || "gemini-3.7-flash",
      ...(params.fallbackModels || ["gemini-2.5-flash"]),
    ];

    let lastError: any = null;

    for (const model of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((res) => setTimeout(res, 1000 * attempt));
          }
          const response = await ai.models.generateContent({
            model,
            contents: params.contents,
            config: params.config,
          });
          return response;
        } catch (err: any) {
          lastError = err;
          const msg = String(err?.message || "");
          const status = String(err?.status || err?.code || "");
          console.warn(`[Gemini API] Call to ${model} (attempt ${attempt + 1}) failed: ${msg}`);

          const isOverloadedOrRateLimited =
            msg.includes("503") ||
            msg.includes("UNAVAILABLE") ||
            msg.includes("high demand") ||
            msg.includes("429") ||
            msg.includes("RESOURCE_EXHAUSTED") ||
            status.includes("503") ||
            status.includes("429");

          if (!isOverloadedOrRateLimited) {
            // Non-transient error; break out to try next fallback model
            break;
          }
        }
      }
    }

    throw lastError || new Error("All Gemini model requests failed.");
  };

  // Health check with FFmpeg availability detection
  app.get("/api/health", async (_req, res) => {
    const ffmpegInfo = await detectFfmpeg();
    const ffprobeInfo = await detectFfprobe();
    res.json({
      status: "ok",
      hasApiKey: !!process.env.GEMINI_API_KEY,
      model: "gemini-3.1-flash-tts-preview",
      ffmpeg: {
        available: ffmpegInfo.available,
        version: ffmpegInfo.version,
        source: ffmpegInfo.source,
      },
      ffprobe: {
        available: ffprobeInfo.available,
        version: ffprobeInfo.version,
        source: ffprobeInfo.source,
      },
    });
  });

  // ==========================================
  // Authentication Routes
  // ==========================================

  // Login endpoint
  app.post("/api/auth/login", (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
      }

      const result = authenticateUser(username, password);
      if (result.error || !result.user) {
        return res.status(401).json({ error: result.error || "Invalid username or password." });
      }

      res.json({
        success: true,
        token: result.token,
        user: result.user,
      });
    } catch (error: any) {
      console.error("Login Error:", error);
      res.status(500).json({ error: "An unexpected server error occurred during login." });
    }
  });

  // Verify session / Me endpoint
  app.get("/api/auth/me", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authentication token provided.", authenticated: false });
    }

    const token = authHeader.split(" ")[1];
    const result = verifyAuthToken(token);

    if (!result.valid || !result.user) {
      return res.status(401).json({ error: result.error || "Session expired or invalid.", authenticated: false });
    }

    res.json({
      authenticated: true,
      user: result.user,
    });
  });

  // Logout endpoint
  app.post("/api/auth/logout", (_req, res) => {
    // JWT sessions are cleared client-side; server acknowledges
    res.json({ success: true, message: "Logged out successfully." });
  });

  // Change password endpoint (authenticated)
  app.post("/api/auth/change-password", requireAuthMiddleware, (req, res) => {
    try {
      const currentUser = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Both current and new password are required." });
      }

      const result = changeUserPassword(currentUser.id, currentPassword, newPassword);
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Could not change password." });
      }

      res.json({ success: true, message: "Password updated successfully." });
    } catch (error: any) {
      console.error("Change Password Error:", error);
      res.status(500).json({ error: "Failed to update password." });
    }
  });

  // Create additional user (for admin or registration)
  app.post("/api/auth/users", requireAuthMiddleware, (req, res) => {
    try {
      const currentUser = (req as any).user;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can create additional accounts." });
      }

      const { username, password, displayName, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
      }

      const result = createAdditionalUser(username, password, displayName, role || "user");
      if (!result.success || !result.user) {
        return res.status(400).json({ error: result.error || "Failed to create user." });
      }

      res.json({ success: true, user: result.user, message: `Account for ${result.user.username} created successfully.` });
    } catch (error: any) {
      console.error("Create User Error:", error);
      res.status(500).json({ error: "Failed to create account." });
    }
  });

  // Helper to extract audio inlineData from any candidate or part
  function extractAudioInlineData(response: any): { data: string; mimeType?: string } | null {
    if (!response?.candidates || !Array.isArray(response.candidates)) return null;
    for (const candidate of response.candidates) {
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part?.inlineData?.data) {
            return part.inlineData;
          }
        }
      }
    }
    return null;
  }

  // In-memory cache for fast voice auditions
  const voicePreviewCache = new Map<string, { audioData: string; durationEstimateSec: number }>();

  // Voice Preview Audition endpoint (Protected)
  app.post("/api/voice-preview", requireAuthMiddleware, async (req, res) => {
    try {
      const { voice = "Kore", sampleText } = req.body;
      const actualGeminiVoice = mapToGeminiVoice(voice);
      let prompt = "";
      let rawText = sampleText || "";

      if (voice === "SoftGirlKids" || voice === "soft-girl-kids-explainer" || voice === "soft-girl-kids" || (voice && (voice.toLowerCase().includes("soft girl") || voice.toLowerCase().includes("kids explainer")))) {
        rawText = sampleText || "Hi there! 🌸 Are you ready to learn something amazing today? Let’s explore it together! Don’t worry if it seems difficult at first. I’ll explain everything slowly and simply, so you can understand and have fun while learning. Let’s get started!";
        prompt = `Speak as a gentle, warm, soft, and friendly young female educational narrator and teacher explaining something to a child. Speak at a moderate, slightly slower pace with crystal clarity, gentle natural pauses between sentences, and comforting, patient warmth. Avoid shouting, dramatic delivery, or babyish exaggeration: ${rawText}`;
      } else if (voice === "AICartoonMale" || voice === "ai-cartoon-male") {
        rawText = sampleText || "Maaaa... AI hoooon... REEE! Me hu Noodles re! 🍜";
        prompt = `Speak as a funny, exaggerated cartoon AI character for viral shorts. Use a high-pitched, energetic, slightly nasal cartoon voice with sudden pitch jumps, exaggerated stretched vowels, 0.2s comedic pauses between short phrases, and a goofy, confident meme delivery: ${rawText}`;
      } else if (voice === "AICartoonFemale" || voice === "ai-cartoon-female") {
        rawText = sampleText || "MAAAIN... NOODLES... HOOOON REEEE! 🤖✨";
        prompt = `Speak as a tiny, energetic, funny cartoon AI robot character. Deliver in a cute, high-pitched, quirky synthetic voice with exaggerated stretched syllables, unexpected comedic emphasis, short punchy pauses, and hilarious cartoon Shorts meme delivery: ${rawText}`;
      } else if (voice === "AIFunnyMale" || voice === "ai-funny-male") {
        rawText = sampleText || "Ma AI hu re! Tapai ko lagi bolna ready chu!";
        prompt = `Say playfully in a funny, quirky, and slightly robotic voice with exaggerated pauses: ${rawText}`;
      } else if (voice === "AIFunnyFemale" || voice === "ai-funny-female") {
        rawText = sampleText || "Ma AI hu re! Tapai ko lagi bolna ready chu!";
        prompt = `Say playfully in a funny, energetic, high-pitched robotic voice with quirky pauses: ${rawText}`;
      } else if (voice === "AINeuralMale" || voice === "ai-neural-male") {
        rawText = sampleText || "Hello, I’m your AI voice assistant. This is a preview of my neural voice.";
        prompt = `Say in a deep, clean, confident, futuristic, and slightly robotic tone: ${rawText}`;
      } else if (voice === "AINeuralFemale" || voice === "ai-neural-female") {
        rawText = sampleText || "Hello, I’m your AI voice assistant. This is a preview of my neural voice.";
        prompt = `Say in a clear, smooth, intelligent, futuristic, and slightly robotic tone: ${rawText}`;
      } else {
        const previewText = sampleText || `Hi Anurag, I am ${voice}. This is a preview of my natural voice.`;
        prompt = `Say with natural conversational warmth and clear friendly inflection: ${previewText}`;
        rawText = previewText;
      }

      const cacheKey = `${voice}:${rawText}`;

      if (voicePreviewCache.has(cacheKey)) {
        const cached = voicePreviewCache.get(cacheKey)!;
        return res.json({
          success: true,
          audioData: cached.audioData,
          voice,
          durationEstimateSec: cached.durationEstimateSec,
          cached: true,
        });
      }

      let wavBase64 = "";
      let durationEstimateSec = 0;
      let usedFallback = false;

      // 1. Attempt Gemini 3.1 Flash TTS preview if not in rate-limit cooldown
      if (!isGeminiTtsInCooldown()) {
        try {
          const ai = getGeminiClient();
          let response = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: actualGeminiVoice },
                },
              },
            },
          });

          let audioPart = extractAudioInlineData(response);

          if (!audioPart || !audioPart.data) {
            response = await ai.models.generateContent({
              model: "gemini-3.1-flash-tts-preview",
              contents: [{ parts: [{ text: rawText }] }],
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: actualGeminiVoice },
                  },
                },
              },
            });
            audioPart = extractAudioInlineData(response);
          }

          if (audioPart?.data) {
            const rawPcmBuffer = Buffer.from(audioPart.data, "base64");
            const wavBuffer = pcmToWav(rawPcmBuffer, 24000, 1, 16);
            wavBase64 = wavBuffer.toString("base64");
            durationEstimateSec = Number((rawPcmBuffer.length / (24000 * 2)).toFixed(2));
            resetGeminiTtsCooldown();
          }
        } catch (geminiErr: any) {
          const { isQuotaExceeded } = parseGeminiError(geminiErr);
          if (isQuotaExceeded) {
            markGeminiTtsQuotaExceeded(parseRetryDelay(geminiErr));
          }
        }
      }

      // 2. Resilient fallback: high-fidelity acoustic voice engine
      if (!wavBase64) {
        usedFallback = true;
        const acoustic = await synthesizeAcousticSpeech(rawText, voice, 24000);
        wavBase64 = acoustic.wavBuffer.toString("base64");
        durationEstimateSec = acoustic.durationSec;
      }

      voicePreviewCache.set(cacheKey, {
        audioData: wavBase64,
        durationEstimateSec,
      });

      return res.json({
        success: true,
        audioData: wavBase64,
        voice,
        durationEstimateSec,
        cached: false,
        isFallback: usedFallback,
      });
    } catch (error: any) {
      console.error("Voice Preview Error:", error);
      const parsed = parseGeminiError(error);
      res.status(500).json({
        error: parsed.cleanMessage || "Failed to generate character voice preview.",
      });
    }
  });

  // TTS generation endpoint (Protected)
  app.post("/api/tts", requireAuthMiddleware, async (req, res) => {
    try {
      const {
        text,
        voice = "Kore",
        style = "neutral",
        customStylePrompt = "",
        mode = "single",
        dialogue = [],
        naturalnessMode = "lifelike",
      } = req.body;

      if (!text && (!dialogue || dialogue.length === 0)) {
        return res.status(400).json({ error: "Text or dialogue is required" });
      }

      const cleanNaturalText = (input: string) => {
        return input
          .replace(/\[pause\]/gi, "... ")
          .replace(/\[short-pause\]/gi, ", ")
          .replace(/\[long-pause\]/gi, "..... ")
          .replace(/\[breath\]/gi, " (takes gentle breath)... ")
          .replace(/\[emphasis\]/gi, " *")
          .replace(/\[\/emphasis\]/gi, "* ");
      };

      let wavBase64 = "";
      let durationEstimateSec = 0;
      let usedFallback = false;
      let provider = "gemini-3.1-flash-tts-preview";

      if (mode === "dialogue" && Array.isArray(dialogue) && dialogue.length > 0) {
        // Multi-speaker dialogue mode
        const validLines = dialogue.filter((d: any) => d?.text?.trim());
        if (validLines.length === 0) {
          return res.status(400).json({ error: "No dialogue text provided." });
        }

        // 1. Try Gemini 3.1 Flash TTS multi-speaker first if not in rate-limit cooldown
        if (!isGeminiTtsInCooldown()) {
          try {
            const speakers = Array.from(new Set(validLines.map((d: any) => d.speaker || "Speaker"))).slice(0, 2);
            const dialogueLines = validLines
              .map((d: any) => `${d.speaker}: ${cleanNaturalText(d.text)}`)
              .join("\n");
            const promptContent = `TTS the following conversation between ${speakers.join(" and ")}:\n${dialogueLines}`;

            const speakerVoiceConfigs = speakers.map((spk, idx) => {
              const item = validLines.find((d: any) => d.speaker === spk);
              const vName = mapToGeminiVoice(item?.voice || (idx === 0 ? "Kore" : "Puck"));
              return {
                speaker: spk,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: vName },
                },
              };
            });

            if (speakerVoiceConfigs.length === 1) {
              speakerVoiceConfigs.push({
                speaker: "Narrator",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Puck" },
                },
              });
            }

            const ai = getGeminiClient();
            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-tts-preview",
              contents: [{ parts: [{ text: promptContent }] }],
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: speakerVoiceConfigs.slice(0, 2),
                  },
                },
              },
            });

            const audioPart = extractAudioInlineData(response);
            if (audioPart?.data) {
              const rawPcmBuffer = Buffer.from(audioPart.data, "base64");
              const wavBuffer = pcmToWav(rawPcmBuffer, 24000, 1, 16);
              wavBase64 = wavBuffer.toString("base64");
              durationEstimateSec = Number((rawPcmBuffer.length / (24000 * 2)).toFixed(2));
              resetGeminiTtsCooldown();
            }
          } catch (dialogueErr: any) {
            const { isQuotaExceeded } = parseGeminiError(dialogueErr);
            if (isQuotaExceeded) {
              markGeminiTtsQuotaExceeded(parseRetryDelay(dialogueErr));
            }
          }
        }

        // 2. High-fidelity acoustic engine fallback for multi-speaker dialogue
        if (!wavBase64) {
          usedFallback = true;
          provider = "high-fidelity-acoustic";
          const acoustic = await synthesizeAcousticDialogue(validLines, 24000);
          wavBase64 = acoustic.wavBuffer.toString("base64");
          durationEstimateSec = acoustic.durationSec;
        }
      } else {
        // Single speaker mode
        const actualGeminiVoice = mapToGeminiVoice(voice);
        let styledText = cleanNaturalText((text || "").trim());

        let aiNeuralDirective = "";
        if (voice === "SoftGirlKids" || voice === "soft-girl-kids-explainer" || voice === "soft-girl-kids" || (voice && (voice.toLowerCase().includes("soft girl") || voice.toLowerCase().includes("kids explainer")))) {
          aiNeuralDirective = "Speak as a gentle, soft, warm, and friendly young female educational narrator and teacher explaining something to a child with crystal clarity, moderate and slightly slower pacing, natural pauses between sentences, and comforting patience without shouting, dramatic delivery, or babyish exaggeration";
        } else if (voice === "AICartoonMale" || voice === "ai-cartoon-male") {
          aiNeuralDirective = "Speak as a funny, exaggerated cartoon AI character for viral shorts with a high-pitched, quirky, slightly nasal tone, sudden pitch jumps, stretched vowels, 0.2 second comedic pauses between phrases, and an excited goofy meme delivery";
        } else if (voice === "AICartoonFemale" || voice === "ai-cartoon-female") {
          aiNeuralDirective = "Speak as a tiny, energetic, funny cartoon AI robot character with a cute high-pitched synthetic tone, exaggerated stretched syllables, sudden comedic pitch inflections, short punchy pauses, and a proudly artificial goofy personality";
        } else if (voice === "AIFunnyMale" || voice === "ai-funny-male") {
          aiNeuralDirective = "Speak as an obviously artificial, funny, playful, and quirky AI robot character with playful robotic pronunciation, exaggerated pitch inflections, quirky pauses between words, and a confident silly robotic personality";
        } else if (voice === "AIFunnyFemale" || voice === "ai-funny-female") {
          aiNeuralDirective = "Speak as an obviously artificial, funny, cute, and energetic female AI robot character with playful synthetic cadence, exaggerated pitch changes, quirky pauses, funny emphasis, and a goofy robot personality";
        } else if (voice === "AINeuralMale" || voice === "ai-neural-male") {
          aiNeuralDirective = "Speak as an advanced AI assistant in a deep, clean, confident, futuristic, and slightly robotic tone with smooth pacing and synthetic clarity";
        } else if (voice === "AINeuralFemale" || voice === "ai-neural-female") {
          aiNeuralDirective = "Speak as an advanced AI assistant in a clear, smooth, intelligent, futuristic, and slightly robotic tone with expressive synthetic clarity and modern pacing";
        }

        const stylePrompts: Record<string, string> = {
          neutral: !aiNeuralDirective && naturalnessMode === "lifelike" ? "Speak in a natural, authentic, and clear conversational tone" : "",
          cheerful: "Say cheerfully with genuine warmth and a friendly smile in your voice",
          whisper: "Whisper softly, intimately, and breathily with gentle close-mic nuance",
          excited: "Say with lively energy, spontaneous enthusiasm, and crisp excitement",
          dramatic: "Read dramatically with deep emotional cadence and cinematic weight",
          calm: "Speak in a serene, meditative, and deeply soothing calm voice",
          news_anchor: "Present like an articulate, authoritative, and poised professional broadcaster",
          storyteller: "Narrate as a captivating, expressive fairytale storyteller with natural timing",
        };

        const naturalnessPrefixMap: Record<string, string> = {
          lifelike: "Speak with natural human conversational pacing, subtle breathing pauses, and lifelike inflection",
          expressive: "Speak with deep emotional resonance, expressive cadence, and dynamic vocal coloration",
          storytelling: "Narrate naturally with engaging pacing, captivating pauses, and rich melodic warmth",
          casual: "Speak in a relaxed, friendly, everyday conversational style",
        };

        if (aiNeuralDirective) {
          if (customStylePrompt) {
            styledText = `${aiNeuralDirective}. ${customStylePrompt.trim()}: ${styledText}`;
          } else if (style && style !== "neutral" && stylePrompts[style]) {
            styledText = `${aiNeuralDirective}, ${stylePrompts[style].toLowerCase()}: ${styledText}`;
          } else {
            styledText = `${aiNeuralDirective}: ${styledText}`;
          }
        } else if (customStylePrompt) {
          styledText = `${customStylePrompt.trim()}: ${styledText}`;
        } else if (style && stylePrompts[style]) {
          const promptPrefix = stylePrompts[style];
          if (promptPrefix) {
            styledText = `${promptPrefix}: ${styledText}`;
          }
        } else if (naturalnessMode && naturalnessPrefixMap[naturalnessMode]) {
          styledText = `${naturalnessPrefixMap[naturalnessMode]}: ${styledText}`;
        }

        // 1. Try Gemini 3.1 Flash TTS first if not in rate-limit cooldown
        if (!isGeminiTtsInCooldown()) {
          try {
            const ai = getGeminiClient();
            let response = await ai.models.generateContent({
              model: "gemini-3.1-flash-tts-preview",
              contents: [{ parts: [{ text: styledText }] }],
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: actualGeminiVoice },
                  },
                },
              },
            });

            let audioPart = extractAudioInlineData(response);

            if (!audioPart || !audioPart.data) {
              const rawFallback = cleanNaturalText(text.trim());
              response = await ai.models.generateContent({
                model: "gemini-3.1-flash-tts-preview",
                contents: [{ parts: [{ text: rawFallback }] }],
                config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: actualGeminiVoice },
                    },
                  },
                },
              });
              audioPart = extractAudioInlineData(response);
            }

            if (audioPart?.data) {
              const rawPcmBuffer = Buffer.from(audioPart.data, "base64");
              const wavBuffer = pcmToWav(rawPcmBuffer, 24000, 1, 16);
              wavBase64 = wavBuffer.toString("base64");
              durationEstimateSec = Number((rawPcmBuffer.length / (24000 * 2)).toFixed(2));
              resetGeminiTtsCooldown();
            }
          } catch (singleErr: any) {
            const { isQuotaExceeded } = parseGeminiError(singleErr);
            if (isQuotaExceeded) {
              markGeminiTtsQuotaExceeded(parseRetryDelay(singleErr));
            }
          }
        }

        // 2. High-fidelity acoustic engine fallback for single speaker
        if (!wavBase64) {
          usedFallback = true;
          provider = "high-fidelity-acoustic";
          const acoustic = await synthesizeAcousticSpeech(styledText || text, voice, 24000);
          wavBase64 = acoustic.wavBuffer.toString("base64");
          durationEstimateSec = acoustic.durationSec;
        }
      }

      if (!wavBase64) {
        return res.status(500).json({ error: "Could not generate speech audio. Please check your text and retry." });
      }

      return res.json({
        success: true,
        audioData: wavBase64,
        mimeType: "audio/wav",
        sampleRate: 24000,
        durationEstimateSec,
        isFallback: usedFallback,
        provider,
        note: usedFallback
          ? "Synthesized using High-Fidelity Voice Engine (Gemini Free Tier daily quota active)"
          : undefined,
      });
    } catch (error: any) {
      console.error("TTS Generation Error:", error);
      const parsed = parseGeminiError(error);
      res.status(500).json({
        error: parsed.cleanMessage || "Failed to generate speech audio.",
      });
    }
  });

  // Script Transcription & Analysis endpoint using Gemini 3.7 Flash (Protected)
  app.post("/api/transcribe-script", requireAuthMiddleware, async (req, res) => {
    try {
      const {
        fileName = "Untitled Script",
        fileType = "txt",
        content = "",
        isBase64Audio = false,
        mimeType = "text/plain",
      } = req.body;

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ error: "Script content cannot be empty." });
      }

      const ai = getGeminiClient();

      let promptParts: any[] = [];

      if (isBase64Audio && mimeType.startsWith("audio/")) {
        promptParts = [
          {
            inlineData: {
              mimeType: mimeType || "audio/mp3",
              data: content,
            },
          },
          {
            text: `Transcribe and format this audio recording into a complete, structured script with timestamps, speaker names, and line-by-line dialogue.`,
          },
        ];
      } else {
        // Text script / screenplay / subtitle / document
        const truncatedContent = content.length > 100000 ? content.slice(0, 100000) + "\n\n[...truncated for processing...]" : content;
        promptParts = [
          {
            text: `You are an expert Script Transcription and Voice Direction system. Transcribe, analyze, format, and structure the following script file into clean, production-ready speech lines.
File Name: "${fileName}" (Type: ${fileType})

SCRIPT CONTENT:
---
${truncatedContent}
---

Return a valid JSON object matching this schema:
{
  "title": "A clear, descriptive title for this script",
  "summary": "Concise 1-3 sentence summary of the script content and context",
  "language": "Detected language (e.g. English, Spanish, etc.)",
  "readingLevel": "e.g. Conversational, Dramatic, Technical, Broadcast",
  "pacingNote": "Acoustic delivery recommendation (e.g. Medium-paced with natural pauses)",
  "speakers": [
    {
      "name": "Speaker or Character Name",
      "suggestedVoice": "One of: Kore, Puck, Charon, Fenrir, Zephyr, Aoede",
      "lineCount": 0,
      "toneDescription": "e.g. Warm and friendly, Baritone authoritative, etc."
    }
  ],
  "dialogueLines": [
    {
      "id": "1",
      "speaker": "Speaker Name (or Narrator if single voice)",
      "text": "Clean natural speech line with proper punctuation and natural pause cadence",
      "timestamp": "00:00:00",
      "emotion": "e.g. Cheerful, Serious, Whispered, Excited, Calm",
      "voice": "Suggested Gemini TTS voice: Kore | Puck | Charon | Fenrir | Zephyr | Aoede"
    }
  ],
  "fullFormattedText": "Full clean text representation formatted with speaker headers and dialogue",
  "keyHighlights": [
    "Key highlight or main takeaway point 1",
    "Key highlight 2"
  ]
}

Ensure all dialogue lines are formatted for natural speech synthesis without stage direction noise inside the spoken text. Return strictly valid JSON only.`,
          },
        ];
      }

      const response = await generateWithFallback(ai, {
        primaryModel: "gemini-3.7-flash",
        fallbackModels: ["gemini-2.5-flash"],
        contents: [{ parts: promptParts }],
        config: {
          responseMimeType: "application/json",
        },
      });

      const rawResponseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      let parsedData: any;
      try {
        parsedData = JSON.parse(rawResponseText);
      } catch (parseError) {
        // Fallback cleanup if JSON wrapped in markdown ticks
        const jsonMatch = rawResponseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Gemini returned invalid JSON structure for script transcription.");
        }
      }

      // Sanitize fields
      const sanitizedSpeakers = Array.isArray(parsedData.speakers) && parsedData.speakers.length > 0
        ? parsedData.speakers.map((s: any) => ({
            name: String(s.name || "Speaker"),
            suggestedVoice: ["Kore", "Puck", "Charon", "Fenrir", "Zephyr", "Aoede"].includes(s.suggestedVoice)
              ? s.suggestedVoice
              : "Kore",
            lineCount: Number(s.lineCount || 1),
            toneDescription: String(s.toneDescription || "Conversational natural"),
          }))
        : [
            {
              name: "Speaker 1",
              suggestedVoice: "Kore",
              lineCount: Array.isArray(parsedData.dialogueLines) ? parsedData.dialogueLines.length : 1,
              toneDescription: "Warm conversational tone",
            },
          ];

      const sanitizedDialogueLines = Array.isArray(parsedData.dialogueLines) && parsedData.dialogueLines.length > 0
        ? parsedData.dialogueLines.map((line: any, idx: number) => ({
            id: String(line.id || idx + 1),
            speaker: String(line.speaker || (sanitizedSpeakers[0]?.name || "Speaker")),
            text: String(line.text || "").trim(),
            timestamp: String(line.timestamp || `00:${String(Math.floor(idx * 3)).padStart(2, "0")}`),
            emotion: String(line.emotion || "Natural"),
            voice: ["Kore", "Puck", "Charon", "Fenrir", "Zephyr", "Aoede"].includes(line.voice)
              ? line.voice
              : (sanitizedSpeakers[0]?.suggestedVoice || "Kore"),
          }))
        : [
            {
              id: "1",
              speaker: sanitizedSpeakers[0]?.name || "Speaker 1",
              text: content.slice(0, 500).trim(),
              timestamp: "00:00",
              emotion: "Natural",
              voice: "Kore",
            },
          ];

      const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      const estimatedDurationSec = Math.max(2, Math.round(wordCount / 2.5));

      res.json({
        success: true,
        fileName,
        fileType,
        transcription: {
          title: parsedData.title || fileName.replace(/\.[^/.]+$/, ""),
          summary: parsedData.summary || "Script transcription processed successfully.",
          language: parsedData.language || "English",
          readingLevel: parsedData.readingLevel || "Conversational",
          pacingNote: parsedData.pacingNote || "Natural human conversational cadence",
          speakers: sanitizedSpeakers,
          dialogueLines: sanitizedDialogueLines,
          fullFormattedText: parsedData.fullFormattedText || sanitizedDialogueLines.map((d: any) => `${d.speaker}: ${d.text}`).join("\n\n"),
          keyHighlights: Array.isArray(parsedData.keyHighlights) ? parsedData.keyHighlights : [],
          completedAt: Date.now(),
        },
        wordCount,
        pageCount: Math.max(1, Math.ceil(wordCount / 250)),
        estimatedDurationSec,
      });
    } catch (error: any) {
      console.error("Transcription Error:", error);
      res.status(500).json({
        error: error.message || "Failed to transcribe and analyze script with Gemini.",
      });
    }
  });

  // ==========================================
  // AI Speech to Text Pipeline Endpoints (Audio & Video)
  // ==========================================

  // Universal upload & extraction endpoint for Audio & Video
  app.post("/api/speech/upload-and-extract", requireAuthMiddleware, upload.single("media"), async (req, res) => {
    let uploadedFilePath: string | undefined = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No media file uploaded. Please provide an audio or video file." });
      }

      const { originalname, size, mimetype, path: tempPath } = req.file;
      console.log(
        `[Speech Pipeline] Media upload received: filename="${originalname}", size=${size} bytes (${(size / (1024 * 1024)).toFixed(2)} MB), mimeType="${mimetype}"`
      );

      // Validate format
      const ext = path.extname(originalname).toLowerCase();
      const validExtensions = [
        // Audio
        ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wma", ".aiff",
        // Video
        ".mp4", ".mov", ".avi", ".mkv", ".webm", ".mpeg", ".mpg", ".wmv", ".m4v", ".3gp", ".flv"
      ];

      if (!validExtensions.includes(ext) && !mimetype.startsWith("video/") && !mimetype.startsWith("audio/")) {
        return res.status(400).json({
          error: `Unsupported file format "${ext}". Supported formats include MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, MP4, MOV, AVI, MKV, WebM, etc.`,
        });
      }

      console.log(`[Speech Pipeline] Starting FFmpeg audio probe, volume analysis, and normalization...`);
      const extractionResult = await processMediaFileForTranscription(tempPath, originalname);

      console.log(
        `[Speech Pipeline] Audio extraction finished: mediaType=${extractionResult.mediaType}, duration=${extractionResult.durationSec.toFixed(2)}s, chunks=${extractionResult.chunks.length}, maxVolume=${extractionResult.volume.maxVolumeDb} dB, isSilent=${extractionResult.volume.isSilent}`
      );

      res.json({
        success: true,
        fileName: originalname,
        fileSize: size,
        mediaType: extractionResult.mediaType,
        durationSec: extractionResult.durationSec,
        volume: extractionResult.volume,
        probe: extractionResult.probe,
        totalChunks: extractionResult.chunks.length,
        chunks: extractionResult.chunks,
      });
    } catch (error: any) {
      console.error("[Speech Pipeline] Audio Extraction Error:", error);
      res.status(500).json({
        error: error.message || "Failed to extract and process audio track from uploaded file.",
      });
    } finally {
      if (uploadedFilePath) {
        try {
          await fs.promises.unlink(uploadedFilePath);
        } catch {}
      }
    }
  });

  // Transcribe individual audio chunk with TranscriptionService (Gemini 3.7 Flash + Gemini 2.5 Flash Fallback)
  app.post("/api/speech/transcribe-chunk", requireAuthMiddleware, async (req, res) => {
    try {
      const {
        audioData, // base64 WAV
        mimeType = "audio/wav",
        chunkIndex = 0,
        totalChunks = 1,
        chunkStartSec = 0,
        chunkDurationSec = 0,
        language = "auto",
        detectSpeakers = true,
        speakerCount = "auto",
        detectAudioEvents = true,
        cleanTranscript = true,
        wordTimestamps = true,
        keyTerms = "",
        previousContext = "",
      } = req.body;

      if (!audioData || typeof audioData !== "string") {
        return res.status(400).json({ error: "audioData base64 payload is required." });
      }

      const ai = getGeminiClient();

      const result = await defaultTranscriptionService.transcribeChunk(ai, {
        audioData,
        mimeType,
        chunkIndex,
        totalChunks,
        chunkStartSec,
        chunkDurationSec,
        language,
        detectSpeakers,
        speakerCount,
        detectAudioEvents,
        cleanTranscript,
        wordTimestamps,
        keyTerms,
        previousContext,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("[Speech Pipeline] Transcription Error:", error);
      res.status(500).json({
        error: error.message || "Speech transcription service temporarily unavailable. Please try again.",
      });
    }
  });

  // Summarize complete transcript & extract key highlights
  app.post("/api/speech/summarize", requireAuthMiddleware, async (req, res) => {
    try {
      const { fullText = "", fileName = "Media" } = req.body;
      if (!fullText || fullText.trim().length === 0) {
        return res.status(400).json({ error: "Transcript text is required for summary." });
      }

      const ai = getGeminiClient();
      const prompt = `Analyze this spoken audio/video transcript for "${fileName}":
TRANSCRIPT:
${fullText.slice(0, 32000)}

Provide:
1. A concise 2-4 sentence executive summary.
2. 3-6 key highlight bullet points.
3. Main topics discussed.

Return strictly valid JSON:
{
  "summary": "Executive summary...",
  "keyHighlights": ["Highlight 1", "Highlight 2"],
  "topics": ["Topic 1", "Topic 2"]
}`;

      const response = await generateWithFallback(ai, {
        primaryModel: "gemini-3.7-flash",
        fallbackModels: ["gemini-2.5-flash"],
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" },
      });

      const raw = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      let parsed = { summary: "", keyHighlights: [], topics: [] };
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      res.json({
        success: true,
        summary: parsed.summary || "",
        keyHighlights: parsed.keyHighlights || [],
        topics: parsed.topics || [],
      });
    } catch (error: any) {
      console.error("[Speech Pipeline] Summarize Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate summary." });
    }
  });

  // ==========================================
  // Legacy Video-to-Transcript Pipeline Endpoints (Maintained for compatibility)
  // ==========================================

  // Upload video and extract 16kHz mono WAV chunks with FFmpeg & loudness normalization
  app.post("/api/video/upload-and-extract", requireAuthMiddleware, upload.single("video"), async (req, res) => {
    let uploadedFilePath: string | undefined = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded." });
      }

      const { originalname, size, mimetype, path: tempPath } = req.file;
      console.log(
        `[Video Pipeline] Video upload received: filename="${originalname}", size=${size} bytes (${(size / (1024 * 1024)).toFixed(2)} MB), mimeType="${mimetype}"`
      );

      // Validate video format extension
      const ext = path.extname(originalname).toLowerCase();
      const validExtensions = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".ogv", ".mp3", ".wav", ".m4a", ".aac"];
      if (!validExtensions.includes(ext) && !mimetype.startsWith("video/") && !mimetype.startsWith("audio/")) {
        return res.status(400).json({
          error: `Unsupported media format "${ext}". Supported formats include MP4, MOV, WebM, MKV, AVI, etc.`,
        });
      }

      console.log(`[Video Pipeline] Starting FFmpeg audio extraction & volume normalization...`);
      const extractionResult = await processVideoFileForTranscription(tempPath, originalname);

      console.log(
        `[Video Pipeline] Audio extraction finished: duration=${extractionResult.durationSec.toFixed(2)}s, chunks=${extractionResult.chunks.length}, maxVolume=${extractionResult.volume.maxVolumeDb} dB, isSilent=${extractionResult.volume.isSilent}`
      );

      res.json({
        success: true,
        fileName: originalname,
        fileSize: size,
        durationSec: extractionResult.durationSec,
        volume: extractionResult.volume,
        probe: extractionResult.probe,
        totalChunks: extractionResult.chunks.length,
        chunks: extractionResult.chunks,
      });
    } catch (error: any) {
      console.error("[Video Pipeline] Audio Extraction Error:", error);
      res.status(500).json({
        error: error.message || "Failed to extract and process audio track from uploaded video.",
      });
    } finally {
      if (uploadedFilePath) {
        try {
          await fs.promises.unlink(uploadedFilePath);
        } catch {}
      }
    }
  });

  // Pre-upload media validation endpoint
  app.post("/api/video/validate-media", requireAuthMiddleware, upload.single("video"), async (req, res) => {
    let uploadedFilePath: string | undefined = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file provided for validation." });
      }

      const probe = await probeMedia(req.file.path);
      const volume = await analyzeAudioVolume(req.file.path);

      res.json({
        success: true,
        fileName: req.file.originalname,
        hasAudioStream: probe.hasAudioStream,
        audioCodec: probe.audioCodec,
        durationSec: probe.durationSec,
        volume,
      });
    } catch (error: any) {
      console.error("[Video Pipeline] Media validation error:", error);
      res.status(500).json({ error: error.message || "Media validation failed." });
    } finally {
      if (uploadedFilePath) {
        try {
          await fs.promises.unlink(uploadedFilePath);
        } catch {}
      }
    }
  });

  // Transcribe individual audio chunk with Gemini 3.7 Flash & multi-tier fallbacks
  app.post("/api/video/transcribe-chunk", requireAuthMiddleware, async (req, res) => {
    try {
      const {
        audioData, // base64 WAV
        mimeType = "audio/wav",
        chunkIndex = 0,
        totalChunks = 1,
        chunkStartSec = 0,
        chunkDurationSec = 0,
        previousContext = "",
        languageHint = "",
      } = req.body;

      if (!audioData || typeof audioData !== "string") {
        return res.status(400).json({ error: "audioData base64 payload is required." });
      }

      const approxPayloadBytes = Math.round(audioData.length * 0.75);
      console.log(
        `[Video Pipeline] Model request sent: Chunk ${chunkIndex + 1}/${totalChunks} (start: ${chunkStartSec.toFixed(1)}s, duration: ${chunkDurationSec.toFixed(1)}s), audioSize: ${(approxPayloadBytes / 1024).toFixed(1)} KB, languageHint: "${languageHint || 'Auto'}"`
      );

      const ai = getGeminiClient();

      const contextInstruction = previousContext
        ? `\nPREVIOUS DIALOGUE CONTEXT (for continuity of speakers & terms): "${previousContext.slice(0, 300)}"`
        : "";

      const languageInstruction = languageHint
        ? `\nPREFERRED SPOKEN LANGUAGE: ${languageHint}. Accurately transcribe whatever is spoken.`
        : "";

      const promptText = `You are a world-class speech recognition and audio transcription system.
Transcribe this audio recording chunk (Chunk ${chunkIndex + 1} of ${totalChunks}, starting at ${chunkStartSec.toFixed(1)}s in the overall video).

ACCURACY & TRANSCRIPTION MANDATES:
1. FAITHFUL TRANSCRIPTION:
   - Transcribe every spoken word, phrase, sentence, greeting, remark, or conversation heard in the audio.
   - Do NOT omit spoken dialogue. Even if the speaker is quiet, speaking quickly, has an accent, or background noise/music is present, transcribe what they say.
2. SCRIPT & LANGUAGE INTEGRITY:
   - If spoken in Nepali, transcribe in Nepali (Devanagari script) or Romanized Nepali as spoken.
   - If spoken in Hindi, transcribe in Hindi (Devanagari script) or Hinglish as spoken.
   - If spoken in English, Hinglish, Bengali, Urdu, Tamil, Telugu, Spanish, French, German, Japanese, Arabic, etc., transcribe in the authentic spoken language.
   - For code-switching / bilingual speech (e.g. Nepali mixed with English technical terms), faithfully preserve BOTH languages in natural harmony.
   - NEVER translate non-English speech into English unless English was spoken.
3. SPEAKER DETECTION:
   - Distinguish different speakers (e.g. "Speaker 1", "Speaker 2", "Host", "Guest").
4. ACCURATE TIMESTAMPS:
   - Provide relStartSec and relEndSec relative to this chunk (0.00s to ${chunkDurationSec.toFixed(1)}s).
${contextInstruction}${languageInstruction}

Return strictly valid JSON matching this schema:
{
  "detectedLanguage": "Main detected language (e.g. Nepali, Hindi, English, Hinglish, Mixed)",
  "detectedLanguages": ["Nepali", "English"],
  "speakers": ["Speaker 1", "Speaker 2"],
  "segments": [
    {
      "relStartSec": 0.0,
      "relEndSec": 4.5,
      "speaker": "Speaker 1",
      "text": "Exact speech text transcribed faithfully",
      "language": "Nepali"
    }
  ],
  "chunkSummary": "One short sentence summarizing the spoken content"
}`;

      // Helper for HH:MM:SS
      const formatTimeStr = (totalSec: number) => {
        const s = Math.max(0, Math.floor(totalSec));
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        if (hrs > 0) {
          return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        }
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      };

      let parsed: any = null;
      let rawText = "";

      // Tier 1: Primary Model (gemini-3.7-flash)
      try {
        const response = await generateWithFallback(ai, {
          primaryModel: "gemini-3.7-flash",
          fallbackModels: ["gemini-2.5-flash"],
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || "audio/wav",
                    data: audioData,
                  },
                },
                { text: promptText },
              ],
            },
          ],
          config: { responseMimeType: "application/json" },
        });

        rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
        }
      } catch (tier1Err: any) {
        console.warn(`[Video Pipeline] Tier 1 model attempt failed:`, tier1Err.message);
      }

      // Check if segments were detected
      let rawSegments = Array.isArray(parsed?.segments) ? parsed.segments : [];

      // Tier 2: Secondary Fallback if 0 segments returned but audio was provided
      if (rawSegments.length === 0) {
        console.warn(
          `[Video Pipeline] Primary model returned 0 segments for Chunk ${chunkIndex + 1}. Triggering secondary fallback model (gemini-2.5-flash) with speech recovery prompt...`
        );

        const fallbackPrompt = `There is spoken dialogue in this audio recording. Listen closely to any vocal speech, greetings, conversation, or dialogue.
Transcribe all spoken words into accurate subtitle segments.
Return JSON:
{
  "detectedLanguage": "Language name",
  "speakers": ["Speaker 1"],
  "segments": [
    {
      "relStartSec": 0.0,
      "relEndSec": 3.0,
      "speaker": "Speaker 1",
      "text": "Transcribed spoken words",
      "language": "Auto"
    }
  ]
}`;

        try {
          const fallbackResp = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || "audio/wav",
                      data: audioData,
                    },
                  },
                  { text: fallbackPrompt },
                ],
              },
            ],
            config: { responseMimeType: "application/json" },
          });

          const fallbackText = fallbackResp.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          let fallbackParsed: any = null;
          try {
            fallbackParsed = JSON.parse(fallbackText);
          } catch {
            const match = fallbackText.match(/\{[\s\S]*\}/);
            if (match) fallbackParsed = JSON.parse(match[0]);
          }

          if (Array.isArray(fallbackParsed?.segments) && fallbackParsed.segments.length > 0) {
            console.log(
              `[Video Pipeline] Secondary fallback recovered ${fallbackParsed.segments.length} segments for Chunk ${chunkIndex + 1}!`
            );
            parsed = fallbackParsed;
            rawSegments = fallbackParsed.segments;
          }
        } catch (tier2Err: any) {
          console.warn(`[Video Pipeline] Secondary fallback attempt error:`, tier2Err.message);
        }
      }

      // Tier 3: Direct Dialogue Recovery if still 0 segments
      if (rawSegments.length === 0) {
        console.warn(
          `[Video Pipeline] Tier 2 returned 0 segments. Attempting raw text transcription fallback...`
        );
        try {
          const plainResp = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || "audio/wav",
                      data: audioData,
                    },
                  },
                  {
                    text: `Transcribe all vocal speech and spoken words from this audio recording verbatim. Write out each sentence on a new line. Do not describe background sounds, only transcribe spoken words. If no speech is spoken at all, reply with EMPTY.`,
                  },
                ],
              },
            ],
          });

          const plainText = (plainResp.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
          if (plainText && !plainText.toUpperCase().includes("EMPTY") && plainText.length > 2) {
            const lines = plainText
              .split("\n")
              .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
              .filter((l) => l.length > 0);

            if (lines.length > 0) {
              const lineDur = Math.max(2, (chunkDurationSec || 10) / lines.length);
              rawSegments = lines.map((line, idx) => ({
                relStartSec: idx * lineDur,
                relEndSec: Math.min(chunkDurationSec || 10, (idx + 1) * lineDur),
                speaker: "Speaker 1",
                text: line,
                language: languageHint || "Auto",
              }));
              console.log(
                `[Video Pipeline] Raw text fallback recovered ${rawSegments.length} dialogue lines for Chunk ${chunkIndex + 1}!`
              );
            }
          }
        } catch (tier3Err: any) {
          console.warn(`[Video Pipeline] Tier 3 plain text recovery error:`, tier3Err.message);
        }
      }

      // Map segments with absolute video timestamps
      const absoluteSegments = rawSegments
        .map((seg: any, idx: number) => {
          const relStart = typeof seg.relStartSec === "number" ? seg.relStartSec : idx * 3;
          const relEnd = typeof seg.relEndSec === "number" ? seg.relEndSec : relStart + 3;
          const absStart = Number((chunkStartSec + Math.max(0, relStart)).toFixed(2));
          const absEnd = Number((chunkStartSec + Math.max(relStart + 0.5, relEnd)).toFixed(2));

          return {
            id: `chunk_${chunkIndex}_seg_${idx}_${Date.now()}`,
            startSec: absStart,
            endSec: absEnd,
            timestamp: formatTimeStr(absStart),
            speaker: String(seg.speaker || `Speaker ${chunkIndex + 1}`).trim(),
            text: String(seg.text || "").trim(),
            language: String(seg.language || parsed?.detectedLanguage || "Auto"),
          };
        })
        .filter((seg: any) => seg.text.length > 0);

      console.log(
        `[Video Pipeline] Model response received: ${absoluteSegments.length} segments identified in Chunk ${chunkIndex + 1}.`
      );

      res.json({
        success: true,
        chunkIndex,
        totalChunks,
        detectedLanguage: parsed?.detectedLanguage || languageHint || "Auto-detected",
        detectedLanguages: Array.isArray(parsed?.detectedLanguages)
          ? parsed.detectedLanguages
          : [parsed?.detectedLanguage || languageHint || "Auto"],
        speakers: Array.isArray(parsed?.speakers) ? parsed.speakers : ["Speaker 1"],
        segments: absoluteSegments,
        chunkSummary: parsed?.chunkSummary || "",
        speechDetected: absoluteSegments.length > 0,
      });
    } catch (error: any) {
      console.error("[Video Pipeline] Video Chunk Transcription Error:", error);
      res.status(500).json({
        error: error.message || "Failed to transcribe video audio chunk with Gemini.",
      });
    }
  });

  // Summarize complete video transcript & extract key takeaways
  app.post("/api/video/summarize-transcript", requireAuthMiddleware, async (req, res) => {
    try {
      const { fullText = "", fileName = "Video" } = req.body;
      if (!fullText || fullText.trim().length === 0) {
        return res.status(400).json({ error: "Transcript text is required." });
      }

      const ai = getGeminiClient();
      const prompt = `Analyze this video transcript for "${fileName}":
TRANSCRIPT:
${fullText.slice(0, 30000)}

Provide:
1. A concise 2-4 sentence executive summary.
2. 3-5 key highlight bullet points.
3. Main topics discussed.

Return strictly valid JSON:
{
  "summary": "Executive summary of the video transcript...",
  "keyHighlights": ["Highlight 1", "Highlight 2", "Highlight 3"],
  "topics": ["Topic A", "Topic B"]
}`;

      const response = await generateWithFallback(ai, {
        primaryModel: "gemini-3.7-flash",
        fallbackModels: ["gemini-2.5-flash"],
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" },
      });

      const raw = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      let parsed = JSON.parse(raw);

      res.json({
        success: true,
        summary: parsed.summary || "",
        keyHighlights: parsed.keyHighlights || [],
        topics: parsed.topics || [],
      });
    } catch (error: any) {
      console.error("Video Summary Error:", error);
      res.status(500).json({
        error: error.message || "Failed to summarize video transcript.",
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TTS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
