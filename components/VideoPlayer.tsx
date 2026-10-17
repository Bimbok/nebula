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

const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const AudioIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
  </svg>
);

const SubtitleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

const AspectRatioIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
  </svg>
);

const FullscreenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h5.25m-5.25 0v5.25m0-5.25l6 6M20.25 3.75h-5.25m5.25 0v5.25m0-5.25l-6 6M3.75 20.25h5.25m-5.25 0v-5.25m0 5.25l6-6M20.25 20.25h-5.25m5.25 0v-5.25m0 5.25l-6-6" />
  </svg>
);

const ExitFullscreenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V3.75m0 5.25H3.75m5.25 0L3 3m6 12v5.25m0-5.25H3.75m5.25 0L3 21m12-12V3.75m0 5.25h5.25m-5.25 0L21 3m-6 12v5.25m0-5.25h5.25m-5.25 0L21 21" />
  </svg>
);

// Helper to convert SRT string to WebVTT format
function convertSrtToVtt(srtText: string): string {
  let vtt = 'WEBVTT\n\n';
  vtt += srtText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt;
}

// Parser for WebVTT cues for guaranteed on-screen rendering
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
          // Strip WebVTT/HTML tags (<...>) and ASS style tags ({...})
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
  { key: 'stretch', label: 'Stretch (Fill Screen)', icon: '↔' },
  { key: '21:9', label: '21:9 (Cinemascope)', icon: '🎬' },
  { key: '16:9', label: '16:9 (Widescreen)', icon: '📺' },
  { key: '4:3', label: '4:3 (Classic TV)', icon: '📼' },
];

const formatTimestamp = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0 || !isFinite(totalSeconds)) return '0:00';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsTimeoutRef = useRef<any>(null);

  // Streaming & Playback States
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [probedDuration, setProbedDuration] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackError, setPlaybackError] = useState<{ message: string; code?: number } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [mimeOverride, setMimeOverride] = useState<string | null>(null);

  // Aspect Ratio & Fullscreen
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('fit');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showAspectToast, setShowAspectToast] = useState<string | null>(null);
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);

  // Audio & Subtitle Tracks
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<string>('default');
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('off');
  const [isProbingTracks, setIsProbingTracks] = useState<boolean>(true);
  const [isSubtitleLoading, setIsSubtitleLoading] = useState<boolean>(false);
  const [trackBlobUrl, setTrackBlobUrl] = useState<string | null>(null);
  const [resumeTime, setResumeTime] = useState<number>(0);
  const [subtitleSize, setSubtitleSize] = useState<'normal' | 'large'>('normal');

  // Subtitle cue parser cache & active cue
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);

  // Token
  const token = window.gapi?.client?.getToken?.()?.access_token || '';

  // Calculate True Total Duration
  // 1. Probed duration from ffprobe or cached metadata on disk (highest precision)
  // 2. Google Drive videoMediaMetadata.durationMillis
  // 3. Fallback to HTML5 video duration ONLY if stable and not a fragmented chunk
  const html5Duration = videoRef.current?.duration;
  const isHtml5DurationUsable =
    typeof html5Duration === 'number' &&
    isFinite(html5Duration) &&
    html5Duration > 60 &&
    html5Duration > currentTime + 10;

  const knownTotalDuration =
    probedDuration > 0
      ? probedDuration
      : video.videoMediaMetadata?.durationMillis
      ? parseInt(video.videoMediaMetadata.durationMillis, 10) / 1000
      : isHtml5DurationUsable
      ? html5Duration
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

  // 2. Fetch and parse WebVTT cues incrementally with live stream reading
  useEffect(() => {
    if (selectedSubtitleId === 'off') {
      setSubtitleCues([]);
      setActiveCueText(null);
      setIsSubtitleLoading(false);
      return;
    }

    let isCancelled = false;
    const loadSubtitles = async () => {
      setIsSubtitleLoading(true);
      try {
        const matched = subtitleTracks.find((s) => s.id.toString() === selectedSubtitleId);
        if (!matched) return;

        if (matched.isCustom && matched.blobUrl) {
          const res = await fetch(matched.blobUrl);
          const vttText = await res.text();
          if (!isCancelled && vttText) {
            setSubtitleCues(parseWebVttCues(vttText));
          }
          return;
        }

        const isBitmapParam = matched.isBitmap ? '&isBitmap=true' : '';
        const subUrl = `/api/subtitles?fileId=${video.id}&streamIndex=${matched.streamIndex}&token=${encodeURIComponent(token)}${isBitmapParam}`;
        const res = await fetch(subUrl);
        if (!res.ok) throw new Error('Subtitle fetch failed');

        if (!res.body) {
          const vttText = await res.text();
          if (!isCancelled && vttText) {
            setSubtitleCues(parseWebVttCues(vttText));
          }
          return;
        }

        // Incrementally read the incoming WebVTT stream so initial cues display immediately
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let receivedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (isCancelled) break;

          if (value) {
            receivedText += decoder.decode(value, { stream: !done });
            const cues = parseWebVttCues(receivedText);
            if (cues.length > 0) {
              setSubtitleCues(cues);
            }
          }

          if (done) {
            if (receivedText) {
              setSubtitleCues(parseWebVttCues(receivedText));
            }
            break;
          }
        }
      } catch (err) {
        console.error('Failed to load subtitles:', err);
      } finally {
        if (!isCancelled) {
          setIsSubtitleLoading(false);
        }
      }
    };

    loadSubtitles();

    return () => {
      isCancelled = true;
    };
  }, [selectedSubtitleId, subtitleTracks, video.id, token]);

  // 3. Continuous synchronization of active subtitle cue with video currentTime
  useEffect(() => {
    if (subtitleCues.length === 0 || selectedSubtitleId === 'off') {
      setActiveCueText(null);
      return;
    }

    const matched = subtitleCues.filter((c) => currentTime >= c.start && currentTime <= c.end);
    if (matched.length > 0) {
      setActiveCueText(matched.map((m) => m.text).join('\n'));
    } else {
      setActiveCueText(null);
    }
  }, [currentTime, subtitleCues, selectedSubtitleId]);

  // Generate native HTML5 track Blob URL for TV / mobile / native fullscreen support
  useEffect(() => {
    if (subtitleCues.length === 0 || selectedSubtitleId === 'off') {
      if (trackBlobUrl) {
        URL.revokeObjectURL(trackBlobUrl);
        setTrackBlobUrl(null);
      }
      return;
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatVttTime = (t: number) => {
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = (t % 60).toFixed(3);
      return `${pad(h)}:${pad(m)}:${s.padStart(6, '0')}`;
    };

    let vtt = 'WEBVTT\n\n';
    subtitleCues.forEach((cue, idx) => {
      vtt += `${idx + 1}\n${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}\n\n`;
    });

    const blob = new Blob([vtt], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    setTrackBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [subtitleCues, selectedSubtitleId]);

  // 4. Fullscreen change listener
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

  // 5. Cycle aspect ratio
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

  // Auto-hide controls in fullscreen after inactivity
  const handleMouseMove = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isFullscreen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setIsControlsVisible(false);
      }, 3500);
    }
  };

  // 6. Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
        if (v.paused) v.play();
        else v.pause();
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === 'c' || event.key === 'C' || event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        cycleAspectRatio();
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        v.muted = !v.muted;
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 10);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        v.currentTime = Math.min(knownTotalDuration || v.duration || Infinity, v.currentTime + 10);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        v.volume = Math.min(1, v.volume + 0.1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        v.volume = Math.max(0, v.volume - 0.1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, toggleFullscreen, cycleAspectRatio, knownTotalDuration]);

  // 7. Interactive Timeline Seek Handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetSeconds = parseFloat(e.target.value);
    setCurrentTime(targetSeconds);

    if (videoRef.current) {
      if (selectedAudioIndex !== 'default') {
        // Remux mode: update resumeTime and reset stream timestamp
        setResumeTime(targetSeconds);
        setIsBuffering(true);
      } else {
        videoRef.current.currentTime = targetSeconds;
      }
    }
  };

  // Audio track switching
  const handleAudioTrackChange = (newAudioIdxStr: string) => {
    if (newAudioIdxStr === selectedAudioIndex) return;

    if (videoRef.current) {
      setResumeTime(videoRef.current.currentTime);
    }
    setSelectedAudioIndex(newAudioIdxStr);
    setIsBuffering(true);
    setPlaybackError(null);
  };

  // Subtitle selection
  const handleSubtitleChange = (subIdStr: string) => {
    setSelectedSubtitleId(subIdStr);
  };

  // Local Subtitle file upload
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
        label: `Local: ${file.name}`,
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
      setCurrentTime(videoRef.current.currentTime);
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
          detail = 'Format not supported: Your browser could not natively decode this container or codec (e.g. 10-bit HEVC / AC3 audio). You can switch audio tracks below or stream via MPV/VLC.';
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

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return null;
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return null;
    if (num > 1024 * 1024 * 1024) {
      return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(num / (1024 * 1024)).toFixed(0)} MB`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(absoluteStreamUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && event.target === modalRef.current && !document.fullscreenElement) {
      onClose();
    }
  };

  // Calculate dynamic style based on chosen aspect ratio / crop mode
  const getVideoStyle = (): React.CSSProperties => {
    switch (aspectRatio) {
      case 'crop':
        return {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        };
      case 'stretch':
        return {
          width: '100%',
          height: '100%',
          objectFit: 'fill',
        };
      case '21:9':
        return {
          width: '100%',
          height: '100%',
          aspectRatio: '21 / 9',
          objectFit: 'fill',
          margin: 'auto',
        };
      case '16:9':
        return {
          width: '100%',
          height: '100%',
          aspectRatio: '16 / 9',
          objectFit: 'fill',
          margin: 'auto',
        };
      case '4:3':
        return {
          width: '100%',
          height: '100%',
          aspectRatio: '4 / 3',
          objectFit: 'fill',
          margin: 'auto',
        };
      case 'fit':
      default:
        return {
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        };
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-4'
      }`}
    >
      <div
        ref={playerContainerRef}
        onMouseMove={handleMouseMove}
        className={`relative flex flex-col bg-gray-950 transition-all duration-300 ${
          isFullscreen
            ? 'w-screen h-screen rounded-none border-0'
            : 'w-full max-w-5xl bg-gray-900 border border-gray-700/70 rounded-2xl shadow-2xl overflow-hidden'
        }`}
      >
        {/* Top Control Bar */}
        <div
          className={`flex items-center justify-between px-4 py-3 bg-gray-900/90 border-b border-gray-700/60 z-30 transition-opacity duration-300 ${
            isFullscreen
              ? `absolute top-0 left-0 right-0 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
              : 'relative'
          }`}
        >
          <div className="flex items-center space-x-3 overflow-hidden mr-3">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="truncate">
              <h2 className="text-sm sm:text-base font-semibold text-white truncate" title={video.name}>
                {video.name}
              </h2>
              <div className="flex items-center space-x-2 text-xs text-gray-400 mt-0.5">
                {video.size && <span>{formatFileSize(video.size)}</span>}
                {knownTotalDuration > 0 && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-gray-300">{formatTimestamp(knownTotalDuration)}</span>
                  </>
                )}
                {video.videoMediaMetadata?.height && (
                  <>
                    <span>•</span>
                    <span className="bg-indigo-900/60 text-indigo-300 font-mono text-[10px] px-1.5 py-0.5 rounded border border-indigo-700/50">
                      {video.videoMediaMetadata.height}p
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="text-emerald-400 font-medium">HTTP Range Stream</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Aspect Ratio Quick Toggle */}
            <button
              onClick={cycleAspectRatio}
              title="Cycle Aspect Ratio / Fit / Crop (Hotkey: C or A)"
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-indigo-300 hover:text-white transition-colors border border-gray-700 flex items-center space-x-1"
            >
              <AspectRatioIcon className="w-3.5 h-3.5" />
              <span className="capitalize">{aspectRatio}</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen (Hotkey: F)"
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700 flex items-center justify-center"
            >
              {isFullscreen ? (
                <ExitFullscreenIcon className="w-4 h-4" />
              ) : (
                <FullscreenIcon className="w-4 h-4" />
              )}
            </button>

            {/* Copy Stream Link */}
            <button
              onClick={handleCopyLink}
              title="Copy stream URL for external players like VLC or MPV"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700 flex items-center space-x-1.5"
            >
              <span>{copiedUrl ? 'Copied URL!' : 'Copy Link'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-800 hover:bg-red-600/80 text-gray-300 hover:text-white flex items-center justify-center transition-colors focus:outline-none"
              aria-label="Close video player"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div
          className={`relative w-full bg-black flex items-center justify-center overflow-hidden ${
            isFullscreen ? 'flex-1 h-full' : 'aspect-video'
          }`}
        >
          {/* Native HTML5 Streaming Video Player with dynamic aspect ratio */}
          <video
            ref={videoRef}
            key={currentStreamUrl}
            src={currentStreamUrl}
            controls={false} // We provide our superior custom scrubber + keyboard controls
            autoPlay
            playsInline
            preload="metadata"
            style={getVideoStyle()}
            onClick={togglePlay}
            onLoadStart={handleLoadStart}
            onCanPlay={handleCanPlay}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdate}
            onError={handleError}
            className="focus:outline-none cursor-pointer"
          >
            {trackBlobUrl && (
              <track
                key={trackBlobUrl}
                kind="subtitles"
                src={trackBlobUrl}
                default
                label="Subtitles"
              />
            )}
            Your browser does not support the video tag.
          </video>

          {/* 100% Guaranteed On-Screen Subtitle Banner */}
          {activeCueText && selectedSubtitleId !== 'off' && (
            <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-30 max-w-[85%] text-center px-4 animate-fade-in">
              <span
                className={`inline-block px-3 py-1.5 rounded-lg bg-black/85 text-white font-semibold shadow-2xl leading-snug tracking-wide border border-white/10 select-none whitespace-pre-wrap ${
                  subtitleSize === 'large' ? 'text-lg sm:text-2xl' : 'text-sm sm:text-lg'
                }`}
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
              >
                {activeCueText}
              </span>
            </div>
          )}

          {/* Aspect Ratio HUD Toast */}
          {showAspectToast && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-md border border-indigo-500/40 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-2xl animate-fade-in flex items-center space-x-2">
              <span>{showAspectToast}</span>
            </div>
          )}

          {/* Buffering Indicator */}
          {isBuffering && !playbackError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 pointer-events-none backdrop-blur-xs">
              <Loader />
              <p className="text-sm font-medium text-gray-200 mt-3 drop-shadow">
                Streaming video chunks from Google Drive...
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Zero full-file download • Instant seeking enabled
              </p>
            </div>
          )}

          {/* Error State Overlay */}
          {playbackError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-gray-950/95 max-w-lg mx-auto rounded-xl">
              <div className="w-14 h-14 rounded-full bg-red-900/30 text-red-400 flex items-center justify-center mb-4 border border-red-700/50">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-white mb-2">Streaming Playback Error</h3>
              <p className="text-sm text-red-300 mb-4">{playbackError.message}</p>

              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                {audioTracks.length > 0 && (
                  <button
                    onClick={() => handleAudioTrackChange('0')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow"
                  >
                    Play with Audio Track 1 (320k Remux)
                  </button>
                )}
                <button
                  onClick={() => {
                    setMimeOverride('video/webm');
                    if (videoRef.current) videoRef.current.load();
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-semibold transition-all"
                >
                  Retry WebM Container
                </button>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-all"
                >
                  {copiedUrl ? 'Copied MPV/VLC URL!' : 'Copy Link for MPV / VLC'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Custom High-Precision Timeline Scrubber (Solves Duration Extending Bug) */}
        <div
          className={`px-4 pt-3 pb-2 bg-gray-900 border-t border-gray-800 z-30 transition-opacity duration-300 ${
            isFullscreen
              ? `absolute bottom-14 left-0 right-0 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
              : 'relative'
          }`}
        >
          <div className="flex items-center space-x-3">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="text-gray-300 hover:text-white transition-colors focus:outline-none shrink-0"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75zm10.5 0a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Current Timestamp */}
            <span className="font-mono text-xs text-gray-300 shrink-0 select-none">
              {formatTimestamp(currentTime)}
            </span>

            {/* Continuous Range Scrubber Slider */}
            <div className="relative flex-1 flex items-center group py-1">
              <input
                type="range"
                min="0"
                max={knownTotalDuration > 0 ? knownTotalDuration : 1}
                step="0.5"
                value={knownTotalDuration > 0 ? currentTime : 0}
                disabled={knownTotalDuration <= 0}
                onChange={handleSeek}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all focus:outline-none disabled:opacity-40 disabled:cursor-wait"
              />
            </div>

            {/* Fixed Known Total Duration */}
            <span className="font-mono text-xs text-gray-400 shrink-0 select-none">
              {knownTotalDuration > 0 ? formatTimestamp(knownTotalDuration) : isProbingTracks ? 'Estimating...' : '--:--'}
            </span>
          </div>
        </div>

        {/* Multi-Audio, Subtitle & Aspect Ratio Toolbar */}
        <div
          className={`px-4 py-2.5 bg-gray-900/95 border-t border-gray-800/80 z-30 flex flex-wrap items-center justify-between gap-4 transition-opacity duration-300 ${
            isFullscreen
              ? `absolute bottom-0 left-0 right-0 ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
              : 'relative'
          }`}
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* Audio Track Selector */}
            <div className="flex items-center space-x-2">
              <AudioIcon className="w-4 h-4 text-indigo-400 shrink-0" />
              <label htmlFor="audio-select" className="text-xs font-medium text-gray-300">
                Audio:
              </label>
              <select
                id="audio-select"
                value={selectedAudioIndex}
                onChange={(e) => handleAudioTrackChange(e.target.value)}
                disabled={isProbingTracks && audioTracks.length === 0}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
              >
                <option value="default">Default Track (Direct Stream)</option>
                {audioTracks.map((track) => (
                  <option key={track.id} value={track.id.toString()}>
                    {track.label} (High Quality 320k)
                  </option>
                ))}
              </select>
              {isProbingTracks && (
                <span className="text-[10px] text-gray-400 animate-pulse">Probing tracks...</span>
              )}
            </div>

            {/* Subtitle Track Selector */}
            <div className="flex items-center space-x-2">
              <SubtitleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              <label htmlFor="subtitle-select" className="text-xs font-medium text-gray-300">
                Subtitles:
              </label>
              <select
                id="subtitle-select"
                value={selectedSubtitleId}
                onChange={(e) => handleSubtitleChange(e.target.value)}
                disabled={isProbingTracks && subtitleTracks.length === 0}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-colors"
              >
                <option value="off">Subtitles Off</option>
                {subtitleTracks.map((track) => (
                  <option key={track.id} value={track.id.toString()}>
                    {track.label}
                  </option>
                ))}
              </select>

              {isSubtitleLoading && (
                <span className="text-[10px] text-emerald-400 animate-pulse flex items-center space-x-1">
                  <span>Loading...</span>
                  {subtitleCues.length > 0 && <span className="text-gray-400">({subtitleCues.length} cues)</span>}
                </span>
              )}
              {!isSubtitleLoading && subtitleCues.length > 0 && selectedSubtitleId !== 'off' && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  ({subtitleCues.length} cues ready)
                </span>
              )}

              {/* Subtitle Size Toggle */}
              {selectedSubtitleId !== 'off' && (
                <button
                  type="button"
                  onClick={() => setSubtitleSize((prev) => (prev === 'normal' ? 'large' : 'normal'))}
                  className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[11px] font-mono border border-gray-700"
                  title="Toggle Subtitle Size"
                >
                  Size: {subtitleSize === 'normal' ? '1x' : '1.5x'}
                </button>
              )}

              {/* Upload Custom Subtitle Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,.vtt"
                onChange={handleLocalSubtitleUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Add local subtitle file (.srt or .vtt)"
                className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-gray-700 transition-colors flex items-center space-x-1"
              >
                <span>+ Subtitle (.srt)</span>
              </button>
            </div>

            {/* Aspect Ratio & Fit Selector */}
            <div className="flex items-center space-x-2">
              <AspectRatioIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <label htmlFor="aspect-select" className="text-xs font-medium text-gray-300">
                Fit / Crop:
              </label>
              <select
                id="aspect-select"
                value={aspectRatio}
                onChange={(e) => {
                  const val = e.target.value as AspectRatioMode;
                  setAspectRatio(val);
                  const matched = aspectModes.find((m) => m.key === val);
                  if (matched) setShowAspectToast(`${matched.icon} ${matched.label}`);
                }}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
              >
                {aspectModes.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.icon} {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Shortcuts & Fullscreen indicator */}
          <div className="flex items-center space-x-3 text-[11px] text-gray-400">
            <span className="hidden xl:inline"><kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-700">Space</kbd> Play</span>
            <span className="hidden xl:inline"><kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-700">C</kbd> Crop/Fit</span>
            <span className="hidden xl:inline"><kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-700">F</kbd> Fullscreen</span>

            <button
              onClick={toggleFullscreen}
              className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-1.5"
            >
              {isFullscreen ? (
                <>
                  <ExitFullscreenIcon className="w-3.5 h-3.5" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <FullscreenIcon className="w-3.5 h-3.5" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;
