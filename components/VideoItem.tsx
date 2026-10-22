import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleDriveFile } from '../types';
import { getWatchProgress } from '../services/watchProgressService';
import { parseMediaTitle } from '../services/mediaTitleParser';

interface VideoItemProps {
  video: GoogleDriveFile;
  onSelect: (video: GoogleDriveFile) => void;
}

const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M8 5.14v14c0 .86.94 1.39 1.67.94l11-7c.72-.45.72-1.5 0-1.95l-11-7c-.73-.45-1.67.08-1.67.95z" />
  </svg>
);

const VideoItem: React.FC<VideoItemProps> = ({ video, onSelect }) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState<boolean>(false);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const [watchProgress, setWatchProgress] = useState(() => getWatchProgress(video.id));

  const parsed = useMemo(() => parseMediaTitle(video.name), [video.name]);
  const token = window.gapi?.client?.getToken?.()?.access_token || '';

  // Update progress if changed elsewhere
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (!e?.detail?.fileId || e.detail.fileId === video.id) {
        setWatchProgress(getWatchProgress(video.id));
      }
    };
    window.addEventListener('nebula_watch_progress_updated', handleUpdate);
    return () => window.removeEventListener('nebula_watch_progress_updated', handleUpdate);
  }, [video.id]);

  // Viewport intersection observer for true lazy loading of thumbnail
  useEffect(() => {
    if (!itemRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(itemRef.current);

    return () => observer.disconnect();
  }, []);

  const thumbSrc = `/api/thumbnail?fileId=${video.id}&token=${encodeURIComponent(token)}${
    video.thumbnailLink ? '&url=' + encodeURIComponent(video.thumbnailLink) : ''
  }`;

  const formatDuration = (millis: string | undefined): string | null => {
    if (!millis) return null;
    const totalSeconds = Math.floor(parseInt(millis, 10) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
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

  const ext = (video.name.split('.').pop() || 'VID').toUpperCase().slice(0, 4);
  const height = video.videoMediaMetadata?.height;

  return (
    <div
      ref={itemRef}
      onClick={() => onSelect(video)}
      className="group cursor-pointer glass-card rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col relative"
    >
      {/* 16:9 Thumbnail Area */}
      <div className="relative aspect-video bg-[#07090f] overflow-hidden flex items-center justify-center">
        {/* Placeholder skeleton */}
        {(!imgLoaded || !inView) && !imgError && (
          <div className="absolute inset-0 bg-white/[0.02] animate-pulse flex items-center justify-center">
            <PlayIcon className="w-8 h-8 text-white/10" />
          </div>
        )}

        {/* Thumbnail Image */}
        {inView && !imgError ? (
          <img
            src={thumbSrc}
            alt={video.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : imgError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02] text-gray-500 p-2 text-center">
            <PlayIcon className="w-8 h-8 mb-1 opacity-25 text-gray-400" />
            <span className="text-[10px] font-mono text-gray-500">Video</span>
          </div>
        ) : null}

        {/* Multi-stop cinematic dark vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f18] via-black/20 to-black/30 opacity-70 group-hover:opacity-40 transition-opacity" />

        {/* Floating Play Button on Hover */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.65)] opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
            <PlayIcon className="w-5 h-5 ml-0.5" />
          </div>
        </div>

        {/* Resolution Badge */}
        {height && (
          <div
            className={`absolute top-2.5 left-2.5 backdrop-blur-md text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-sm border ${
              height >= 2160
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                : height >= 1080
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/35 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                : 'bg-black/60 text-gray-300 border-white/15'
            }`}
          >
            {height >= 2160 ? '4K UHD' : height >= 1080 ? '1080p' : `${height}p`}
          </div>
        )}

        {/* Duration Badge */}
        {video.videoMediaMetadata?.durationMillis && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-mono font-medium px-2 py-0.5 rounded-md shadow-sm border border-white/10">
            {formatDuration(video.videoMediaMetadata.durationMillis)}
          </div>
        )}

        {/* Watch Progress Bar */}
        {watchProgress && watchProgress.progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.9)]"
              style={{ width: `${watchProgress.progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Info Details */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <div>
          <h3
            className="text-xs sm:text-sm font-semibold text-gray-100 line-clamp-1 group-hover:text-indigo-300 transition-colors duration-200 tracking-tight"
            title={video.name}
          >
            {parsed.cleanTitle}
          </h3>

          <div className="flex items-center space-x-2 text-[11px] text-gray-400 mt-1">
            {parsed.isEpisode ? (
              <span className="font-medium text-cyan-400/90 font-mono text-[11px] tracking-wide">
                {parsed.displayState}
              </span>
            ) : parsed.year ? (
              <span className="font-mono text-[11px] text-gray-400">
                {parsed.year}
              </span>
            ) : (
              <span className="text-[11px] text-gray-500 font-mono">
                Video
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-400 mt-3 pt-2.5 border-t border-white/[0.05]">
          <span className="font-mono text-gray-400 text-[11px]">
            {formatFileSize(video.size) || 'Nebula Stream'}
          </span>
          <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-gray-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05]">
            {ext}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoItem;
