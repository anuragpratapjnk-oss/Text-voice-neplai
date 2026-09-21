import fs from "fs";
import path from "path";
import { exec, execFile, spawn } from "child_process";
import type { SpawnOptionsWithoutStdio } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

export interface FfmpegInfo {
  available: boolean;
  path: string | null;
  version: string | null;
  source: "env" | "ffmpeg-static" | "system-path" | "which" | "fallback" | "none";
  error?: string;
}

export interface FfprobeInfo {
  available: boolean;
  path: string | null;
  version: string | null;
  source: "env" | "ffprobe-static" | "system-path" | "which" | "fallback" | "none";
  error?: string;
}

let cachedFfmpegInfo: FfmpegInfo | null = null;
let cachedFfprobeInfo: FfprobeInfo | null = null;

/**
 * Check if a file exists and is executable
 */
function isExecutable(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;

    // Check execution permission on POSIX systems
    if (process.platform !== "win32") {
      try {
        fs.accessSync(filePath, fs.constants.X_OK);
      } catch {
        // Try to add execute permission if possible
        try {
          fs.chmodSync(filePath, 0o755);
          fs.accessSync(filePath, fs.constants.X_OK);
        } catch {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect FFmpeg executable and version.
 * Runs `ffmpeg -version`, logs detected path and version, avoiding any secret leaks.
 */
export async function detectFfmpeg(forceRefresh = false): Promise<FfmpegInfo> {
  if (cachedFfmpegInfo && !forceRefresh) {
    return cachedFfmpegInfo;
  }

  const candidates: Array<{ path: string; source: FfmpegInfo["source"] }> = [];

  // 1. Explicit environment variable
  if (process.env.FFMPEG_PATH && isExecutable(process.env.FFMPEG_PATH)) {
    candidates.push({ path: process.env.FFMPEG_PATH, source: "env" });
  }

  // 2. ffmpeg-static package
  try {
    // Dynamic import to support both ESM and bundled CJS
    const ffmpegStaticMod = await import("ffmpeg-static");
    const staticPath =
      typeof ffmpegStaticMod === "string"
        ? ffmpegStaticMod
        : (ffmpegStaticMod as any).default || (ffmpegStaticMod as any).path;
    if (typeof staticPath === "string" && isExecutable(staticPath)) {
      candidates.push({ path: staticPath, source: "ffmpeg-static" });
    }
  } catch (err: any) {
    // ffmpeg-static import failed or not found
  }

  // 3. Known system paths
  const standardPaths =
    process.platform === "win32"
      ? [
          "C:\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
          "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
        ]
      : [
          "/usr/bin/ffmpeg",
          "/usr/local/bin/ffmpeg",
          "/opt/homebrew/bin/ffmpeg",
          "/bin/ffmpeg",
          "/usr/lib/ffmpeg",
        ];

  for (const p of standardPaths) {
    if (isExecutable(p)) {
      candidates.push({ path: p, source: "system-path" });
    }
  }

  // 4. Check system PATH via which/where
  try {
    const whichCmd = process.platform === "win32" ? "where ffmpeg" : "which ffmpeg";
    const { stdout } = await execPromise(whichCmd, { timeout: 3000 });
    const resolvedPath = stdout.trim().split(/\r?\n/)[0];
    if (resolvedPath && isExecutable(resolvedPath)) {
      candidates.push({ path: resolvedPath, source: "which" });
    }
  } catch {
    // which/where failed or command not in path
  }

  // Test each candidate by running -version
  for (const candidate of candidates) {
    try {
      const { stdout } = await execFilePromise(candidate.path, ["-version"], {
        timeout: 5000,
      });
      const firstLine = stdout.trim().split("\n")[0] || "";
      const versionMatch = firstLine.match(/ffmpeg\s+version\s+([^\s]+)/i);
      const version = versionMatch ? versionMatch[1] : firstLine.slice(0, 40);

      cachedFfmpegInfo = {
        available: true,
        path: candidate.path,
        version,
        source: candidate.source,
      };

      console.log(
        `[FFmpeg Resolver] Verified FFmpeg (${version}) at [${candidate.source}]: ${candidate.path}`
      );
      return cachedFfmpegInfo;
    } catch (verErr: any) {
      console.warn(
        `[FFmpeg Resolver] Candidate at ${candidate.path} failed execution check: ${verErr.message}`
      );
    }
  }

  // No working FFmpeg found
  cachedFfmpegInfo = {
    available: false,
    path: null,
    version: null,
    source: "none",
    error: "FFmpeg executable could not be found or executed in this environment.",
  };

  console.warn(
    `[FFmpeg Resolver] WARNING: FFmpeg is unavailable on this server. Checked ${candidates.length} candidates.`
  );
  return cachedFfmpegInfo;
}

/**
 * Detect FFprobe executable and version.
 */
export async function detectFfprobe(forceRefresh = false): Promise<FfprobeInfo> {
  if (cachedFfprobeInfo && !forceRefresh) {
    return cachedFfprobeInfo;
  }

  const candidates: Array<{ path: string; source: FfprobeInfo["source"] }> = [];

  // 1. Explicit env var
  if (process.env.FFPROBE_PATH && isExecutable(process.env.FFPROBE_PATH)) {
    candidates.push({ path: process.env.FFPROBE_PATH, source: "env" });
  }

  // 2. ffprobe-static package
  try {
    const ffprobeStaticMod = await import("ffprobe-static");
    const staticPath =
      (ffprobeStaticMod as any).default?.path || (ffprobeStaticMod as any).path;
    if (typeof staticPath === "string" && isExecutable(staticPath)) {
      candidates.push({ path: staticPath, source: "ffprobe-static" });
    }
  } catch {
    // ffprobe-static not found
  }

  // 3. Known system paths
  const standardPaths =
    process.platform === "win32"
      ? [
          "C:\\ffmpeg\\bin\\ffprobe.exe",
          "C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe",
        ]
      : [
          "/usr/bin/ffprobe",
          "/usr/local/bin/ffprobe",
          "/opt/homebrew/bin/ffprobe",
          "/bin/ffprobe",
        ];

  for (const p of standardPaths) {
    if (isExecutable(p)) {
      candidates.push({ path: p, source: "system-path" });
    }
  }

  // 4. Check system PATH
  try {
    const whichCmd = process.platform === "win32" ? "where ffprobe" : "which ffprobe";
    const { stdout } = await execPromise(whichCmd, { timeout: 3000 });
    const resolvedPath = stdout.trim().split(/\r?\n/)[0];
    if (resolvedPath && isExecutable(resolvedPath)) {
      candidates.push({ path: resolvedPath, source: "which" });
    }
  } catch {}

  for (const candidate of candidates) {
    try {
      const { stdout } = await execFilePromise(candidate.path, ["-version"], {
        timeout: 5000,
      });
      const firstLine = stdout.trim().split("\n")[0] || "";
      const versionMatch = firstLine.match(/ffprobe\s+version\s+([^\s]+)/i);
      const version = versionMatch ? versionMatch[1] : firstLine.slice(0, 40);

      cachedFfprobeInfo = {
        available: true,
        path: candidate.path,
        version,
        source: candidate.source,
      };

      console.log(
        `[FFprobe Resolver] Verified FFprobe (${version}) at [${candidate.source}]: ${candidate.path}`
      );
      return cachedFfprobeInfo;
    } catch (err: any) {
      console.warn(
        `[FFprobe Resolver] Candidate at ${candidate.path} failed execution check: ${err.message}`
      );
    }
  }

  cachedFfprobeInfo = {
    available: false,
    path: null,
    version: null,
    source: "none",
    error: "FFprobe executable could not be found or executed in this environment.",
  };

  return cachedFfprobeInfo;
}

/**
 * Get the verified FFmpeg executable path or throw a user-friendly error.
 */
export async function getVerifiedFfmpegPath(): Promise<string> {
  const info = await detectFfmpeg();
  if (!info.available || !info.path) {
    throw new Error(
      "FFmpeg is unavailable on the server. Please check the FFmpeg installation and runtime PATH."
    );
  }
  return info.path;
}

/**
 * Get the verified FFprobe executable path or throw a user-friendly error.
 */
export async function getVerifiedFfprobePath(): Promise<string> {
  const info = await detectFfprobe();
  if (!info.available || !info.path) {
    throw new Error(
      "FFprobe is unavailable on the server. Please check the FFmpeg/FFprobe installation and runtime PATH."
    );
  }
  return info.path;
}

/**
 * Spawn an FFmpeg process with reliable path resolution, timeouts, and error handling.
 */
export async function spawnFfmpeg(
  args: string[],
  options?: SpawnOptionsWithoutStdio & { timeoutMs?: number }
) {
  const ffmpegPath = await getVerifiedFfmpegPath();
  const timeoutMs = options?.timeoutMs || 45000;

  const child = spawn(ffmpegPath, args, options);

  // Setup timeout to prevent hanging child processes
  const timeout = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {}
  }, timeoutMs);

  child.on("close", () => {
    clearTimeout(timeout);
  });

  child.on("error", (err: any) => {
    clearTimeout(timeout);
    if (err.code === "ENOENT") {
      console.error(
        `[FFmpeg Process Error] FFmpeg executable not found at path: ${ffmpegPath}`
      );
    } else if (err.code === "EACCES") {
      console.error(
        `[FFmpeg Process Error] Permission denied executing FFmpeg at path: ${ffmpegPath}`
      );
    } else {
      console.error(`[FFmpeg Process Error]: ${err.message}`);
    }
  });

  return child;
}

/**
 * Format any FFmpeg or system execution error into a clean user message.
 */
export function formatFfmpegError(error: any): string {
  if (!error) return "Unknown audio processing failure.";
  const msg = error.message || String(error);
  if (
    error.code === "ENOENT" ||
    msg.includes("ENOENT") ||
    msg.includes("spawn ffmpeg") ||
    msg.includes("ffmpeg: not found")
  ) {
    return "FFmpeg is unavailable on the server. Please check the FFmpeg installation and runtime PATH.";
  }
  if (error.code === "EACCES" || msg.includes("EACCES")) {
    return "FFmpeg execution permission denied on the server.";
  }
  return msg;
}
