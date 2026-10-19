import React from 'react';
import Loader from './Loader';
import MascotLogo from './MascotLogo';

interface LoginProps {
  onLogin: () => void;
  isLoading: boolean;
}

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4 mr-2.5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C41.38,36.128,44,30.638,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);

const FeatureTag: React.FC<{ label: string; icon: React.ReactNode }> = ({ label, icon }) => (
  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-xs text-gray-300">
    <span className="text-indigo-400 shrink-0">{icon}</span>
    <span>{label}</span>
  </div>
);

const Login: React.FC<LoginProps> = ({ onLogin, isLoading }) => {
  return (
    <div className="relative min-h-[calc(100vh-12rem)] flex items-center justify-center py-12 px-4">
      {/* Ambient background glow meshes */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[300px] h-[200px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg bg-[#0e111a]/80 backdrop-blur-2xl border border-white/[0.08] p-8 sm:p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-center animate-pop-in">
        {/* Mascot Emblem */}
        <div className="mb-6 flex justify-center">
          <MascotLogo size="xl" animated showBadge />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
          Nebula-Panda Cinema
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 max-w-sm mx-auto mb-8 leading-relaxed">
          High-fidelity cinema streaming directly from your Google Drive with zero local storage requirements.
        </p>

        {/* Feature badges */}
        <div className="grid grid-cols-2 gap-2 mb-8 text-left">
          <FeatureTag
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            }
            label="Instant HTTP Range"
          />
          <FeatureTag
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            }
            label="Multi-Track Audio"
          />
          <FeatureTag
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
              </svg>
            }
            label="Embedded Subtitles"
          />
          <FeatureTag
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <rect x="2" y="7" width="20" height="15" rx="2" />
                <polyline points="17 2 12 7 7 2" />
              </svg>
            }
            label="LAN Casting (TV/Phone)"
          />
        </div>

        {/* Sign in button */}
        <button
          onClick={onLogin}
          disabled={isLoading}
          className="group relative w-full flex items-center justify-center px-6 py-3.5 rounded-xl bg-white text-gray-900 font-semibold text-xs sm:text-sm shadow-lg hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-wait overflow-hidden"
        >
          {/* Subtle button shine */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {isLoading ? (
            <div className="flex items-center space-x-2 text-gray-800">
              <Loader size="sm" />
              <span>Connecting to Google Drive...</span>
            </div>
          ) : (
            <div className="flex items-center">
              <GoogleIcon />
              <span>Continue with Google</span>
            </div>
          )}
        </button>

        <p className="text-[11px] text-gray-500 mt-5 leading-relaxed">
          Read-only access to your video files. No data is stored or uploaded to external servers.
        </p>
      </div>
    </div>
  );
};

export default Login;
