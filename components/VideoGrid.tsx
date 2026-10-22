import React from 'react';
import { GoogleDriveFile } from '../types';
import VideoItem from './VideoItem';
import MascotLogo from './MascotLogo';

interface VideoGridProps {
  videos: GoogleDriveFile[];
  onSelectVideo: (video: GoogleDriveFile) => void;
}

const VideoGrid: React.FC<VideoGridProps> = ({ videos, onSelectVideo }) => {
  if (videos.length === 0) {
    return (
      <div className="text-center py-24 px-4">
        <div className="max-w-md mx-auto glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

          <div className="mb-4 flex justify-center transform hover:scale-105 transition-transform duration-300">
            <MascotLogo size="lg" animated showBadge />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5 tracking-tight">No Videos Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            No matching media files were found for this filter or search query. Try choosing another category or clearing your search.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
      {videos.map((video) => (
        <VideoItem key={video.id} video={video} onSelect={onSelectVideo} />
      ))}
    </div>
  );
};

export default VideoGrid;
