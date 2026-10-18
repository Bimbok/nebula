import React, { useState, useEffect, useCallback } from 'react';
import MascotLogo from './MascotLogo';

interface HeaderProps {
  isSignedIn: boolean;
  onLogout: () => void;
  token?: string;
}

const isClientLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.local');
};

const CinemaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="4" width="20" height="16" rx="4" />
    <path d="M7 4v16M17 4v16M2 12h20M2 8h5M2 16h5M17 8h5M17 16h5" opacity="0.6" />
    <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

const ShareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const ExitIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const CopyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Header: React.FC<HeaderProps> = ({ isSignedIn, onLogout, token }) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLocalhost] = useState<boolean>(isClientLocalhost);
  const [localIp, setLocalIp] = useState<string>('');
  const [lanPort, setLanPort] = useState<string>(() => {
    return typeof window !== 'undefined' && window.location.port ? window.location.port : '3000';
  });

  const fetchNetworkInfo = useCallback(() => {
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.localIp && data.localIp !== '127.0.0.1') {
          setLocalIp(data.localIp);
        }
        if (data?.port) {
          setLanPort(String(data.port));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isLocalhost) {
      fetchNetworkInfo();
    }
  }, [isLocalhost, fetchNetworkInfo]);

  const effectiveIp = localIp || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const effectivePort = lanPort || (typeof window !== 'undefined' && window.location.port ? window.location.port : '3000');
  const shareUrl = token
    ? `http://${effectiveIp}:${effectivePort}/?token=${encodeURIComponent(token)}`
    : `http://${effectiveIp}:${effectivePort}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#07090e]/80 backdrop-blur-xl border-b border-white/[0.06] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-cyan-500/15 border border-indigo-500/30 group-hover:border-indigo-400/60 transition-all duration-300 shadow-[0_0_18px_rgba(99,102,241,0.2)] p-0.5">
              <MascotLogo size="sm" animated />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                  Nebula
                </span>
                <span className="text-[9px] uppercase tracking-wider font-mono font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                  Cinema
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2.5">
            {isSignedIn && (
              <>
                {isLocalhost && (
                  <button
                    onClick={() => {
                      setShowShareModal(true);
                      if (!localIp) fetchNetworkInfo();
                    }}
                    className="group relative flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-indigo-500/15 border border-white/[0.08] hover:border-indigo-500/30 text-xs font-medium text-gray-300 hover:text-white transition-all duration-200 shadow-sm"
                    title="Stream on Phone or Smart TV (Local Wi-Fi)"
                  >
                    <ShareIcon className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-12 transition-transform duration-300" />
                    <span className="hidden sm:inline">TV & Phone</span>
                  </button>
                )}

                <button
                  onClick={onLogout}
                  className="group flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-red-500/15 border border-white/[0.06] hover:border-red-500/30 text-xs font-medium text-gray-400 hover:text-red-300 transition-all duration-200"
                  title="Sign Out"
                >
                  <ExitIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 duration-200" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* LAN Sharing Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-pop-in"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-[#0e111a] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <ShareIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Stream on Phone or Smart TV</h3>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-[11px] text-gray-400 font-mono">
                      Local Wi-Fi Network ({effectiveIp}:{effectivePort})
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300/90 leading-relaxed mb-4">
              Open this link on any phone, tablet, or Smart TV on the same Wi-Fi. The token is embedded so you can stream instantly without OAuth re-prompting.
            </p>

            <div className="bg-[#08090e] p-3 rounded-xl border border-white/[0.06] mb-5">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                  Direct LAN Stream URL
                </label>
                {copied && (
                  <span className="text-[10px] font-medium text-emerald-400 flex items-center space-x-1">
                    <CheckIcon className="w-3 h-3" />
                    <span>Copied</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-transparent text-emerald-400 font-mono text-xs select-all focus:outline-none break-all"
              />
            </div>

            <div className="flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-gray-300 text-xs font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] flex items-center space-x-1.5"
              >
                {copied ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5" />
                    <span>Copied to Clipboard</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="w-3.5 h-3.5" />
                    <span>Copy Wi-Fi Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
