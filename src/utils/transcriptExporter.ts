/**
 * Transcript & Subtitle Exporter
 * Generates and downloads real TXT, SRT, VTT, DOCX, PDF, CSV, JSON files,
 * and bulk ZIP archives.
 */

import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { SpeechTranscriptSegment, SpeechTranscriptionJob } from '../types';
import { formatSrtTime, formatVttTime, formatTime } from './audioExtractor';

/**
 * Clean base filename without extension
 */
export function getBaseFileName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '').trim() || 'transcript';
}

/**
 * Generate SRT subtitle format
 */
export function generateSrt(segments: SpeechTranscriptSegment[]): string {
  if (!segments || segments.length === 0) return '';
  return segments
    .map((seg, idx) => {
      const srtStart = formatSrtTime(seg.startSec);
      const srtEnd = formatSrtTime(seg.endSec);
      const speakerPrefix = seg.speaker ? `[${seg.speaker}] ` : '';
      return `${idx + 1}\n${srtStart} --> ${srtEnd}\n${speakerPrefix}${seg.text}\n`;
    })
    .join('\n');
}

/**
 * Generate VTT subtitle format
 */
export function generateVtt(segments: SpeechTranscriptSegment[], title: string = 'Transcript'): string {
  if (!segments || segments.length === 0) return 'WEBVTT\n';
  let vtt = `WEBVTT - ${title}\n\n`;
  segments.forEach((seg, idx) => {
    const vttStart = formatVttTime(seg.startSec);
    const vttEnd = formatVttTime(seg.endSec);
    const speakerPrefix = seg.speaker ? `<v ${seg.speaker}>` : '';
    const speakerSuffix = seg.speaker ? '</v>' : '';
    vtt += `${idx + 1}\n${vttStart} --> ${vttEnd}\n${speakerPrefix}${seg.text}${speakerSuffix}\n\n`;
  });
  return vtt;
}

/**
 * Generate Plain Text (.txt)
 */
export function generateTxt(
  segments: SpeechTranscriptSegment[],
  includeTimestamps: boolean = true,
  includeSpeakers: boolean = true
): string {
  if (!segments || segments.length === 0) return '';
  return segments
    .map((seg) => {
      const timePart = includeTimestamps ? `[${seg.timestamp || formatTime(seg.startSec)}] ` : '';
      const speakerPart = includeSpeakers && seg.speaker ? `${seg.speaker}: ` : '';
      return `${timePart}${speakerPart}${seg.text}`;
    })
    .join('\n\n');
}

/**
 * Generate CSV format
 */
export function generateCsv(segments: SpeechTranscriptSegment[]): string {
  const headers = ['Segment #', 'Start Seconds', 'End Seconds', 'Timestamp', 'Speaker', 'Language', 'Text'];
  const rows = (segments || []).map((seg, idx) => [
    idx + 1,
    seg.startSec.toFixed(2),
    seg.endSec.toFixed(2),
    `"${seg.timestamp || formatTime(seg.startSec)}"`,
    `"${(seg.speaker || 'Speaker').replace(/"/g, '""')}"`,
    `"${(seg.language || 'Auto').replace(/"/g, '""')}"`,
    `"${(seg.text || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Generate JSON format with full metadata, words, and events
 */
export function generateJson(job: SpeechTranscriptionJob): string {
  const payload = {
    fileName: job.fileName,
    mediaType: job.mediaType,
    durationSec: job.durationSec,
    languages: job.detectedLanguages,
    primaryLanguage: job.primaryLanguage,
    speakers: job.speakers,
    summary: job.summary,
    keyHighlights: job.keyHighlights,
    keyTopics: job.keyTopics,
    completedAt: job.completedAt || Date.now(),
    segments: job.segments.map((s) => ({
      id: s.id,
      startSec: s.startSec,
      endSec: s.endSec,
      timestamp: s.timestamp,
      speaker: s.speaker,
      text: s.text,
      language: s.language,
      words: s.words,
      events: s.events,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Generate Word Document (.docx) compatible rich XML Blob
 */
export function generateDocxBlob(job: SpeechTranscriptionJob, includeTimestamps: boolean = true): Blob {
  const durationFormatted = formatTime(job.durationSec || 0, true);
  const detectedLangs = (job.detectedLanguages || []).join(', ') || job.primaryLanguage || 'Auto-detected';
  const speakersList = (job.speakers || []).join(', ') || 'Identified Speakers';
  const dateStr = new Date(job.completedAt || Date.now()).toLocaleString();

  const contentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${job.fileName} - Transcript</title>
      <style>
        body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 32px; background: #ffffff; }
        h1 { color: #0f172a; font-size: 22pt; margin-bottom: 6pt; border-bottom: 2px solid #0284c7; padding-bottom: 8pt; }
        h2 { color: #0369a1; font-size: 14pt; margin-top: 18pt; margin-bottom: 8pt; }
        .meta { color: #475569; font-size: 10pt; margin-bottom: 16pt; background: #f8fafc; padding: 10pt; border-radius: 6pt; border: 1px solid #e2e8f0; }
        .meta strong { color: #0f172a; }
        .summary-box { background: #f0f9ff; border-left: 4px solid #0284c7; padding: 12pt; margin-bottom: 20pt; font-size: 11pt; border-radius: 0 6pt 6pt 0; }
        .summary-box h3 { margin: 0 0 6pt 0; color: #0369a1; font-size: 12pt; }
        .segment { margin-bottom: 12pt; padding-bottom: 8pt; border-bottom: 1px dotted #e2e8f0; }
        .timestamp { color: #64748b; font-family: 'Consolas', monospace; font-size: 9.5pt; font-weight: bold; margin-right: 8pt; background: #f1f5f9; padding: 2pt 4pt; border-radius: 3pt; }
        .speaker { font-weight: bold; color: #0284c7; margin-right: 6pt; }
        .text { font-size: 11pt; color: #1e293b; }
      </style>
    </head>
    <body>
      <h1>${job.fileName} - Speech Transcript</h1>
      <div class="meta">
        <strong>Duration:</strong> ${durationFormatted} &nbsp;|&nbsp; 
        <strong>Media Type:</strong> ${job.mediaType ? job.mediaType.toUpperCase() : 'AUDIO/VIDEO'} &nbsp;|&nbsp;
        <strong>Detected Languages:</strong> ${detectedLangs} &nbsp;|&nbsp; 
        <strong>Speakers:</strong> ${speakersList} &nbsp;|&nbsp; 
        <strong>Transcribed Date:</strong> ${dateStr}
      </div>

      ${job.summary ? `<div class="summary-box"><h3>Executive Summary</h3><p>${job.summary}</p></div>` : ''}

      <h2>Full Transcript</h2>
      ${(job.segments || [])
        .map(
          (seg) => `
        <div class="segment">
          ${includeTimestamps ? `<span class="timestamp">[${seg.timestamp || formatTime(seg.startSec)}]</span>` : ''}
          <span class="speaker">${seg.speaker || 'Speaker'}:</span>
          <span class="text">${seg.text}</span>
        </div>
      `
        )
        .join('')}
    </body>
    </html>
  `;

  return new Blob(['\ufeff' + contentHtml], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8',
  });
}

/**
 * Direct PDF Generator & Downloader using jsPDF
 */
export function downloadPdfTranscript(job: SpeechTranscriptionJob, includeTimestamps: boolean = true) {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 48;

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    const title = `${job.fileName} - Speech Transcript`;
    const titleLines = doc.splitTextToSize(title, maxLineWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 18 + 6;

    // Metadata Bar
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    const langs = (job.detectedLanguages || []).join(', ') || job.primaryLanguage || 'Auto';
    const metaText = `Duration: ${formatTime(job.durationSec || 0, true)}   |   Languages: ${langs}   |   Date: ${new Date(job.completedAt || Date.now()).toLocaleDateString()}`;
    doc.text(metaText, margin, y);
    y += 12;

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;

    // Summary box if present
    if (job.summary) {
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(2, 132, 199);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(2, 132, 199);
      doc.text('Summary & Key Takeaways', margin + 8, y + 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const summaryLines = doc.splitTextToSize(job.summary, maxLineWidth - 16);
      doc.rect(margin, y, maxLineWidth, summaryLines.length * 12 + 24, 'F');
      doc.text(summaryLines, margin + 8, y + 26);
      y += summaryLines.length * 12 + 36;
    }

    // Segments
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Transcript Dialogue', margin, y);
    y += 16;

    for (const seg of job.segments || []) {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 48;
      }

      const timeStr = includeTimestamps ? `[${seg.timestamp || formatTime(seg.startSec)}] ` : '';
      const speakerStr = `${seg.speaker || 'Speaker'}: `;
      const lineHead = `${timeStr}${speakerStr}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(2, 132, 199); // sky-600

      const headWidth = doc.getTextWidth(lineHead);
      const fullText = `${lineHead}${seg.text}`;
      const wrappedLines = doc.splitTextToSize(fullText, maxLineWidth);

      doc.text(wrappedLines[0] || '', margin, y);
      y += 13;

      if (wrappedLines.length > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        for (let l = 1; l < wrappedLines.length; l++) {
          if (y > pageHeight - 50) {
            doc.addPage();
            y = 48;
          }
          doc.text(wrappedLines[l], margin, y);
          y += 13;
        }
      }

      y += 5;
    }

    const baseName = getBaseFileName(job.fileName);
    doc.save(`${baseName}_transcript.pdf`);
  } catch (pdfErr) {
    console.error('PDF export failed with jsPDF, falling back to print dialog:', pdfErr);
    printTranscript(job, includeTimestamps);
  }
}

/**
 * Download a generated text or blob as a local file with exact filename
 */
export function downloadFile(content: string | Blob, fileName: string, mimeType: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Bulk ZIP exporter: generates a neat zip containing TXT, SRT, and JSON for all completed jobs
 */
export async function downloadBulkZip(jobs: SpeechTranscriptionJob[]) {
  const zip = new JSZip();
  const completed = jobs.filter((j) => j.status === 'completed' && j.segments && j.segments.length > 0);

  if (completed.length === 0) {
    throw new Error('No completed transcripts available for ZIP archive.');
  }

  for (const job of completed) {
    const baseName = getBaseFileName(job.fileName);
    const folder = zip.folder(baseName) || zip;

    // 1. Text transcript
    folder.file(`${baseName}.txt`, generateTxt(job.segments, true, true));
    // 2. SubRip subtitles
    folder.file(`${baseName}.srt`, generateSrt(job.segments));
    // 3. WebVTT subtitles
    folder.file(`${baseName}.vtt`, generateVtt(job.segments, job.fileName));
    // 4. Structured JSON data
    folder.file(`${baseName}.json`, generateJson(job));
    // 5. CSV format
    folder.file(`${baseName}.csv`, generateCsv(job.segments));
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadFile(content, `speech_transcripts_${dateTag}.zip`, 'application/zip');
}

/**
 * Print / Save as PDF browser fallback
 */
export function printTranscript(job: SpeechTranscriptionJob, includeTimestamps: boolean = true) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print/save PDF transcript.');
    return;
  }

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${job.fileName} - Speech Transcript</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 40px auto; padding: 0 20px; }
        h1 { font-size: 22px; color: #0f172a; margin-bottom: 6px; }
        .meta-bar { font-size: 12px; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
        .summary-card { background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 13px; }
        .transcript-line { margin-bottom: 14px; font-size: 14px; }
        .timestamp { color: #64748b; font-family: monospace; font-size: 12px; margin-right: 8px; font-weight: bold; }
        .speaker { font-weight: 700; color: #0284c7; margin-right: 6px; }
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${job.fileName}</h1>
      <div class="meta-bar">
        <strong>Duration:</strong> ${formatTime(job.durationSec || 0, true)} &bull; 
        <strong>Languages:</strong> ${(job.detectedLanguages || []).join(', ') || job.primaryLanguage || 'Auto'} &bull; 
        <strong>Date:</strong> ${new Date(job.completedAt || Date.now()).toLocaleDateString()}
      </div>

      ${job.summary ? `<div class="summary-card"><strong>Summary:</strong> ${job.summary}</div>` : ''}

      <div>
        ${(job.segments || [])
          .map(
            (seg) => `
          <div class="transcript-line">
            ${includeTimestamps ? `<span class="timestamp">[${seg.timestamp || formatTime(seg.startSec)}]</span>` : ''}
            <span class="speaker">${seg.speaker || 'Speaker'}:</span>
            <span>${seg.text}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}
