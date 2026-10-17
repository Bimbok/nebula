import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleDriveFile, AudioTrackInfo, SubtitleTrackInfo } from '../types';
import Loader from './Loader';

interface VideoPlayerProps {
  video: GoogleDriveFile;
  onClose: () => void;
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
};

function convertSrtToVtt(srtText: string): string {
  let vtt = 'WEBVTT\n\n';
  vtt += srtText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt;
}

function parseWebVttCues(vttText: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const parseTime = (str: string): number => {
    if (!str) return 0;
    const parts = str.trim().split(':');
    if (parts.length === 3) {
      return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
    }
    if (parts.length === 2) {
      return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
    }
    return parseFloat(parts[0]) || 0;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const match = line.split('-->');
      if (match.length >= 2) {
        const start = parseTime(match[0].trim().split(/\s+/)[0]);
        const end = parseTime(match[1].trim().split(/\s+/)[0]);

        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          const cleaned = lines[i]
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
    } else {
      i++;
    }
  }

  return cues;
}

const aspectModes: { key: AspectRatioMode; label: string; icon: string }[] = [
  { key: 'fit', label: 'Fit (Original)', icon: '⊡' },
  { key: 'crop', label: 'Crop (Zoom to Fill)', icon: '✂' },
  { key: 'stretch', label: 'Stretch (Full)', icon: '↔' },
  { key: '21:9', label: '21:9 (Cinemascope)', icon: '🎬' },
  { key: '16:9', label: '16:9 (Widescreen)', icon: '📺' },
  { key: '4:3', label: '4:3 (Classic)', icon: '📼' },
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

const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const scrubberContainerRef = useRef<HTMLDivElement>(null);
  const subtitleAbortRef = useRef<AbortController | null>(null);

  // Streaming & Playback States
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [probedDuration, setProbedDuration] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackError, setPlaybackError] = useState<{ message: string; code?: number } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [mimeOverride, setMimeOverride] = useState<string | null>(null);

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

  // Scrubber Hover Tooltip
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Audio & Subtitle Tracks
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<string>('default');
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('off');
  const [isProbingTracks, setIsProbingTracks] = useState<boolean>(true);
  const [isSubtitleLoading, setIsSubtitleLoading] = useState<boolean>(false);
  const [resumeTime, setResumeTime] = useState<number>(0);
  const [subtitleSize, setSubtitleSize] = useState<'normal' | 'large'>('normal');

  // Subtitle cue parser cache & active cue
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);

  // Token
  const token = window.gapi?.client?.getToken?.()?.access_token || '';

  // Calculate True Total Duration
  const knownTotalDuration =
    probedDuration > 0
      ? probedDuration
      : video.videoMediaMetadata?.durationMillis
      ? parseInt(video.videoMediaMetadata.durationMillis, 10) / 1000
      : 0;

  // Stream URL calculation
  const targetMime = mimeOverride || video.mimeType || 'video/mp4';

  let currentStreamUrl = `/api/stream?fileId=${video.id}&token=${encodeURIComponent(token)}`;
  if (selectedAudioIndex !== 'default') {
    currentStreamUrl += `&audioIndex=${selectedAudioIndex}&startTime=${Math.floor(resumeTime)}`;
  } else {
    currentStreamUrl += `&mimeType=${encodeURIComponent(targetMime)}`;
  }

  const absoluteStreamUrl = typeof window !== 'undefined' ? `${window.location.origin}${currentStreamUrl}` : currentStreamUrl;

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

  // 2. Fetch and parse WebVTT cues incrementally
  useEffect(() => {
    subtitleAbortRef.current?.abort();

    if (selectedSubtitleId === 'off') {
      setSubtitleCues([]);
      setActiveCueText(null);
      setIsSubtitleLoading(false);
      return;
    }

    const controller = new AbortController();
    subtitleAbortRef.current = controller;
    const isCurrentRequest = () => subtitleAbortRef.current === controller && !controller.signal.aborted;

    // Never leave the preceding track on-screen while this track is loading.
    setSubtitleCues([]);
    setActiveCueText(null);

    const loadSubtitles = async () => {
      setIsSubtitleLoading(true);
      try {
        const matched = subtitleTracks.find((s) => s.id.toString() === selectedSubtitleId);
        if (!matched) return;

        if (matched.isCustom && matched.blobUrl) {
          const res = await fetch(matched.blobUrl, { signal: controller.signal });
          const vttText = await res.text();
          if (isCurrentRequest() && vttText) {
            setSubtitleCues(parseWebVttCues(vttText));
          }
          return;
        }

        const isBitmapParam = matched.isBitmap ? '&isBitmap=true' : '';
        const subUrl = `/api/subtitles?fileId=${video.id}&streamIndex=${matched.streamIndex}&token=${encodeURIComponent(token)}${isBitmapParam}`;
        const res = await fetch(subUrl, { signal: controller.signal });
        if (!res.ok) throw new Error('Subtitle fetch failed');

        if (!res.body) {
          const vttText = await res.text();
          if (isCurrentRequest() && vttText) {
            setSubtitleCues(parseWebVttCues(vttText));
          }
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let receivedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (!isCurrentRequest()) break;

          if (value) {
            receivedText += decoder.decode(value, { stream: !done });
            const cues = parseWebVttCues(receivedText);
            if (cues.length > 0) {
              setSubtitleCues(cues);
            }
          }

          if (done) {
            receivedText += decoder.decode();
            if (receivedText) {
              setSubtitleCues(parseWebVttCues(receivedText));
            }
            break;
          }
        }
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError') {
          console.error('Failed to load subtitles:', err);
        }
      } finally {
        if (isCurrentRequest()) {
          setIsSubtitleLoading(false);
        }
      }
    };

    loadSubtitles();

    return () => {
      controller.abort();
    };
  }, [selectedSubtitleId, subtitleTracks, video.id, token]);

  // Keep captions tied to the timestamp of the frame actually being presented.
  // `timeupdate` is deliberately throttled by browsers (often to 4Hz), which
  // made captions visibly late and especially noticeable after a seek.
  useEffect(() => {
    if (subtitleCues.length === 0 || selectedSubtitleId === 'off') {
      setActiveCueText(null);
      return;
    }

    const player = videoRef.current;
    if (!player) return;

    const updateCue = (time: number) => {
      const text = subtitleCues
        .filter((cue) => time >= cue.start && time < cue.end)
        .map((cue) => cue.text)
        .join('\n') || null;
      setActiveCueText((previous) => (previous === text ? previous : text));
    };

    const onSeeked = () => updateCue(player.currentTime + (selectedAudioIndex !== 'default' ? resumeTime : 0));
    onSeeked();
    player.addEventListener('seeked', onSeeked);

    type FrameCallbackVideo = HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: (_now: number, metadata: { mediaTime: number }) => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    const framePlayer = player as FrameCallbackVideo;
    let frameHandle: number | undefined;
    let fallbackTimer: number | undefined;
    const offset = selectedAudioIndex !== 'default' ? resumeTime : 0;
    const onFrame = (_now: number, metadata: { mediaTime: number }) => {
      updateCue(metadata.mediaTime + offset);
      frameHandle = framePlayer.requestVideoFrameCallback?.(onFrame);
    };

    if (framePlayer.requestVideoFrameCallback) {
      frameHandle = framePlayer.requestVideoFrameCallback(onFrame);
    } else {
      // Older browsers do not expose frame callbacks; retain a tighter fallback
      // than `timeupdate` without changing the video's playback clock.
      fallbackTimer = window.setInterval(() => onSeeked(), 50);
    }

    return () => {
      player.removeEventListener('seeked', onSeeked);
      if (frameHandle !== undefined) framePlayer.cancelVideoFrameCallback?.(frameHandle);
      if (fallbackTimer !== undefined) window.clearInterval(fallbackTimer);
    };
  }, [subtitleCues, selectedSubtitleId, selectedAudioIndex, resumeTime]);

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
      setShowAspectToast(`${nextMode.icon} ${nextMode.label}`);
      return nextMode.key;
    });
  }, []);

  useEffect(() => {
    if (!showAspectToast) return;
    const timer = setTimeout(() => setShowAspectToast(null), 1800);
    return () => clearTimeout(timer);
  }, [showAspectToast]);

  // Auto-hide controls with mouse movement detection
  const handleMouseMove = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setIsControlsVisible(false);
      }
    }, 3200);
  };

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

  // Unified Seek Handler
  const seekTo = useCallback(
    (targetSeconds: number) => {
      const clamped = Math.max(0, Math.min(knownTotalDuration > 0 ? knownTotalDuration : Infinity, targetSeconds));
      setCurrentTime(clamped);

      if (selectedAudioIndex !== 'default') {
        setResumeTime(clamped);
        setIsBuffering(true);
      } else {
        if (videoRef.current) {
          videoRef.current.currentTime = clamped;
        }
      }
    },
    [knownTotalDuration, selectedAudioIndex]
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
    if (!scrubberContainerRef.current || knownTotalDuration <= 0) return;
    const rect = scrubberContainerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pos * knownTotalDuration);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
  }, [onClose, toggleFullscreen, cycleAspectRatio, knownTotalDuration, currentTime, seekTo, togglePlay, volume, isMuted, showHotkeysModal]);

  // Audio track switching
  const handleAudioTrackChange = (newAudioIdxStr: string) => {
    if (newAudioIdxStr === selectedAudioIndex) return;
    setResumeTime(currentTime);
    setSelectedAudioIndex(newAudioIdxStr);
    setIsBuffering(true);
    setPlaybackError(null);
  };

  // Subtitle selection
  const handleSubtitleChange = (subIdStr: string) => {
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

      let vttContent = content;
      if (file.name.endsWith('.srt')) {
        vttContent = convertSrtToVtt(content);
      }

      const blob = new Blob([vttContent], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);

      const newTrack: SubtitleTrackInfo = {
        id: Date.now(),
        streamIndex: -1,
        codec: 'WebVTT',
        language: 'custom',
        label: `File: ${file.name}`,
        isCustom: true,
        blobUrl: blobUrl,
      };

      setSubtitleTracks((prev) => [...prev, newTrack]);
      setSelectedSubtitleId(newTrack.id.toString());
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Video event handlers
  const handleLoadStart = () => {
    setIsBuffering(true);
    setPlaybackError(null);
  };

  const handleCanPlay = () => {
    setIsBuffering(false);
    if (selectedAudioIndex === 'default' && resumeTime > 0 && videoRef.current) {
      videoRef.current.currentTime = resumeTime;
      setResumeTime(0);
    }
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const offset = selectedAudioIndex !== 'default' ? resumeTime : 0;
      setCurrentTime(offset + videoRef.current.currentTime);
    }
  };

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

  const progressPercent = knownTotalDuration > 0 ? (currentTime / knownTotalDuration) * 100 : 0;

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-50 animate-pop-in ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-4'
      }`}
    >
      {/* Main Player Card */}
      <div
        ref={playerContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (isPlaying) setIsControlsVisible(false);
        }}
        className={`relative flex flex-col bg-[#050608] transition-all duration-300 select-none overflow-hidden ${
          isFullscreen
            ? 'w-screen h-screen rounded-none border-0'
            : 'w-full max-w-5xl rounded-3xl border border-white/[0.08] shadow-[0_25px_70px_rgba(0,0,0,0.95)]'
        }`}
      >
        {/* Subtle top ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-28 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />

        {/* Top Header Bar (Floating & Auto-Hiding) */}
        <div
          className={`absolute top-0 left-0 right-0 z-30 px-4 sm:px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
            isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Title & Metadata */}
          <div className="flex items-center space-x-3 overflow-hidden mr-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="truncate">
              <h2 className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate drop-shadow" title={video.name}>
                {video.name}
              </h2>
              <div className="flex items-center space-x-2 text-[10px] text-gray-400 mt-0.5 font-mono">
                {video.videoMediaMetadata?.height && (
                  <span className="bg-white/[0.08] text-indigo-300 px-1.5 py-0.5 rounded border border-white/[0.05]">
                    {video.videoMediaMetadata.height >= 2160
                      ? '4K UHD'
                      : video.videoMediaMetadata.height >= 1080
                      ? '1080p'
                      : `${video.videoMediaMetadata.height}p`}
                  </span>
                )}
                {selectedAudioIndex !== 'default' && (
                  <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                    320k Remux
                  </span>
                )}
                <span>HTTP Range</span>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Keyboard Shortcuts Button */}
            <button
              onClick={() => setShowHotkeysModal(true)}
              title="Keyboard Shortcuts (?)"
              className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <Icons.Keyboard className="w-4 h-4" />
            </button>

            {/* Copy Stream Link */}
            <button
              onClick={handleCopyLink}
              title="Copy stream URL for VLC or MPV"
              className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] text-gray-300 hover:text-white text-xs font-medium transition-colors flex items-center space-x-1.5"
            >
              {copiedUrl ? (
                <>
                  <Icons.Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Icons.Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">VLC / MPV Link</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-red-500/30 border border-white/[0.06] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
              title="Close Player (Esc)"
            >
              <Icons.Close className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div
          className={`relative w-full bg-black flex items-center justify-center overflow-hidden ${
            isFullscreen ? 'flex-1 h-full' : 'aspect-video'
          }`}
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            key={currentStreamUrl}
            src={currentStreamUrl}
            controls={false}
            autoPlay
            playsInline
            preload="metadata"
            style={getVideoStyle()}
            onLoadStart={handleLoadStart}
            onCanPlay={handleCanPlay}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdate}
            onError={handleError}
            className="focus:outline-none cursor-pointer"
          >
            Your browser does not support the video tag.
          </video>

          {/* Center Screen Animated Splash Icon (Play / Pause Ripple) */}
          {splashIcon && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
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
              className={`absolute left-1/2 -translate-x-1/2 pointer-events-none z-30 max-w-[85%] text-center px-4 transition-all duration-200 ${
                isControlsVisible ? 'bottom-28 sm:bottom-24' : 'bottom-12 sm:bottom-16'
              }`}
            >
              <span
                className={`inline-block px-4 py-1.5 rounded-xl bg-black/80 backdrop-blur-xs text-white font-semibold leading-relaxed tracking-wide shadow-2xl border border-white/10 select-none whitespace-pre-wrap ${
                  subtitleSize === 'large' ? 'text-lg sm:text-2xl' : 'text-sm sm:text-lg'
                }`}
                style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
              >
                {activeCueText}
              </span>
            </div>
          )}

          {/* Aspect Ratio HUD Toast */}
          {showAspectToast && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-xl border border-indigo-500/40 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xl animate-pop-in flex items-center space-x-2">
              <span>{showAspectToast}</span>
            </div>
          )}

          {/* Buffering Indicator */}
          {isBuffering && !playbackError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 pointer-events-none backdrop-blur-xs">
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
                {audioTracks.length > 0 && (
                  <button
                    onClick={() => handleAudioTrackChange('0')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-all shadow"
                  >
                    Play with 320k Audio Remux
                  </button>
                )}
                <button
                  onClick={() => {
                    setMimeOverride('video/webm');
                    if (videoRef.current) videoRef.current.load();
                  }}
                  className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl text-xs font-medium transition-all"
                >
                  Try WebM
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
          className={`absolute bottom-0 left-0 right-0 z-30 p-3 sm:p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
            isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Inner Floating Capsule */}
          <div className="bg-[#0b0e17]/85 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-3 sm:p-4 shadow-[0_15px_35px_rgba(0,0,0,0.8)]">
            {/* 1. Scrubber & Time Preview */}
            <div className="relative mb-3">
              {/* Hover Tooltip Timestamp */}
              {hoverTime !== null && knownTotalDuration > 0 && (
                <div
                  className="absolute -top-7 -translate-x-1/2 bg-black/90 text-white font-mono text-[10px] px-2 py-0.5 rounded border border-white/20 pointer-events-none shadow"
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
                className="relative h-2 bg-white/[0.1] hover:h-2.5 rounded-full cursor-pointer transition-all duration-200 overflow-hidden group flex items-center"
              >
                {/* Played Progress Gradient Bar */}
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-400 rounded-full transition-all duration-75 relative shadow-[0_0_10px_rgba(99,102,241,0.5)]"
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
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="scrubber-slider absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* 2. Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Playback, Skip, Volume, Time */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                {/* Play / Pause Toggle */}
                <button
                  onClick={togglePlay}
                  className="w-9 h-9 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Icons.Pause className="w-4 h-4" />
                  ) : (
                    <Icons.Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                {/* Rewind 10s */}
                <button
                  onClick={() => seekTo(Math.max(0, currentTime - 10))}
                  className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white flex items-center justify-center transition-all"
                  title="Rewind 10s (Left Arrow)"
                >
                  <Icons.Rewind10 className="w-4 h-4" />
                </button>

                {/* Fast-Forward 10s */}
                <button
                  onClick={() => seekTo(Math.min(knownTotalDuration > 0 ? knownTotalDuration : Infinity, currentTime + 10))}
                  className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white flex items-center justify-center transition-all"
                  title="Forward 10s (Right Arrow)"
                >
                  <Icons.Forward10 className="w-4 h-4" />
                </button>

                {/* Volume & Mute */}
                <div
                  className="relative flex items-center space-x-1.5"
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
                <div className="font-mono text-xs text-gray-300 flex items-center space-x-1 pl-1 select-none">
                  <span className="text-white font-medium">{formatTimestamp(currentTime)}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-gray-400">
                    {knownTotalDuration > 0 ? formatTimestamp(knownTotalDuration) : isProbingTracks ? '...' : '--:--'}
                  </span>
                </div>
              </div>

              {/* Right: Audio Selector, Subtitle Selector, Aspect, Fullscreen */}
              <div className="flex flex-wrap items-center space-x-2">
                {/* Audio Track Selector */}
                <div className="flex items-center space-x-1 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-xl px-2 py-1 transition-colors">
                  <Icons.Audio className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <select
                    value={selectedAudioIndex}
                    onChange={(e) => handleAudioTrackChange(e.target.value)}
                    disabled={isProbingTracks && audioTracks.length === 0}
                    className="bg-transparent text-gray-300 text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="default" className="bg-[#0e111a] text-gray-200">
                      Default Audio (Direct Stream)
                    </option>
                    {audioTracks.map((t) => (
                      <option key={t.id} value={t.id.toString()} className="bg-[#0e111a] text-gray-200">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subtitle Selector */}
                <div className="flex items-center space-x-1 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-xl px-2 py-1 transition-colors">
                  <Icons.Subtitle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <select
                    value={selectedSubtitleId}
                    onChange={(e) => handleSubtitleChange(e.target.value)}
                    disabled={isProbingTracks && subtitleTracks.length === 0}
                    className="bg-transparent text-gray-300 text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="off" className="bg-[#0e111a] text-gray-200">Subtitles Off</option>
                    {subtitleTracks.map((s) => (
                      <option key={s.id} value={s.id.toString()} className="bg-[#0e111a] text-gray-200">
                        {s.label}
                      </option>
                    ))}
                  </select>

                  {/* Local Subtitle Upload Trigger */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".srt,.vtt"
                    onChange={handleLocalSubtitleUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload local .srt subtitle"
                    className="text-[10px] text-gray-400 hover:text-white px-1 font-mono hover:bg-white/[0.08] rounded transition-colors"
                  >
                    +SRT
                  </button>
                </div>

                {/* Subtitle Size Toggle */}
                {selectedSubtitleId !== 'off' && (
                  <button
                    onClick={() => setSubtitleSize((prev) => (prev === 'normal' ? 'large' : 'normal'))}
                    className="px-2 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-300 hover:text-white rounded-xl text-[10px] font-mono transition-colors"
                    title="Toggle Subtitle Size"
                  >
                    {subtitleSize === 'normal' ? '1x' : '1.5x'}
                  </button>
                )}

                {/* Aspect Ratio Button */}
                <button
                  onClick={cycleAspectRatio}
                  className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-300 hover:text-white rounded-xl text-xs font-medium flex items-center space-x-1 transition-colors"
                  title="Cycle Aspect Ratio (C or A)"
                >
                  <Icons.Aspect className="w-3.5 h-3.5 text-amber-400" />
                  <span className="capitalize">{aspectRatio}</span>
                </button>

                {/* Fullscreen Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                  title="Toggle Fullscreen (F)"
                >
                  {isFullscreen ? (
                    <Icons.ExitFullscreen className="w-4 h-4" />
                  ) : (
                    <Icons.Fullscreen className="w-4 h-4" />
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
            className="bg-[#0e111a] border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Icons.Keyboard className="w-4 h-4 text-indigo-400" />
                <span>Keyboard Shortcuts</span>
              </h3>
              <button
                onClick={() => setShowHotkeysModal(false)}
                className="text-gray-400 hover:text-white text-xs p-1"
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
                { key: 'C or A', desc: 'Cycle Aspect Ratio / Fit / Crop' },
                { key: 'Esc', desc: 'Exit Fullscreen / Close' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-white/[0.04] text-gray-300">
                  <span className="text-gray-400">{item.desc}</span>
                  <kbd className="px-2 py-0.5 bg-white/[0.06] border border-white/10 rounded-md font-mono text-[11px] text-white">
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
