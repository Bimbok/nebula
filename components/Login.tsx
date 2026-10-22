import React from 'react';
import Loader from './Loader';
import MascotLogo from './MascotLogo';

interface LoginProps {
  onLogin: () => void;
  isLoading: boolean;
}

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4 mr-2.5 shrink-0" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C41.38,36.128,44,30.638,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);

const FeatureTag: React.FC<{ label: string; desc: string; icon: React.ReactNode }> = ({ label, desc, icon }) => (
  <div className="flex items-start space-x-3 p-3 rounded-xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06] hover:border-indigo-500/30 transition-all duration-300">
    <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
      {icon}
    </div>
    <div>
      <div className="text-xs font-semibold text-gray-200">{label}</div>
      <div className="text-[11px] text-gray-400 leading-tight mt-0.5">{desc}</div>
    </div>
  </div>
);

const Login: React.FC<LoginProps> = ({ onLogin, isLoading }) => {
  return (
    <div className="relative min-h-[calc(100vh-10rem)] flex items-center justify-center py-10 px-4">
      {/* Cinematic ambient background glow meshes */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-[400px] h-[250px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[350px] h-[200px] bg-purple-600/10 blur-[110px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg glass-panel p-8 sm:p-10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] text-center animate-pop-in border border-white/10">
        {/* Top subtle highlight banner */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-cyan-500/15 border border-indigo-500/25 text-[11px] font-mono text-indigo-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>Original High-Bitrate Direct Stream</span>
        </div>

        {/* Mascot Emblem */}
        <div className="mb-5 flex justify-center transform hover:scale-105 transition-transform duration-300">
          <MascotLogo size="xl" animated showBadge />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
          Nebula Cinema
        </h2>
        <p className="text-xs sm:text-sm text-gray-400 max-w-sm mx-auto mb-7 leading-relaxed">
          Stream 4K and 1080p master quality directly from your Google Drive without downloading.
        </p>

        {/* Feature badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-7 text-left">
          <FeatureTag
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            }
            label="Zero Storage Required"
            desc="Direct HTTP range byte streaming"
          />
          <FeatureTag
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            }
            label="Studio Master Audio"
            desc="Multi-track passthrough & 320k AAC"
          />
          <FeatureTag
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
              </svg>
            }
            label="Frame-Accurate Subs"
            desc="WebVTT extraction & rVFC sync"
          />
          <FeatureTag
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <rect x="2" y="7" width="20" height="15" rx="2" />
                <polyline points="17 2 12 7 7 2" />
              </svg>
            }
            label="TV & Phone LAN Share"
            desc="Cast to Smart TV via local Wi-Fi"
          />
        </div>

        {/* Sign in button */}
        <button
          onClick={onLogin}
          disabled={isLoading}
          className="group relative w-full flex items-center justify-center px-6 py-3.5 rounded-xl bg-gradient-to-r from-white via-gray-100 to-white text-gray-900 font-semibold text-xs sm:text-sm shadow-[0_10px_25px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_35px_rgba(255,255,255,0.35)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-wait overflow-hidden"
        >
          {/* Subtle button shine */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/50 to-transparent" />

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
