import React, { useState, useRef, useEffect } from 'react';
import { GoogleDriveFile } from '../types';

interface VideoItemProps {
  video: GoogleDriveFile;
  onSelect: (video: GoogleDriveFile) => void;
}

const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

const VideoItem: React.FC<VideoItemProps> = ({ video, onSelect }) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState<boolean>(false);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const token = window.gapi?.client?.getToken?.()?.access_token || '';

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
      { rootMargin: '300px' } // Pre-load when within 300px of viewport
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

    const padded = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${padded(minutes)}:${padded(seconds)}`;
    }
    return `${minutes}:${padded(seconds)}`;
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

  return (
    <div
      ref={itemRef}
      onClick={() => onSelect(video)}
      className="group cursor-pointer bg-gray-800/90 border border-gray-700/60 rounded-xl overflow-hidden shadow-lg hover:shadow-indigo-500/20 hover:border-indigo-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col"
    >
      <div className="relative aspect-video bg-gray-900 overflow-hidden flex items-center justify-center">
        {/* Placeholder / Skeleton Icon */}
        {(!imgLoaded || !inView) && !imgError && (
          <div className="absolute inset-0 bg-gray-800/60 animate-pulse flex items-center justify-center">
            <PlayIcon className="w-10 h-10 text-gray-600" />
          </div>
        )}

        {/* High-Resolution Thumbnail with Lazy Viewport Load */}
        {inView && !imgError ? (
          <img
            src={thumbSrc}
            alt={video.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : imgError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-500 p-2 text-center">
            <PlayIcon className="w-12 h-12 mb-1 opacity-50" />
            <span className="text-[10px] font-mono opacity-60">No Preview</span>
          </div>
        ) : null}

        {/* Hover play button overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
          <div className="w-12 h-12 bg-indigo-600/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-xl">
            <PlayIcon className="w-6 h-6 text-white ml-1" />
          </div>
        </div>

        {/* Video Duration Badge */}
        {video.videoMediaMetadata?.durationMillis && (
          <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-xs text-white text-[11px] font-mono font-semibold px-2 py-0.5 rounded shadow">
            {formatDuration(video.videoMediaMetadata.durationMillis)}
          </div>
        )}

        {/* Video Quality Badge */}
        {video.videoMediaMetadata?.height && (
          <div className="absolute top-2 left-2 bg-indigo-900/80 backdrop-blur-xs text-indigo-200 border border-indigo-700/60 text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
            {video.videoMediaMetadata.height}p
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <h3
          className="text-xs sm:text-sm font-semibold text-gray-200 line-clamp-2 group-hover:text-indigo-400 transition-colors duration-200"
          title={video.name}
        >
          {video.name}
        </h3>
        <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
          {video.size && <span className="font-mono">{formatFileSize(video.size)}</span>}
          <span className="text-[10px] uppercase font-mono text-gray-400 bg-gray-700/50 px-1.5 py-0.5 rounded">
            {(video.name.split('.').pop() || 'VIDEO').slice(0, 4)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoItem;
