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
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold text-gray-300 mb-2">No Videos Found</h2>
        <p className="text-gray-500">It looks like there are no video files in your Google Drive.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {videos.map((video) => (
        <VideoItem key={video.id} video={video} onSelect={onSelectVideo} />
      ))}
    </div>
  );
};

export default VideoGrid;
