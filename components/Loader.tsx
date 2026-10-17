import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeMap[size]} ${className}`}>
      {/* Outer ambient glow */}
      <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-sm animate-pulse" />
      {/* Subtle background ring */}
      <svg
        className="w-full h-full animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-15"
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M12 2.5C6.753 2.5 2.5 6.753 2.5 12C2.5 13.418 2.81 14.764 3.364 15.97L5.65 14.827C5.23 13.948 5 12.998 5 12C5 8.134 8.134 5 12 5V2.5Z"
        />
      </svg>
    </div>
  );
};

export default Loader;
