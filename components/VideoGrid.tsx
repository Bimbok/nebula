import React from 'react';
import { GoogleDriveFile } from '../types';
import VideoItem from './VideoItem';

interface VideoGridProps {
  videos: GoogleDriveFile[];
  onSelectVideo: (video: GoogleDriveFile) => void;
}

const VideoGrid: React.FC<VideoGridProps> = ({ videos, onSelectVideo }) => {
  if (videos.length === 0) {
    return (
      <div className="text-center py-24 px-4">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-gray-500">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="20" height="16" rx="3" />
            <path d="M10 9l5 3-5 3V9z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-300 mb-1">No Videos Found</h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          No matching video files were found in your Google Drive library. Check your search query or refresh your drive.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {videos.map((video) => (
        <VideoItem key={video.id} video={video} onSelect={onSelectVideo} />
      ))}
    </div>
  );
};

export default VideoGrid;
