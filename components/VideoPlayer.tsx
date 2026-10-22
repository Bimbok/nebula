import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GoogleDriveFile, AudioTrackInfo, SubtitleTrackInfo } from '../types';
import Loader from './Loader';
import { getWatchProgress, saveWatchProgress } from '../services/watchProgressService';
import { discordPresenceService } from '../services/discordPresenceService';
import { parseMediaTitle } from '../services/mediaTitleParser';

interface VideoPlayerProps {
  video: GoogleDriveFile;
  onClose: () => void;
  initialSeekTime?: number;
}

export type AspectRatioMode = 'fit' | 'crop' | 'stretch' | '21:9' | '16:9' | '4:3';

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

// Minimalist Modern SVG Icons
const Icons = {
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5.14v14c0 .86.94 1.39 1.67.94l11-7c.72-.45.72-1.5 0-1.95l-11-7c-.73-.45-1.67.08-1.67.95z" />
    </svg>
  ),
  Pause: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75zm10.5 0a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75z" clipRule="evenodd" />
    </svg>
  ),
  Rewind10: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
      <text x="12" y="21" fontSize="7" fill="currentColor" textAnchor="middle" stroke="none" fontWeight="bold">10</text>
    </svg>
  ),
  Forward10: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
      <text x="12" y="21" fontSize="7" fill="currentColor" textAnchor="middle" stroke="none" fontWeight="bold">10</text>
    </svg>
  ),
  VolumeHigh: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  VolumeMute: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ),
  Audio: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  ),
  Subtitle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="4" />
      <path d="M7 15h3M14 15h3M7 11h10" />
    </svg>
  ),
  Aspect: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9l-2 2 2 2M17 9l2 2-2 2" />
    </svg>
  ),
  Fullscreen: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  ExitFullscreen: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M10 10V4m0 6H4m6 0L3 3m10 7h6m0 0V4m0 6l7-7" />
    </svg>
  ),
  Close: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Copy: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Keyboard: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  ),
  Back: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  ChevronUp: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  Speed: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Upload: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  ),
};

function normalizeSubtitleText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function convertSrtToVtt(srtText: string): string {
  const normalized = normalizeSubtitleText(srtText)
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return 'WEBVTT\n\n' + normalized + '\n';
}

// ASS/SSA -> WebVTT. Dialogue text is preserved, while advanced positioning,
// karaoke and style overrides are simplified because WebVTT cannot represent them all.
function convertAssToVtt(assText: string): string {
  const lines = normalizeSubtitleText(assText).split('\n');
  let eventFields: string[] = [];
  const cues: string[] = [];
  const toTime = (value: string): string | null => {
    const m = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[.](\d{1,2})$/);
    if (!m) return null;
    return m[1].padStart(2, '0') + ':' + m[2] + ':' + m[3] + '.' + m[4].padEnd(2, '0').slice(0, 2) + '0';
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\[Events\]/i.test(line)) { eventFields = []; continue; }
    if (/^\[/.test(line)) { eventFields = []; continue; }
    if (/^Format\s*:/i.test(line) && eventFields.length === 0) {
      eventFields = line.slice(line.indexOf(':') + 1).split(',').map((x) => x.trim().toLowerCase());
      continue;
    }
    if (!/^Dialogue\s*:/i.test(line) || eventFields.length === 0) continue;
    const values = line.slice(line.indexOf(':') + 1).trim().split(',');
    if (values.length < eventFields.length) continue;
    const fields: Record<string, string> = {};
    eventFields.forEach((field, i) => { fields[field] = i === eventFields.length - 1 ? values.slice(i).join(',') : values[i] ?? ''; });
    const start = toTime(fields.start || '');
    const end = toTime(fields.end || '');
    const text = (fields.text || '').replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ').replace(/<[^>]*>/g, '').trim();
    if (start && end && text) cues.push(start + ' --> ' + end + '\n' + text);
  }
  return 'WEBVTT\n\n' + cues.join('\n\n') + (cues.length ? '\n\n' : '');
}

// YouTube SBV format: 0:00:01.000,0:00:04.000 followed by text.
function convertSbvToVtt(input: string): string {
  const lines = normalizeSubtitleText(input).split('\n');
  const cues: string[] = [];
  for (let i = 0; i < lines.length;) {
    const m = lines[i].trim().match(/^(\d{1,2}:\d{2}:\d{2}\.\d{3}),(\d{1,2}:\d{2}:\d{2}\.\d{3})$/);
    if (!m) { i++; continue; }
    const text: string[] = [];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^\d{1,2}:\d{2}:\d{2}\.\d{3},\d{1,2}:\d{2}:\d{2}\.\d{3}$/.test(lines[i].trim())) text.push(lines[i++]);
    if (text.length) cues.push(m[1] + ' --> ' + m[2] + '\n' + text.join('\n'));
  }
  return 'WEBVTT\n\n' + cues.join('\n\n') + (cues.length ? '\n\n' : '');
}

// MicroDVD .sub uses frame numbers. Most files use 25 fps; this is a best-effort default.
function convertMicroDvdToVtt(input: string): string {
  const cues: string[] = [];
  const time = (frame: number) => {
    const ms = Math.max(0, Math.round(frame / 25 * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
  };
  for (const line of normalizeSubtitleText(input).split('\n')) {
    const m = line.match(/^\{(\d+)\}\{(\d+)\}(.*)$/);
    if (!m) continue;
    const start = Number(m[1]), end = Number(m[2]);
    if (end <= start) continue;
    const text = m[3].replace(/\|/g, '\n').replace(/\{[^}]*\}/g, '').trim();
    if (text) cues.push(time(start) + ' --> ' + time(end) + '\n' + text);
  }
  return 'WEBVTT\n\n' + cues.join('\n\n') + (cues.length ? '\n\n' : '');
}

// LRC lyrics are shown as timed text lines; each line ends when the next line begins.
function convertLrcToVtt(input: string): string {
  const entries: { time: number; text: string }[] = [];
  for (const line of normalizeSubtitleText(input).split('\n')) {
    const tags = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]+\]/g, '').trim();
    if (!text) continue;
    for (const tag of tags) {
      const fraction = tag[3] || '0';
      const millis = fraction.length === 3 ? Number(fraction) : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction) * 100;
      entries.push({ time: Number(tag[1]) * 60 + Number(tag[2]) + millis / 1000, text });
    }
  }
  entries.sort((a, b) => a.time - b.time);
  const fmt = (seconds: number) => {
    const ms = Math.max(0, Math.round(seconds * 1000));
    return String(Math.floor(ms / 3600000)).padStart(2, '0') + ':' + String(Math.floor(ms / 60000) % 60).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
  };
  const cues = entries.map((entry, i) => {
    const end = entries[i + 1]?.time ?? entry.time + 5;
    return end > entry.time ? fmt(entry.time) + ' --> ' + fmt(end) + '\n' + entry.text : '';
  }).filter(Boolean);
  return 'WEBVTT\n\n' + cues.join('\n\n') + (cues.length ? '\n\n' : '');
}

// TTML/DFXP XML subtitles. Converts timed <p> elements; unsupported styling is dropped.
function convertTtmlToVtt(input: string): string {
  try {
    const doc = new DOMParser().parseFromString(normalizeSubtitleText(input), 'application/xml');
    if (doc.querySelector('parsererror')) return 'WEBVTT\n\n';
    const toSeconds = (value: string | null) => {
      if (!value) return null;
      const v = value.trim();
      const clock = v.match(/^(\d{1,2}:)?(\d{2}):(\d{2})(?:[.,](\d+))?$/);
      if (clock) {
        const parts = v.split(':');
        const sec = Number(parts.pop());
        const min = Number(parts.pop());
        const hour = parts.length ? Number(parts.pop()) : 0;
        const frac = v.match(/[.,](\d+)$/)?.[1] || '';
        return hour * 3600 + min * 60 + sec + (frac ? Number('0.' + frac) : 0);
      }
      const offset = v.match(/^(\d+(?:\.\d+)?)(h|m|s|ms)$/);
      if (offset) return Number(offset[1]) * ({ h: 3600, m: 60, s: 1, ms: 0.001 } as Record<string, number>)[offset[2]];
      return null;
    };
    const fmt = (seconds: number) => {
      const ms = Math.max(0, Math.round(seconds * 1000));
      return String(Math.floor(ms / 3600000)).padStart(2, '0') + ':' + String(Math.floor(ms / 60000) % 60).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
    };
    const cues: string[] = [];
    for (const p of Array.from(doc.getElementsByTagNameNS('*', 'p'))) {
      const start = toSeconds(p.getAttribute('begin'));
      const explicitEnd = toSeconds(p.getAttribute('end'));
      const duration = toSeconds(p.getAttribute('dur'));
      const end = explicitEnd ?? (start !== null && duration !== null ? start + duration : null);
      const text = (p.textContent || '').replace(/\s+/g, ' ').trim();
      if (start !== null && end !== null && end > start && text) cues.push(fmt(start) + ' --> ' + fmt(end) + '\n' + text);
    }
    return 'WEBVTT\n\n' + cues.join('\n\n') + (cues.length ? '\n\n' : '');
  } catch {
    return 'WEBVTT\n\n';
  }
}

function convertSubtitleToVtt(fileName: string, input: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const content = normalizeSubtitleText(input);
  if (extension === 'srt') return convertSrtToVtt(content);
  if (extension === 'ass' || extension === 'ssa') return convertAssToVtt(content);
  if (extension === 'sbv') return convertSbvToVtt(content);
  if (extension === 'sub') return content.startsWith('WEBVTT') ? content : convertMicroDvdToVtt(content);
  if (extension === 'lrc') return convertLrcToVtt(content);
  if (['ttml', 'dfxp', 'xml'].includes(extension)) return convertTtmlToVtt(content);
  if (extension === 'vtt') return content;
  return 'WEBVTT\n\n';
}

function parseVttTimestamp(str: string): number {
  if (!str) return 0;
  const clean = str.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
  }
  if (parts.length === 2) {
    return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
  }
  return parseFloat(parts[0]) || 0;
}

function parseWebVttCues(vttText: string): SubtitleCue[] {
  if (!vttText || typeof vttText !== 'string') return [];
  const cues: SubtitleCue[] = [];
  const lines = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let i = 0;
  // Skip WEBVTT header and any leading metadata/style blocks
  while (i < lines.length) {
    if (lines[i].includes('-->')) break;
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const arrowIdx = line.indexOf('-->');
      const startStr = line.substring(0, arrowIdx).trim().split(/\s+/)[0];
      const endPart = line.substring(arrowIdx + 3).trim();
      const endStr = endPart.split(/\s+/)[0];

      const start = parseVttTimestamp(startStr);
      const end = parseVttTimestamp(endStr);

      i++;
      const textLines: string[] = [];
      while (i < lines.length) {
        const textLine = lines[i].trim();
        if (textLine === '') {
          break;
        }
        if (textLine.includes('-->')) {
          if (textLines.length > 0 && /^\d+$/.test(textLines[textLines.length - 1])) {
            textLines.pop();
          }
          break;
        }

        // Strip HTML tags and ASS/SSA curly brace styling
        const cleaned = textLine
          .replace(/<[^>]+>/g, '')
          .replace(/\{[^}]+\}/g, '')
          .trim();

        if (cleaned.length > 0) {
          textLines.push(cleaned);
        }
        i++;
      }

      if (textLines.length > 0 && end > start) {
        cues.push({
          start,
          end,
          text: textLines.join('\n'),
        });
      }
    } else {
      i++;
    }
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

function findActiveCueText(cues: SubtitleCue[], time: number): string | null {
  if (!cues || cues.length === 0 || time < 0) return null;
  const active: string[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (time >= cue.start && time <= cue.end) {
      active.push(cue.text);
    } else if (cue.start > time + 5) {
      break;
    }
  }
  return active.length > 0 ? active.join('\n') : null;
}

const aspectModes: { key: AspectRatioMode; label: string }[] = [
  { key: 'fit', label: 'Fit (Original)' },
  { key: 'crop', label: 'Crop (Zoom to Fill)' },
  { key: 'stretch', label: 'Stretch (Full)' },
  { key: '21:9', label: '21:9 (Cinemascope)' },
  { key: '16:9', label: '16:9 (Widescreen)' },
  { key: '4:3', label: '4:3 (Classic)' },
];

const formatTimestamp = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0 || !isFinite(totalSeconds)) return '00:00';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
};


const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onClose, initialSeekTime }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const scrubberContainerRef = useRef<HTMLDivElement>(null);
  const subtitleAbortRef = useRef<AbortController | null>(null);

  const parsedMedia = useMemo(() => parseMediaTitle(video.name), [video.name]);

  // Saved watch progress lookup
  const savedProgress = React.useMemo(() => getWatchProgress(video.id), [video.id]);
  const initialTime =
    typeof initialSeekTime === 'number' && initialSeekTime > 0
      ? Math.floor(initialSeekTime)
      : savedProgress && savedProgress.currentTime > 5 && savedProgress.progressPercent < 95
      ? Math.floor(savedProgress.currentTime)
      : 0;

  // Streaming & Playback States
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(initialTime);
  const [resumeTime, setResumeTime] = useState<number>(initialTime);
  const [showResumeToast, setShowResumeToast] = useState<boolean>(initialTime > 5);
  const [probedDuration, setProbedDuration] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackError, setPlaybackError] = useState<{ message: string; code?: number } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const prevStreamUrlRef = useRef<string>('');

  // Volume & Audio State
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);

  // Center Splash Feedback Animation (Play / Pause ripple)
  const [splashIcon, setSplashIcon] = useState<'play' | 'pause' | null>(null);

  // Aspect Ratio & Fullscreen
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('fit');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showAspectToast, setShowAspectToast] = useState<string | null>(null);
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const [showHotkeysModal, setShowHotkeysModal] = useState<boolean>(false);

  // Active Popover Menu: 'audio' | 'subtitles' | 'speed' | null
  const [activeMenu, setActiveMenu] = useState<'audio' | 'subtitles' | 'speed' | null>(null);

  // Playback Speed
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Scrubber Hover Tooltip
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Audio & Subtitle Tracks (Restoring saved preferences if available)
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<string>(savedProgress?.audioIndex || '0');
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>(savedProgress?.subtitleId || 'off');
  const [isProbingTracks, setIsProbingTracks] = useState<boolean>(true);
  const [isSubtitleLoading, setIsSubtitleLoading] = useState<boolean>(false);
  const [subtitleSize, setSubtitleSize] = useState<'normal' | 'large'>('normal');
  // Positive values delay subtitles; negative values show them earlier.
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0);

  // Last saved timestamp tracker for throttling
  const lastSavedTimeRef = useRef<number>(initialTime);

  // Auto-dismiss resume toast after 4.5 seconds
  useEffect(() => {
    if (!showResumeToast) return;
    const t = setTimeout(() => setShowResumeToast(false), 4500);
    return () => clearTimeout(t);
  }, [showResumeToast]);

  // Subtitle cue parser cache & active cue.
  // Always calculate against the absolute movie timestamp (stream resume offset + element time).
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);
  const isSeekingRef = useRef<boolean>(false);
  const seekTargetTimeRef = useRef<number>(initialTime);
  // A seek with an indexed audio track restarts the FFmpeg stream at startTime;
  // it may not produce a native "seeked" event on the existing video element.
  const pendingStreamSeekRef = useRef<boolean>(false);
  const subtitleRequestIdRef = useRef<number>(0);

  const syncSubtitleCue = useCallback(
    (overrideTime?: number) => {
      if (selectedSubtitleId === 'off' || subtitleCues.length === 0) {
        setActiveCueText(null);
        return;
      }

      const player = videoRef.current;
      const time =
        typeof overrideTime === 'number' && Number.isFinite(overrideTime)
          ? overrideTime
          : isSeekingRef.current
          ? seekTargetTimeRef.current
          : resumeTime + (player?.currentTime ?? 0);

      const text = findActiveCueText(subtitleCues, time - subtitleOffset);
      setActiveCueText((prev) => (prev === text ? prev : text));
    },
    [selectedSubtitleId, subtitleCues, resumeTime, subtitleOffset]
  );

  useEffect(() => {
    syncSubtitleCue();
  }, [subtitleCues, syncSubtitleCue]);

  // Reactive token state with automatic background refresh sync
  const [currentToken, setCurrentToken] = useState<string>(() => {
    return (
      window.gapi?.client?.getToken?.()?.access_token ||
      (() => {
        try {
          const stored = localStorage.getItem('gdrive_oauth_token');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.access_token) return parsed.access_token;
          }
        } catch {}
        const match = document.cookie.match(/gdrive_token=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
      })()
    );
  });

  useEffect(() => {
    const handleTokenRefreshed = (e: any) => {
      if (e.detail && typeof e.detail === 'string') {
        setCurrentToken(e.detail);
      }
    };
    window.addEventListener('nebula:token_refreshed', handleTokenRefreshed);
    return () => {
      window.removeEventListener('nebula:token_refreshed', handleTokenRefreshed);
    };
  }, []);

  const token = currentToken;

  // Calculate True Total Duration
  const knownTotalDuration =
    probedDuration > 0
      ? probedDuration
      : video.videoMediaMetadata?.durationMillis
      ? parseInt(video.videoMediaMetadata.durationMillis, 10) / 1000
      : 0;

  // Stream URL calculation - Smart Auto-Codec direct pass or 320k Studio AAC handled transparently
  const currentStreamUrl = `/api/stream?fileId=${video.id}&token=${encodeURIComponent(token)}&audioIndex=${selectedAudioIndex}&startTime=${resumeTime}`;

  const absoluteStreamUrl = typeof window !== 'undefined' ? `${window.location.origin}${currentStreamUrl}` : currentStreamUrl;

  // Persist watch progress helper
  const persistCurrentProgress = useCallback(
    (timeToSave?: number) => {
      const time =
        typeof timeToSave === 'number'
          ? timeToSave
          : videoRef.current
          ? resumeTime + videoRef.current.currentTime
          : currentTime;
      if (isNaN(time) || time < 3) return;

      saveWatchProgress(video, time, knownTotalDuration, {
        audioIndex: selectedAudioIndex,
        subtitleId: selectedSubtitleId,
      });
      lastSavedTimeRef.current = time;
    },
    [video, knownTotalDuration, selectedAudioIndex, selectedSubtitleId, currentTime, resumeTime]
  );

  // 1. Probing streams for audio, subtitles, and total duration
  useEffect(() => {
    let isCancelled = false;
    const probeTracks = async () => {
      setIsProbingTracks(true);
      try {
        const res = await fetch(`/api/tracks?fileId=${video.id}&token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error('Failed to probe media streams');
        const data = await res.json();
        if (!isCancelled) {
          if (data.audioTracks && Array.isArray(data.audioTracks)) {
            setAudioTracks(data.audioTracks);
          }
          if (data.subtitleTracks && Array.isArray(data.subtitleTracks)) {
            setSubtitleTracks(data.subtitleTracks);
            setSelectedSubtitleId((prev) => {
              if (prev === 'off') {
                const eng = data.subtitleTracks.find(
                  (s: SubtitleTrackInfo) =>
                    !s.isBitmap && (s.language === 'eng' || s.label.toLowerCase().includes('eng'))
                );
                return eng ? eng.id.toString() : 'off';
              }
              return prev;
            });
          }
          if (data.duration && data.duration > 0) {
            setProbedDuration(data.duration);
          }
        }
      } catch (err) {
        console.warn('Track probing warning:', err);
      } finally {
        if (!isCancelled) {
          setIsProbingTracks(false);
        }
      }
    };

    probeTracks();

    return () => {
      isCancelled = true;
    };
  }, [video.id, token]);

  // 2. Load subtitle cues progressively, but only publish complete WebVTT cue blocks.
  // FFmpeg sends WebVTT in chunks. Parsing an unfinished final line can briefly create
  // broken cues, while waiting for the whole document can delay subtitles for large files.
  useEffect(() => {
    subtitleAbortRef.current?.abort();
    const requestId = ++subtitleRequestIdRef.current;

    if (selectedSubtitleId === 'off') {
      setSubtitleCues([]);
      setActiveCueText(null);
      setIsSubtitleLoading(false);
      return;
    }

    const controller = new AbortController();
    subtitleAbortRef.current = controller;
    const isCurrentRequest = () =>
      subtitleRequestIdRef.current === requestId &&
      subtitleAbortRef.current === controller &&
      !controller.signal.aborted;

    const matched = subtitleTracks.find((s) => s.id.toString() === selectedSubtitleId);
    if (!matched) {
      setSubtitleCues([]);
      setActiveCueText(null);
      setIsSubtitleLoading(false);
      return () => controller.abort();
    }

    const publishCompleteCues = (vttText: string, isFinal = false, previousText = '') => {
      const normalized = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const boundary = normalized.lastIndexOf('\n\n');
      const completeLength = isFinal ? normalized.length : boundary >= 0 ? boundary + 2 : 0;
      const completeText = normalized.slice(0, completeLength);

      if (completeText === previousText || (!isFinal && completeLength === 0)) {
        return { publishedText: previousText, cueCount: -1 };
      }

      const cues = parseWebVttCues(completeText);
      if (cues.length > 0) setSubtitleCues(cues);
      return { publishedText: completeText, cueCount: cues.length };
    };

    const loadSubtitles = async () => {
      setIsSubtitleLoading(true);
      setSubtitleCues([]);
      setActiveCueText(null);

      try {
        const isCustom = matched.isCustom && !!matched.blobUrl;
        const subUrl = `/api/subtitles?fileId=${video.id}&streamIndex=${matched.streamIndex}&token=${encodeURIComponent(token)}${matched.isBitmap ? '&isBitmap=true' : ''}`;
        const res = await fetch(isCustom ? matched.blobUrl! : subUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`Subtitle HTTP error: ${res.status}`);

        if (isCustom || !res.body) {
          const vttText = await res.text();
          if (!isCurrentRequest()) return;
          const cues = parseWebVttCues(vttText);
          if (cues.length === 0 && !matched.isBitmap) {
            throw new Error('Subtitle response contained no valid WebVTT cues');
          }
          setSubtitleCues(cues);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let receivedText = '';
        let publishedText = '';
        let finalCueCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (value) receivedText += decoder.decode(value, { stream: !done });
          if (done) receivedText += decoder.decode();

          if (!isCurrentRequest()) {
            await reader.cancel().catch(() => {});
            return;
          }

          const result = publishCompleteCues(receivedText, done, publishedText);
          if (result.cueCount >= 0) {
            publishedText = result.publishedText;
            finalCueCount = result.cueCount;
          }

          if (done) break;
        }

        if (finalCueCount === 0 && !matched.isBitmap) {
          throw new Error('Subtitle response contained no valid WebVTT cues');
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError' && isCurrentRequest()) {
          console.error('[Subtitle load error]', err);
          setSubtitleCues([]);
          setActiveCueText(null);
        }
      } finally {
        if (isCurrentRequest()) setIsSubtitleLoading(false);
      }
    };

    void loadSubtitles();
    return () => controller.abort();
  }, [selectedSubtitleId, subtitleTracks, video.id, token]);

  // 3. Subtitle presentation engine - hardware video frame presentation + event listeners + heartbeat
  useEffect(() => {
    if (subtitleCues.length === 0 || selectedSubtitleId === 'off') {
      setActiveCueText(null);
      return;
    }

    const player = videoRef.current;
    if (!player) return;

    syncSubtitleCue();

    type FrameCallbackVideo = HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: (_now: number, metadata: { mediaTime: number }) => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    const framePlayer = player as FrameCallbackVideo;
    let frameHandle: number | undefined;

    const onFrame = (_now: number, metadata: { mediaTime: number }) => {
      if (!isSeekingRef.current) {
        syncSubtitleCue(resumeTime + metadata.mediaTime);
      }
      frameHandle = framePlayer.requestVideoFrameCallback?.(onFrame);
    };

    if (framePlayer.requestVideoFrameCallback) {
      frameHandle = framePlayer.requestVideoFrameCallback(onFrame);
    }

    const onSeeking = () => {
      // Ignore native timeline events caused by replacing the source after a stream seek.
      // The target timestamp is the authoritative time until the replacement starts.
      if (pendingStreamSeekRef.current) {
        syncSubtitleCue(seekTargetTimeRef.current);
        return;
      }

      isSeekingRef.current = true;
      const absoluteTime = resumeTime + player.currentTime;
      seekTargetTimeRef.current = absoluteTime;
      syncSubtitleCue(absoluteTime);
    };

    const onSeeked = () => {
      if (pendingStreamSeekRef.current) {
        syncSubtitleCue(seekTargetTimeRef.current);
        return;
      }

      const absoluteTime = resumeTime + player.currentTime;
      seekTargetTimeRef.current = absoluteTime;
      isSeekingRef.current = false;
      syncSubtitleCue(absoluteTime);
    };

    const onSyncEvent = () => {
      syncSubtitleCue();
    };

    // Heartbeat ticker to guarantee synchronization even when paused or stepping
    const ticker = window.setInterval(() => {
      syncSubtitleCue();
    }, 100);

    player.addEventListener('seeking', onSeeking);
    player.addEventListener('seeked', onSeeked);
    player.addEventListener('loadeddata', onSyncEvent);
    player.addEventListener('canplay', onSyncEvent);

    return () => {
      if (frameHandle !== undefined) framePlayer.cancelVideoFrameCallback?.(frameHandle);
      window.clearInterval(ticker);
      player.removeEventListener('seeking', onSeeking);
      player.removeEventListener('seeked', onSeeked);
      player.removeEventListener('loadeddata', onSyncEvent);
      player.removeEventListener('canplay', onSyncEvent);
    };
  }, [subtitleCues, selectedSubtitleId, resumeTime, syncSubtitleCue]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setIsControlsVisible(true);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (playerContainerRef.current) {
        playerContainerRef.current.requestFullscreen().catch(() => {
          if (videoRef.current) videoRef.current.requestFullscreen().catch(() => {});
        });
      }
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Aspect ratio cycle
  const cycleAspectRatio = useCallback(() => {
    setAspectRatio((prev) => {
      const idx = aspectModes.findIndex((m) => m.key === prev);
      const nextIdx = (idx + 1) % aspectModes.length;
      const nextMode = aspectModes[nextIdx];
      setShowAspectToast(nextMode.label);
      return nextMode.key;
    });
  }, []);

  useEffect(() => {
    if (!showAspectToast) return;
    const timer = setTimeout(() => setShowAspectToast(null), 1800);
    return () => clearTimeout(timer);
  }, [showAspectToast]);

  // Auto-hide controls with mouse movement & touch detection
  const resetControlsTimer = useCallback((forceVisible = true) => {
    if (forceVisible) setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !activeMenu) {
      controlsTimeoutRef.current = setTimeout(() => {
        setIsControlsVisible(false);
      }, 3200);
    }
  }, [isPlaying, activeMenu]);

  // Keep controls open whenever an options menu is open
  useEffect(() => {
    if (activeMenu) {
      setIsControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [activeMenu]);

  // Change playback speed smoothly
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setActiveMenu(null);
    resetControlsTimer(true);
  };

  const handleMouseMove = () => {
    resetControlsTimer(true);
  };

  // Auto-hide controls when video starts or resumes playing
  useEffect(() => {
    if (isPlaying) {
      resetControlsTimer(false);
    } else {
      setIsControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, resetControlsTimer]);

  // Trigger brief play/pause ripple
  const triggerSplash = (type: 'play' | 'pause') => {
    setSplashIcon(type);
    setTimeout(() => setSplashIcon(null), 500);
  };

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        triggerSplash('play');
      } else {
        videoRef.current.pause();
        triggerSplash('pause');
      }
    }
  }, []);

  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  // Unified screen tap handler: Touching anywhere on screen brings up OSD (or toggles on mobile)
  const handleScreenTap = useCallback(
    (source: 'touch' | 'click') => {
      // If an options menu is open, tapping anywhere outside dismisses it
      if (activeMenu) {
        setActiveMenu(null);
        return;
      }

      const now = Date.now();
      if (source === 'touch') {
        lastTouchTimeRef.current = now;
      } else if (source === 'click') {
        // Prevent synthetic 300ms ghost clicks from immediately re-toggling after a touch event
        if (now - lastTouchTimeRef.current < 450) {
          return;
        }
      }

      const isTouch =
        typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768);

      if (isTouch) {
        if (!isControlsVisible) {
          // If controls are hidden: touching anywhere brings up OSD immediately
          resetControlsTimer(true);
        } else {
          // If controls are visible: tapping screen background toggles them off
          setIsControlsVisible(false);
          if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
          }
        }
      } else {
        // Desktop mouse click: toggle Play/Pause
        togglePlay();
        resetControlsTimer(true);
      }
    },
    [isControlsVisible, resetControlsTimer, togglePlay, activeMenu]
  );

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.changedTouches[0];
    if (touch) {
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      // Treat as a tap if finger moved less than 15px (not a swipe or scroll)
      if (dx < 15 && dy < 15) {
        handleScreenTap('touch');
      }
    }
    touchStartPosRef.current = null;
  };

  // Unified Seek Handler: Instant in-buffer seeking + fast stream restart when outside buffer
  const seekTo = useCallback(
    (targetSeconds: number) => {
      const clamped = Math.max(0, Math.min(knownTotalDuration > 0 ? knownTotalDuration : Infinity, targetSeconds));
      persistCurrentProgress(clamped);

      // Update subtitle cue immediately to target position for instantaneous response
      if (subtitleCues.length > 0 && selectedSubtitleId !== 'off') {
        const immediateText = findActiveCueText(subtitleCues, clamped, subtitleOffset);
        setActiveCueText(immediateText);
      }

      const v = videoRef.current;
      const targetRelative = clamped - resumeTime;

      // Check if target is already inside the downloaded browser buffer
      let isWithinBuffer = false;
      let maxBufferedEnd = 0;

      if (v && v.buffered.length > 0 && targetRelative >= 0) {
        for (let i = 0; i < v.buffered.length; i++) {
          const bStart = v.buffered.start(i);
          const bEnd = v.buffered.end(i);
          if (bEnd > maxBufferedEnd) maxBufferedEnd = bEnd;

          // Target is within this buffered range (allow 0.25s tolerance)
          if (targetRelative >= bStart - 0.25 && targetRelative <= bEnd + 0.5) {
            isWithinBuffer = true;
            break;
          }
        }

        // Also allow local seeking if target is within 8 seconds ahead of buffer end,
        // because the open high-speed socket reaches it in ~100ms without restarting the stream!
        if (!isWithinBuffer && targetRelative >= 0 && targetRelative <= maxBufferedEnd + 8) {
          isWithinBuffer = true;
        }
      }

      if (isWithinBuffer && v) {
        // Native local seek: Instantaneous with zero network request and zero buffer dump!
        pendingStreamSeekRef.current = false;
        seekTargetTimeRef.current = clamped;
        isSeekingRef.current = false;
        v.currentTime = Math.max(0, targetRelative);
        setCurrentTime(clamped);
      } else {
        // Target is outside buffer or before stream start: restart stream directly from new keyframe
        pendingStreamSeekRef.current = true;
        const seekSec = Math.floor(clamped);
        seekTargetTimeRef.current = seekSec;
        setResumeTime(seekSec);
        setCurrentTime(seekSec);
        setIsBuffering(true);
      }

      discordPresenceService.updatePlayback({
        fileName: video.name,
        currentTime: clamped,
        duration: knownTotalDuration,
        isPlaying: isPlaying,
      });
    },
    [knownTotalDuration, resumeTime, persistCurrentProgress, video.name, isPlaying, subtitleCues, selectedSubtitleId, subtitleOffset]
  );

  // Scrubber Hover Tooltip logic
  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberContainerRef.current || knownTotalDuration <= 0) return;
    const rect = scrubberContainerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * knownTotalDuration);
  };

  const handleScrubberMouseLeave = () => {
    setHoverTime(null);
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    resetControlsTimer(true);
    if (activeMenu) setActiveMenu(null);
    if (!scrubberContainerRef.current || knownTotalDuration <= 0) return;
    const rect = scrubberContainerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pos * knownTotalDuration);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (activeMenu) {
          setActiveMenu(null);
          return;
        }
        if (showHotkeysModal) {
          setShowHotkeysModal(false);
          return;
        }
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
        return;
      }

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      const v = videoRef.current;
      if (!v) return;

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === 'c' || event.key === 'C' || event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        cycleAspectRatio();
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setIsMuted((prev) => !prev);
        v.muted = !v.muted;
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekTo(Math.max(0, currentTime - 10));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekTo(Math.min(knownTotalDuration > 0 ? knownTotalDuration : Infinity, currentTime + 10));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const newVol = Math.min(1, volume + 0.1);
        setVolume(newVol);
        v.volume = newVol;
        if (newVol > 0 && isMuted) {
          setIsMuted(false);
          v.muted = false;
        }
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const newVol = Math.max(0, volume - 0.1);
        setVolume(newVol);
        v.volume = newVol;
      } else if (event.key === '?') {
        event.preventDefault();
        setShowHotkeysModal((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, toggleFullscreen, cycleAspectRatio, knownTotalDuration, currentTime, seekTo, togglePlay, volume, isMuted, showHotkeysModal, activeMenu]);

  // Audio track switching
  const handleAudioTrackChange = (newAudioIdxStr: string) => {
    resetControlsTimer(true);
    if (newAudioIdxStr === selectedAudioIndex) return;
    const seekSec = Math.floor(currentTime);
    setResumeTime(seekSec);
    setCurrentTime(seekSec);
    setSelectedAudioIndex(newAudioIdxStr);
    setIsBuffering(true);
    setPlaybackError(null);
  };

  // Subtitle selection
  const handleSubtitleChange = (subIdStr: string) => {
    resetControlsTimer(true);
    setActiveCueText(null);
    setSubtitleCues([]);
    setSelectedSubtitleId(subIdStr);
  };

  // Local subtitle upload
  const handleLocalSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const supported = ['srt', 'vtt', 'ass', 'ssa', 'sbv', 'sub', 'lrc', 'ttml', 'dfxp', 'xml'];
      if (!supported.includes(extension)) {
        window.alert('This subtitle format is not supported yet. Supported text formats: SRT, VTT, ASS, SSA, SBV, MicroDVD SUB, LRC, TTML, DFXP, and XML-based timed text.');
        return;
      }

      const vttContent = convertSubtitleToVtt(file.name, content);
      if (!/^WEBVTT(?:\s|$)/.test(vttContent.trimStart()) || !vttContent.includes('-->')) {
        window.alert('Could not find valid timed subtitle cues in this file. Bitmap subtitles such as IDX/SUB, SUP, and PGS need OCR conversion first.');
        return;
      }

      const blob = new Blob([vttContent], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      const newTrack: SubtitleTrackInfo = {
        id: Date.now(),
        streamIndex: -1,
        codec: 'WebVTT',
        language: 'custom',
        label: 'File: ' + file.name,
        isCustom: true,
        blobUrl,
      };
      setSubtitleTracks((prev) => [...prev, newTrack]);
      setSelectedSubtitleId(newTrack.id.toString());
    };

    reader.onerror = () => window.alert('Could not read this subtitle file.');
    reader.readAsText(file);
    e.target.value = '';
  };

  // Calculate buffer lookahead percentage
  const updateBuffered = useCallback(() => {
    const v = videoRef.current;
    if (!v || knownTotalDuration <= 0) return;
    const b = v.buffered;
    if (b.length > 0) {
      const ct = v.currentTime;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= ct + 0.5 && ct <= b.end(i) + 0.5) {
          const absEnd = resumeTime + b.end(i);
          const pct = Math.min(100, Math.max(0, (absEnd / knownTotalDuration) * 100));
          setBufferedPercent(pct);
          return;
        }
      }
      const lastEnd = resumeTime + b.end(b.length - 1);
      const pct = Math.min(100, Math.max(0, (lastEnd / knownTotalDuration) * 100));
      setBufferedPercent(pct);
    }
  }, [knownTotalDuration, resumeTime]);

  // Seamless stream reload without remounting the video element
  useEffect(() => {
    if (!prevStreamUrlRef.current) {
      prevStreamUrlRef.current = currentStreamUrl;
      return;
    }
    if (prevStreamUrlRef.current !== currentStreamUrl) {
      prevStreamUrlRef.current = currentStreamUrl;
      if (videoRef.current) {
        setIsBuffering(true);
        videoRef.current.load();
        if (isPlaying) {
          const p = videoRef.current.play();
          if (p !== undefined) p.catch(() => {});
        }
      }
    }
  }, [currentStreamUrl, isPlaying]);

  // Video event handlers
  const handleLoadStart = () => {
    setIsBuffering(true);
    setPlaybackError(null);
  };

  const handleCanPlay = () => {
    setIsBuffering(false);
    if (videoRef.current && videoRef.current.playbackRate !== playbackSpeed) {
      videoRef.current.playbackRate = playbackSpeed;
    }
    // Do not clear seeking here: canplay may fire before the seek has completed.
    syncSubtitleCue();
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
    if (videoRef.current && videoRef.current.playbackRate !== playbackSpeed) {
      videoRef.current.playbackRate = playbackSpeed;
    }

    // A stream-reload seek may not emit "seeked"; release the temporary target-time
    // override once the restarted stream has actually begun playing.
    if (pendingStreamSeekRef.current) {
      pendingStreamSeekRef.current = false;
      isSeekingRef.current = false;
      const absoluteTime = resumeTime + (videoRef.current?.currentTime || 0);
      seekTargetTimeRef.current = absoluteTime;
      syncSubtitleCue(absoluteTime);
    } else {
      syncSubtitleCue();
    }
    resetControlsTimer(false);
    discordPresenceService.updatePlayback({
      fileName: video.name,
      currentTime: resumeTime + (videoRef.current?.currentTime || 0),
      duration: knownTotalDuration,
      isPlaying: true,
    });
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      persistCurrentProgress(resumeTime + videoRef.current.currentTime);
      discordPresenceService.updatePlayback({
        fileName: video.name,
        currentTime: resumeTime + videoRef.current.currentTime,
        duration: knownTotalDuration,
        isPlaying: false,
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const absTime = resumeTime + videoRef.current.currentTime;
      setCurrentTime(absTime);
      updateBuffered();
      syncSubtitleCue(absTime);

      // Throttle saving progress to localStorage every 4 seconds
      if (Math.abs(absTime - lastSavedTimeRef.current) >= 4) {
        persistCurrentProgress(absTime);
      }
    }
  };

  // Persist progress when closing or refreshing window
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (videoRef.current) {
        persistCurrentProgress(resumeTime + videoRef.current.currentTime);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (videoRef.current) {
        persistCurrentProgress(resumeTime + videoRef.current.currentTime);
      }
    };
  }, [persistCurrentProgress, resumeTime]);

  // Clear Discord Presence when video player is closed
  useEffect(() => {
    return () => {
      discordPresenceService.clearPlayback();
    };
  }, []);

  const handleError = () => {
    setIsBuffering(false);
    const mediaError = videoRef.current?.error;
    let detail = 'An unknown error occurred while streaming the video.';

    if (mediaError) {
      switch (mediaError.code) {
        case 1:
          detail = 'Video playback aborted.';
          break;
        case 2:
          detail = 'Network error: Failed to stream bytes from Google Drive.';
          break;
        case 3:
          detail = 'Decode error: The video codec could not be decoded by the browser.';
          break;
        case 4:
          detail = 'Format not supported: Your browser could not natively decode this audio/video codec (e.g. 10-bit HEVC / DTS). Switch audio tracks below to remux into 320k AAC or stream via VLC/MPV.';
          break;
        default:
          detail = mediaError.message || 'Media stream error.';
      }
    }

    setPlaybackError({
      message: detail,
      code: mediaError?.code,
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(absoluteStreamUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2200);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && event.target === modalRef.current && !document.fullscreenElement) {
      onClose();
    }
  };

  const getVideoStyle = (): React.CSSProperties => {
    switch (aspectRatio) {
      case 'crop':
        return { width: '100%', height: '100%', objectFit: 'cover' };
      case 'stretch':
        return { width: '100%', height: '100%', objectFit: 'fill' };
      case '21:9':
        return { width: '100%', height: '100%', aspectRatio: '21 / 9', objectFit: 'fill', margin: 'auto' };
      case '16:9':
        return { width: '100%', height: '100%', aspectRatio: '16 / 9', objectFit: 'fill', margin: 'auto' };
      case '4:3':
        return { width: '100%', height: '100%', aspectRatio: '4 / 3', objectFit: 'fill', margin: 'auto' };
      case 'fit':
      default:
        return { width: '100%', height: '100%', objectFit: 'contain' };
    }
  };

  const currentAudioTrack = useMemo(() => {
    return audioTracks.find((t) => t.id.toString() === selectedAudioIndex);
  }, [audioTracks, selectedAudioIndex]);

  const currentSubTrack = useMemo(() => {
    return subtitleTracks.find((s) => s.id.toString() === selectedSubtitleId);
  }, [subtitleTracks, selectedSubtitleId]);

  const audioButtonLabel = useMemo(() => {
    if (isProbingTracks && audioTracks.length === 0) return 'Detecting...';
    if (!currentAudioTrack) return 'Audio';
    return currentAudioTrack.label.length > 14 ? currentAudioTrack.label.slice(0, 14) + '...' : currentAudioTrack.label;
  }, [isProbingTracks, audioTracks.length, currentAudioTrack]);

  const subtitleButtonLabel = useMemo(() => {
    if (selectedSubtitleId === 'off') return 'Subtitles';
    if (!currentSubTrack) return 'CC On';
    return currentSubTrack.label.length > 14 ? currentSubTrack.label.slice(0, 14) + '...' : currentSubTrack.label;
  }, [selectedSubtitleId, currentSubTrack]);

  const progressPercent = knownTotalDuration > 0 ? (currentTime / knownTotalDuration) * 100 : 0;

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      onContextMenu={(e) => e.preventDefault()}
      className={`fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-50 animate-pop-in ${
        isFullscreen ? 'p-0' : 'p-0 sm:p-4'
      }`}
    >
      {/* Hidden local subtitle file selector */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt,.ass,.ssa,.sbv,.sub,.lrc,.ttml,.dfxp,.xml"
        onChange={(e) => {
          handleLocalSubtitleUpload(e);
          setActiveMenu(null);
        }}
        className="hidden"
      />

      {/* Main Player Card */}
      <div
        ref={playerContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (isPlaying && !activeMenu) setIsControlsVisible(false);
        }}
        className={`relative flex flex-col bg-[#050608] transition-all duration-300 select-none overflow-hidden ${
          isFullscreen
            ? 'w-screen h-screen rounded-none border-0'
            : 'w-full h-full sm:h-auto sm:max-w-5xl rounded-none sm:rounded-3xl border-0 sm:border border-white/[0.08] shadow-[0_25px_70px_rgba(0,0,0,0.95)]'
        }`}
      >
        {/* Subtle top ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-28 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />

        {/* Top Header Bar (Floating & Auto-Hiding) */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (activeMenu) setActiveMenu(null);
            resetControlsTimer(true);
          }}
          className={`absolute top-0 left-0 right-0 z-30 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
            isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Back Button & Title Metadata */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 overflow-hidden mr-2 sm:mr-4 min-w-0">
            {/* Back Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-gray-300 hover:text-white flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-sm"
              title="Back to Library (Esc)"
            >
              <Icons.Back className="w-4 h-4" />
            </button>

            {/* Title & Metadata Pills */}
            <div className="min-w-0">
              <h2
                className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate drop-shadow max-w-[180px] sm:max-w-md"
                title={video.name}
              >
                {parsedMedia.cleanTitle}
              </h2>
              <div className="flex items-center space-x-1.5 sm:space-x-2 text-[10px] text-gray-400 mt-0.5 font-mono">
                {parsedMedia.isEpisode ? (
                  <span className="text-cyan-400 font-semibold shrink-0">
                    {parsedMedia.displayState}
                  </span>
                ) : parsedMedia.year ? (
                  <span className="text-gray-400 shrink-0">
                    {parsedMedia.year}
                  </span>
                ) : null}
                {video.videoMediaMetadata?.height && (
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${
                      video.videoMediaMetadata.height >= 2160
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : video.videoMediaMetadata.height >= 1080
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                        : 'bg-white/[0.08] text-gray-300 border-white/[0.05]'
                    }`}
                  >
                    {video.videoMediaMetadata.height >= 2160
                      ? '4K UHD'
                      : video.videoMediaMetadata.height >= 1080
                      ? '1080p'
                      : `${video.videoMediaMetadata.height}p`}
                  </span>
                )}
                <span className="hidden sm:inline text-gray-500">•</span>
                <span className="hidden sm:inline-flex items-center space-x-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Direct Stream</span>
                </span>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Keyboard Shortcuts Button - Desktop Only */}
            <button
              onClick={() => setShowHotkeysModal(true)}
              title="Keyboard Shortcuts (?)"
              className="hidden sm:flex w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-gray-300 hover:text-white items-center justify-center transition-colors"
            >
              <Icons.Keyboard className="w-4 h-4" />
            </button>

            {/* Copy Stream Link */}
            <button
              onClick={handleCopyLink}
              title="Copy stream URL for VLC or MPV"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-gray-300 hover:text-white text-xs font-medium transition-colors flex items-center space-x-1 sm:space-x-1.5"
            >
              {copiedUrl ? (
                <>
                  <Icons.Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px] sm:text-xs">Copied!</span>
                </>
              ) : (
                <>
                  <Icons.Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">VLC / MPV Link</span>
                </>
              )}
            </button>

            {/* Close Button on Desktop */}
            <button
              onClick={onClose}
              className="hidden sm:flex w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-red-500/20 hover:text-red-400 border border-white/[0.06] text-gray-300 items-center justify-center transition-colors"
              title="Close Player (Esc)"
            >
              <Icons.Close className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div
          className={`relative w-full bg-black flex items-center justify-center overflow-hidden cursor-pointer ${
            isFullscreen ? 'flex-1 h-full' : 'flex-1 sm:flex-none sm:aspect-video'
          }`}
          onTouchStart={handleCanvasTouchStart}
          onTouchEnd={handleCanvasTouchEnd}
          onClick={() => handleScreenTap('click')}
          onContextMenu={(e) => e.preventDefault()}
        >
          <video
            ref={videoRef}
            src={currentStreamUrl}
            controls={false}
            autoPlay
            playsInline
            preload="auto"
            style={getVideoStyle()}
            onContextMenu={(e) => e.preventDefault()}
            onLoadStart={handleLoadStart}
            onCanPlay={handleCanPlay}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdate}
            onProgress={updateBuffered}
            onError={handleError}
            className="focus:outline-none pointer-events-none"
          >
            Your browser does not support the video tag.
          </video>

          {/* Mobile Center Quick Controls (Rewind 10s, Big Play/Pause, Forward 10s) */}
          <div
            className={`sm:hidden absolute inset-0 flex items-center justify-center space-x-6 pointer-events-none transition-opacity duration-200 z-25 ${
              isControlsVisible && !isBuffering ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                seekTo(Math.max(0, currentTime - 10));
                resetControlsTimer(true);
              }}
              className="pointer-events-auto w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg"
              title="Rewind 10s"
            >
              <Icons.Rewind10 className="w-5 h-5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
                resetControlsTimer(true);
              }}
              className="pointer-events-auto w-15 h-15 rounded-full bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-md border border-white/25 text-white flex items-center justify-center active:scale-95 transition-transform shadow-2xl"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Icons.Pause className="w-7 h-7" />
              ) : (
                <Icons.Play className="w-7 h-7 ml-0.5" />
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                seekTo(Math.min(knownTotalDuration > 0 ? knownTotalDuration : Infinity, currentTime + 10));
                resetControlsTimer(true);
              }}
              className="pointer-events-auto w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg"
              title="Forward 10s"
            >
              <Icons.Forward10 className="w-5 h-5" />
            </button>
          </div>

          {/* Center Screen Animated Splash Icon (Play / Pause Ripple on Desktop) */}
          {splashIcon && (
            <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none z-30">
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl animate-pop-in">
                {splashIcon === 'play' ? (
                  <Icons.Play className="w-8 h-8 ml-1" />
                ) : (
                  <Icons.Pause className="w-8 h-8" />
                )}
              </div>
            </div>
          )}

          {/* Guaranteed Netflix-grade On-Screen Subtitle Banner */}
          {activeCueText && selectedSubtitleId !== 'off' && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 pointer-events-none z-30 max-w-[92%] sm:max-w-[85%] text-center px-2 sm:px-4 transition-all duration-200 ${
                isControlsVisible ? 'bottom-26 sm:bottom-24' : 'bottom-6 sm:bottom-12'
              }`}
            >
              <span
                className={`inline-block px-3.5 sm:px-4 py-1 sm:py-1.5 rounded-xl bg-black/85 backdrop-blur-xs text-white font-semibold leading-relaxed tracking-wide shadow-2xl border border-white/10 select-none whitespace-pre-wrap ${
                  subtitleSize === 'large' ? 'text-base sm:text-2xl' : 'text-xs sm:text-lg'
                }`}
                style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
              >
                {activeCueText}
              </span>
            </div>
          )}

          {/* Aspect Ratio HUD Toast */}
          {showAspectToast && (
            <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-xl border border-indigo-500/40 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xl animate-pop-in flex items-center space-x-2 pointer-events-none">
              <Icons.Aspect className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showAspectToast}</span>
            </div>
          )}

          {/* Resume Playback HUD Toast */}
          {showResumeToast && initialTime > 5 && (
            <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-40 bg-black/90 backdrop-blur-xl border border-indigo-500/40 text-white text-[11px] sm:text-xs px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full shadow-2xl animate-pop-in flex items-center space-x-2 pointer-events-auto whitespace-nowrap max-w-[92%]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-gray-200 font-medium whitespace-nowrap">
                Resumed from <span className="font-mono text-indigo-300 font-semibold">{formatTimestamp(initialTime)}</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  seekTo(0);
                  setShowResumeToast(false);
                }}
                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-[10px] font-semibold transition-colors shrink-0"
              >
                Start Over
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowResumeToast(false);
                }}
                className="text-gray-400 hover:text-white text-xs pl-0.5 shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Buffering Indicator */}
          {isBuffering && !playbackError && (
            <div className="absolute inset-0 z-35 flex flex-col items-center justify-center bg-black/70 pointer-events-none backdrop-blur-xs">
              <Loader size="lg" />
              <p className="text-xs font-medium text-gray-200 mt-4 tracking-wide font-mono">
                Streaming from Google Drive...
              </p>
            </div>
          )}

          {/* Error State Overlay */}
          {playbackError && (
            <div
              className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 text-center bg-[#07090e]/95 max-w-md mx-auto my-auto rounded-3xl border border-red-500/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4 border border-red-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-base font-bold text-white mb-2">Streaming Playback Error</h3>
              <p className="text-xs text-red-300 mb-5 leading-relaxed">{playbackError.message}</p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
                <button
                  onClick={() => {
                    setPlaybackError(null);
                    if (videoRef.current) videoRef.current.load();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-all shadow"
                >
                  Retry Playback
                </button>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-medium transition-all shadow"
                >
                  {copiedUrl ? 'Copied VLC Link!' : 'Open in VLC / MPV'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Floating Glass Bottom Controls Overlay */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 p-2 sm:p-4 pb-3 sm:pb-5 bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-300 ${
            isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (activeMenu) setActiveMenu(null);
            resetControlsTimer(true);
          }}
          onTouchStart={() => resetControlsTimer(true)}
        >
          {/* Inner Floating Capsule */}
          <div className="bg-[#090c14]/90 sm:bg-[#090c14]/85 backdrop-blur-2xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-2 sm:px-4 sm:py-3 shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative">
            {/* 1. Scrubber & Time Preview */}
            <div className="relative mb-2 sm:mb-2.5">
              {/* Hover Tooltip Timestamp */}
              {hoverTime !== null && knownTotalDuration > 0 && (
                <div
                  className="absolute -top-8 -translate-x-1/2 bg-black/90 text-white font-mono text-[11px] px-2 py-0.5 rounded-lg border border-white/20 pointer-events-none shadow-xl backdrop-blur-md whitespace-nowrap"
                  style={{ left: `${hoverPosition}%` }}
                >
                  {formatTimestamp(hoverTime)}
                </div>
              )}

              {/* Scrubber Bar Track */}
              <div
                ref={scrubberContainerRef}
                onClick={handleScrubberClick}
                onMouseMove={handleScrubberMouseMove}
                onMouseLeave={handleScrubberMouseLeave}
                className="relative h-1.5 hover:h-2 rounded-full cursor-pointer transition-all duration-150 overflow-hidden group flex items-center bg-white/[0.12]"
              >
                {/* Buffered Lookahead Bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-white/[0.22] rounded-full transition-all duration-150 pointer-events-none"
                  style={{ width: `${Math.min(100, Math.max(progressPercent, bufferedPercent))}%` }}
                />

                {/* Played Progress Gradient Bar */}
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-400 rounded-full transition-all duration-75 relative shadow-[0_0_12px_rgba(99,102,241,0.6)] z-10 pointer-events-none"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Native Accessible Range Input Overlaid */}
              <input
                type="range"
                min="0"
                max={knownTotalDuration > 0 ? knownTotalDuration : 1}
                step="0.5"
                value={knownTotalDuration > 0 ? currentTime : 0}
                disabled={knownTotalDuration <= 0}
                onChange={(e) => {
                  resetControlsTimer(true);
                  seekTo(parseFloat(e.target.value));
                }}
                className="scrubber-slider absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* 2. Responsive Single Toolbar Row */}
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {/* Left Transport Line: Play, Skip, Volume, Time */}
              <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 min-w-0">
                {/* Play / Pause Toggle */}
                <button
                  onClick={togglePlay}
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Icons.Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <Icons.Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5" />
                  )}
                </button>

                {/* Rewind 10s (Hidden on small mobile <420px; center screen buttons always present) */}
                <button
                  onClick={() => seekTo(Math.max(0, currentTime - 10))}
                  className="hidden min-[420px]:flex sm:flex w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white items-center justify-center transition-all shrink-0"
                  title="Rewind 10s (Left Arrow)"
                >
                  <Icons.Rewind10 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {/* Fast-Forward 10s */}
                <button
                  onClick={() => seekTo(Math.min(knownTotalDuration > 0 ? knownTotalDuration : Infinity, currentTime + 10))}
                  className="hidden min-[420px]:flex sm:flex w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white items-center justify-center transition-all shrink-0"
                  title="Forward 10s (Right Arrow)"
                >
                  <Icons.Forward10 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {/* Volume & Mute (Desktop Only: mobile uses hardware rocker) */}
                <div
                  className="hidden sm:flex relative items-center space-x-1"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                        setIsMuted(!isMuted);
                      }
                    }}
                    className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                    title="Mute / Unmute (M)"
                  >
                    {isMuted || volume === 0 ? (
                      <Icons.VolumeMute className="w-4 h-4 text-red-400" />
                    ) : (
                      <Icons.VolumeHigh className="w-4 h-4" />
                    )}
                  </button>

                  {/* Expandable Volume Slider */}
                  <div
                    className={`transition-all duration-200 overflow-hidden flex items-center ${
                      showVolumeSlider ? 'w-20 opacity-100 mr-2' : 'w-0 opacity-0'
                    }`}
                  >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setVolume(v);
                        if (videoRef.current) {
                          videoRef.current.volume = v;
                          videoRef.current.muted = v === 0;
                        }
                        setIsMuted(v === 0);
                      }}
                      className="volume-slider w-full"
                    />
                  </div>
                </div>

                {/* Time Display */}
                <div className="font-mono text-[10px] sm:text-xs text-gray-300 flex items-center space-x-1 pl-1 select-none whitespace-nowrap">
                  <span className="text-white font-medium">{formatTimestamp(currentTime)}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-gray-400">
                    {knownTotalDuration > 0 ? formatTimestamp(knownTotalDuration) : isProbingTracks ? '...' : '--:--'}
                  </span>
                </div>
              </div>

              {/* Right Media Controls: Audio, Subtitles, Speed, Aspect & Fullscreen */}
              <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
                {/* Audio Menu Trigger & Popover */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu((prev) => (prev === 'audio' ? null : 'audio'));
                    }}
                    className={`h-7 sm:h-8 w-7 sm:w-auto px-0 sm:px-2.5 rounded-xl border text-[11px] sm:text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors ${
                      activeMenu === 'audio'
                        ? 'bg-indigo-600/30 text-white border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-gray-300 hover:text-white'
                    }`}
                    title="Audio Tracks"
                  >
                    <Icons.Audio className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="hidden md:inline max-w-[110px] truncate">{audioButtonLabel}</span>
                    <Icons.ChevronUp className={`w-3 h-3 text-gray-400 transition-transform hidden sm:inline ${activeMenu === 'audio' ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Audio Popover */}
                  {activeMenu === 'audio' && (
                    <div
                      className="absolute bottom-full right-0 mb-3 w-64 max-w-[calc(100vw-24px)] max-h-72 overflow-y-auto glass-panel rounded-2xl p-2.5 shadow-2xl z-50 animate-pop-in border border-white/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-2.5 py-1.5 mb-1.5 border-b border-white/[0.08]">
                        <span className="text-xs font-semibold text-white tracking-wide flex items-center space-x-1.5">
                          <Icons.Audio className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Audio Tracks</span>
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {audioTracks.length > 0 ? `${audioTracks.length} tracks` : ''}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {audioTracks.length > 0 ? (
                          audioTracks.map((track) => {
                            const isSelected = selectedAudioIndex === track.id.toString();
                            return (
                              <button
                                key={track.id}
                                onClick={() => {
                                  handleAudioTrackChange(track.id.toString());
                                  setActiveMenu(null);
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                  isSelected
                                    ? 'bg-indigo-600/30 text-white border border-indigo-500/40 font-medium'
                                    : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                                }`}
                              >
                                <div className="flex items-center space-x-2 truncate min-w-0 pr-2">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,1)]' : 'bg-transparent'}`} />
                                  <span className="truncate">{track.label}</span>
                                </div>
                                {track.codec && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-gray-400 shrink-0 uppercase">
                                    {track.codec}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-center py-4 text-xs text-gray-400">
                            {isProbingTracks ? 'Detecting audio streams...' : 'Default Audio Track'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Subtitles Menu Trigger & Popover */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu((prev) => (prev === 'subtitles' ? null : 'subtitles'));
                    }}
                    className={`h-7 sm:h-8 w-7 sm:w-auto px-0 sm:px-2.5 rounded-xl border text-[11px] sm:text-xs font-medium relative flex items-center justify-center space-x-1.5 transition-colors ${
                      activeMenu === 'subtitles'
                        ? 'bg-emerald-600/30 text-white border-emerald-500/50 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                        : selectedSubtitleId !== 'off'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-gray-300 hover:text-white'
                    }`}
                    title="Subtitles & Captions"
                  >
                    <Icons.Subtitle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="hidden md:inline max-w-[100px] truncate">{subtitleButtonLabel}</span>
                    {selectedSubtitleId !== 'off' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,1)] shrink-0 sm:hidden absolute top-1 right-1" />
                    )}
                    <Icons.ChevronUp className={`w-3 h-3 text-gray-400 transition-transform hidden sm:inline ${activeMenu === 'subtitles' ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Subtitles Popover */}
                  {activeMenu === 'subtitles' && (
                    <div
                      className="absolute bottom-full right-0 mb-3 w-72 max-w-[calc(100vw-24px)] max-h-88 overflow-y-auto glass-panel rounded-2xl p-2.5 shadow-2xl z-50 animate-pop-in border border-white/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-2.5 py-1.5 mb-1.5 border-b border-white/[0.08]">
                        <span className="text-xs font-semibold text-white tracking-wide flex items-center space-x-1.5">
                          <Icons.Subtitle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Subtitles</span>
                        </span>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[10px] text-emerald-300 hover:text-white font-medium flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                        >
                          <Icons.Upload className="w-3 h-3" />
                          <span>Upload</span>
                        </button>
                      </div>

                      {/* Off Option */}
                      <button
                        onClick={() => {
                          handleSubtitleChange('off');
                          setActiveMenu(null);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors mb-1 ${
                          selectedSubtitleId === 'off'
                            ? 'bg-emerald-600/30 text-white border border-emerald-500/40 font-medium'
                            : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedSubtitleId === 'off' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]' : 'bg-transparent'}`} />
                          <span>Subtitles Off</span>
                        </div>
                        {selectedSubtitleId === 'off' && <Icons.Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </button>

                      {/* Tracks List */}
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {subtitleTracks.length > 0 ? (
                          subtitleTracks.map((sub) => {
                            const isSelected = selectedSubtitleId === sub.id.toString();
                            return (
                              <button
                                key={sub.id}
                                onClick={() => {
                                  handleSubtitleChange(sub.id.toString());
                                  setActiveMenu(null);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600/30 text-white border border-emerald-500/40 font-medium'
                                    : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                                }`}
                              >
                                <div className="flex items-center space-x-2 truncate min-w-0 pr-2">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]' : 'bg-transparent'}`} />
                                  <span className="truncate">{sub.label}</span>
                                </div>
                                {isSelected && <Icons.Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-center py-3 text-xs text-gray-400">
                            {isProbingTracks ? 'Detecting subtitle tracks...' : 'No embedded subtitles found'}
                          </div>
                        )}
                      </div>

                      {/* Subtitle Fine Tuning Controls */}
                      {selectedSubtitleId !== 'off' && (
                        <div className="pt-2 mt-2 border-t border-white/[0.08] space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                            <span>Timing Sync:</span>
                            <span className="font-mono text-emerald-300 font-semibold">
                              {subtitleOffset === 0 ? '0.0s (In Sync)' : `${subtitleOffset > 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s`}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => setSubtitleOffset((prev) => Math.max(-10, Math.round((prev - 0.5) * 10) / 10))}
                              className="flex-1 py-1 px-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-gray-300 hover:text-white transition-colors font-mono"
                              title="Earlier 0.5s"
                            >
                              −0.5s
                            </button>
                            <button
                              onClick={() => setSubtitleOffset(0)}
                              disabled={subtitleOffset === 0}
                              className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 border border-white/[0.08] text-xs text-gray-300 hover:text-white transition-colors font-mono"
                              title="Reset to 0.0s"
                            >
                              Reset
                            </button>
                            <button
                              onClick={() => setSubtitleOffset((prev) => Math.min(10, Math.round((prev + 0.5) * 10) / 10))}
                              className="flex-1 py-1 px-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-gray-300 hover:text-white transition-colors font-mono"
                              title="Later 0.5s"
                            >
                              +0.5s
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1 px-1">
                            <span className="text-[11px] text-gray-400">Size:</span>
                            <div className="flex items-center space-x-1 bg-white/[0.05] p-0.5 rounded-lg border border-white/[0.08]">
                              <button
                                onClick={() => setSubtitleSize('normal')}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                  subtitleSize === 'normal'
                                    ? 'bg-emerald-600 text-white font-medium shadow'
                                    : 'text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                Normal
                              </button>
                              <button
                                onClick={() => setSubtitleSize('large')}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                  subtitleSize === 'large'
                                    ? 'bg-emerald-600 text-white font-medium shadow'
                                    : 'text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                Large
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Speed Menu Trigger & Popover */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu((prev) => (prev === 'speed' ? null : 'speed'));
                    }}
                    className={`h-7 sm:h-8 px-1.5 sm:px-2 rounded-xl border text-[10px] sm:text-xs font-mono font-medium flex items-center justify-center transition-colors ${
                      activeMenu === 'speed'
                        ? 'bg-amber-500/30 text-white border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                        : playbackSpeed !== 1
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-gray-300 hover:text-white'
                    }`}
                    title="Playback Speed"
                  >
                    <span>{playbackSpeed}x</span>
                  </button>

                  {/* Speed Popover */}
                  {activeMenu === 'speed' && (
                    <div
                      className="absolute bottom-full right-0 mb-3 w-40 max-w-[calc(100vw-24px)] glass-panel rounded-2xl p-2 shadow-2xl z-50 animate-pop-in border border-white/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2.5 py-1 mb-1 border-b border-white/[0.08] text-xs font-semibold text-white flex items-center space-x-1.5">
                        <Icons.Speed className="w-3.5 h-3.5 text-amber-400" />
                        <span>Playback Speed</span>
                      </div>
                      <div className="space-y-0.5">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => {
                          const isSelected = playbackSpeed === speed;
                          return (
                            <button
                              key={speed}
                              onClick={() => handleSpeedChange(speed)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                                  : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                              }`}
                            >
                              <span>{speed === 1 ? '1.0x (Normal)' : `${speed}x`}</span>
                              {isSelected && <Icons.Check className="w-3.5 h-3.5 text-amber-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Aspect Ratio Button */}
                <button
                  onClick={cycleAspectRatio}
                  className="w-7 h-7 sm:w-auto sm:h-8 px-0 sm:px-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-300 hover:text-white text-[11px] sm:text-xs font-medium flex items-center justify-center transition-colors shrink-0"
                  title="Cycle Aspect Ratio (C or A)"
                >
                  <Icons.Aspect className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden lg:inline capitalize ml-1">{aspectRatio}</span>
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
                  title="Toggle Fullscreen (F)"
                >
                  {isFullscreen ? (
                    <Icons.ExitFullscreen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <Icons.Fullscreen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      {showHotkeysModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-pop-in"
          onClick={() => setShowHotkeysModal(false)}
        >
          <div
            className="glass-card rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.08]">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Icons.Keyboard className="w-4 h-4 text-indigo-400" />
                <span>Keyboard Shortcuts</span>
              </h3>
              <button
                onClick={() => setShowHotkeysModal(false)}
                className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-gray-400 hover:text-white flex items-center justify-center transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { key: 'Space', desc: 'Play / Pause' },
                { key: '← / →', desc: 'Rewind / Forward 10s' },
                { key: '↑ / ↓', desc: 'Volume Up / Down' },
                { key: 'M', desc: 'Mute / Unmute' },
                { key: 'F', desc: 'Toggle Fullscreen' },
                { key: 'C or A', desc: 'Cycle Aspect Ratio' },
                { key: 'Esc', desc: 'Close Menu / Exit Fullscreen' },
                { key: '?', desc: 'Toggle Shortcuts Help' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] text-gray-300">
                  <span className="text-gray-400">{item.desc}</span>
                  <kbd className="px-2 py-0.5 bg-white/[0.08] border border-white/10 rounded-lg font-mono text-[11px] text-white shadow-sm">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
