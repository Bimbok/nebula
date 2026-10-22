import React, { useState, useEffect } from 'react';
import { GoogleDriveFile, WatchProgress } from '../types';
import { getContinueWatchingList, removeWatchProgress } from '../services/watchProgressService';
import { parseMediaTitle } from '../services/mediaTitleParser';

interface ContinueWatchingProps {
  onSelectVideo: (video: GoogleDriveFile, resumeTime?: number) => void;
}

const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M8 5.14v14c0 .86.94 1.39 1.67.94l11-7c.72-.45.72-1.5 0-1.95l-11-7c-.73-.45-1.67.08-1.67.95z" />
  </svg>
);

const ClockIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const ContinueWatching: React.FC<ContinueWatchingProps> = ({ onSelectVideo }) => {
  const [items, setItems] = useState<WatchProgress[]>([]);

  const refreshList = () => {
    setItems(getContinueWatchingList());
  };

  useEffect(() => {
    refreshList();

    const handleUpdate = () => {
      refreshList();
    };

    window.addEventListener('nebula_watch_progress_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('nebula_watch_progress_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  if (items.length === 0) return null;

  const token = typeof window !== 'undefined' ? window.gapi?.client?.getToken?.()?.access_token || '' : '';

  const formatRemainingTime = (current: number, total: number): string => {
    if (!total || total <= current) return '';
    const remaining = total - current;
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${Math.max(1, minutes)}m left`;
  };

  const handleResume = (item: WatchProgress) => {
    const file: GoogleDriveFile = {
      id: item.fileId,
      name: item.name,
      thumbnailLink: item.thumbnailLink,
      videoMediaMetadata: item.videoMediaMetadata,
      size: item.size,
    };
    onSelectVideo(file, item.currentTime);
  };

  const handleDismiss = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    removeWatchProgress(fileId);
  };

  return (
    <section className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ClockIcon className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-semibold tracking-tight text-white flex items-center space-x-2">
            <span>Continue Watching</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {items.length}
            </span>
          </h2>
        </div>
      </div>

      {/* Horizontal Scroll Carousel */}
      <div className="flex space-x-4 overflow-x-auto pb-3 pt-1 no-scrollbar scroll-smooth">
        {items.map((item) => {
          const parsed = parseMediaTitle(item.name);
          const thumbSrc = `/api/thumbnail?fileId=${item.fileId}&token=${encodeURIComponent(token)}${
            item.thumbnailLink ? '&url=' + encodeURIComponent(item.thumbnailLink) : ''
          }`;

          const remainingText = formatRemainingTime(item.currentTime, item.duration);
          const height = item.videoMediaMetadata?.height;

          return (
            <div
              key={item.fileId}
              onClick={() => handleResume(item)}
              className="group relative flex-none w-64 sm:w-72 glass-card rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1.5 cursor-pointer shadow-lg hover:shadow-[0_16px_36px_-10px_rgba(99,102,241,0.25)] flex flex-col"
            >
              {/* 16:9 Thumbnail Box */}
              <div className="relative aspect-video bg-[#07090f] overflow-hidden flex items-center justify-center">
                <img
                  src={thumbSrc}
                  alt={item.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f18] via-black/25 to-black/30 group-hover:opacity-50 transition-opacity" />

                {/* Hover Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.7)] opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                    <PlayIcon className="w-4 h-4 ml-0.5" />
                  </div>
                </div>

                {/* Top-Right Dismiss Button */}
                <button
                  onClick={(e) => handleDismiss(e, item.fileId)}
                  title="Remove from Continue Watching"
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500/80 border border-white/20 text-gray-300 hover:text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all z-10"
                >
                  ✕
                </button>

                {/* Top-Left Resolution Chip */}
                {height && (
                  <div
                    className={`absolute top-2 left-2 backdrop-blur-md text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm border ${
                      height >= 2160
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : height >= 1080
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/35'
                        : 'bg-black/60 text-gray-300 border-white/15'
                    }`}
                  >
                    {height >= 2160 ? '4K UHD' : height >= 1080 ? '1080p' : `${height}p`}
                  </div>
                )}

                {/* Bottom-Right Remaining Time Badge */}
                {remainingText && (
                  <div className="absolute bottom-2.5 right-2 bg-black/80 backdrop-blur-md text-white font-mono text-[10px] px-2 py-0.5 rounded shadow-sm border border-white/10">
                    {remainingText}
                  </div>
                )}

                {/* Bottom Glowing Progress Bar Track */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.9)]"
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Title & Metadata */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    className="text-xs font-semibold text-gray-100 line-clamp-1 group-hover:text-indigo-300 transition-colors"
                    title={item.name}
                  >
                    {parsed.cleanTitle}
                  </h3>
                  {parsed.isEpisode ? (
                    <p className="text-[10px] text-cyan-400/90 font-mono font-medium line-clamp-1 mt-0.5">
                      {parsed.displayState}
                    </p>
                  ) : parsed.year ? (
                    <p className="text-[10px] text-gray-400 font-mono line-clamp-1 mt-0.5">
                      {parsed.year}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2 font-mono pt-1.5 border-t border-white/[0.04]">
                  <span>{Math.round(item.progressPercent)}% watched</span>
                  <span className="text-indigo-400 group-hover:text-cyan-300 transition-colors font-sans font-medium">Resume &rarr;</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ContinueWatching;
