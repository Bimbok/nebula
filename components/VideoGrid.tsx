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
        <div className="mb-4 flex justify-center">
          <MascotLogo size="lg" animated showBadge />
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
