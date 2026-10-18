import React, { useState, useRef, useEffect } from 'react';
import { GoogleDriveFile } from '../types';

import { getWatchProgress } from '../services/watchProgressService';

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

  return (
    <div
      ref={itemRef}
      onClick={() => onSelect(video)}
      className="group cursor-pointer bg-[#0e111a]/90 hover:bg-[#131724] border border-white/[0.06] hover:border-indigo-500/40 rounded-2xl overflow-hidden shadow-lg hover:shadow-[0_12px_30px_-10px_rgba(99,102,241,0.22)] transition-all duration-300 transform hover:-translate-y-1 flex flex-col"
    >
      {/* 16:9 Thumbnail Area */}
      <div className="relative aspect-video bg-[#080a10] overflow-hidden flex items-center justify-center">
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
            <PlayIcon className="w-8 h-8 mb-1 opacity-30 text-gray-400" />
            <span className="text-[10px] font-mono text-gray-500">Video</span>
          </div>
        ) : null}

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* Floating Play Button on Hover */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-indigo-600/90 backdrop-blur-md text-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.6)]">
            <PlayIcon className="w-5 h-5 ml-0.5" />
          </div>
        </div>

        {/* Resolution Badge */}
        {video.videoMediaMetadata?.height && (
          <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-sm">
            {video.videoMediaMetadata.height >= 2160
              ? '4K UHD'
              : video.videoMediaMetadata.height >= 1080
              ? '1080p'
              : `${video.videoMediaMetadata.height}p`}
          </div>
        )}

        {/* Duration Badge */}
        {video.videoMediaMetadata?.durationMillis && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-mono font-medium px-2 py-0.5 rounded-md shadow-sm">
            {formatDuration(video.videoMediaMetadata.durationMillis)}
          </div>
        )}

        {/* Watch Progress Bar */}
        {watchProgress && watchProgress.progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"
              style={{ width: `${watchProgress.progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Info Details */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <h3
          className="text-xs sm:text-sm font-medium text-gray-200 line-clamp-2 group-hover:text-white transition-colors duration-200 leading-snug"
          title={video.name}
        >
          {video.name}
        </h3>

        <div className="flex items-center justify-between text-[11px] text-gray-400 mt-3 pt-2 border-t border-white/[0.04]">
          <span className="font-mono text-gray-400 text-[11px]">
            {formatFileSize(video.size) || 'Nebula Stream'}
          </span>
          <span className="text-[9px] uppercase font-mono font-semibold tracking-wider text-gray-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.04]">
            {ext}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoItem;
