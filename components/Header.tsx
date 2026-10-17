import React from 'react';

interface HeaderProps {
  isSignedIn: boolean;
  onLogout: () => void;
  token?: string;
}

const FilmIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
    <line x1="7" y1="2" x2="7" y2="22"></line>
    <line x1="17" y1="2" x2="17" y2="22"></line>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <line x1="2" y1="7" x2="7" y2="7"></line>
    <line x1="2" y1="17" x2="7" y2="17"></line>
    <line x1="17" y1="17" x2="22" y2="17"></line>
    <line x1="17" y1="7" x2="22" y2="7"></line>
  </svg>
);

const ShareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
);

const Header: React.FC<HeaderProps> = ({ isSignedIn, onLogout, token }) => {
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const localIp = '192.168.29.213';
  const lanPort = '3000';
  const shareUrl = token
    ? `http://${localIp}:${lanPort}/?token=${encodeURIComponent(token)}`
    : `http://${localIp}:${lanPort}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <header className="bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <FilmIcon className="w-8 h-8 text-indigo-400" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                DriveStream
              </h1>
              <span className="text-[10px] text-emerald-400 font-mono tracking-wide block sm:inline">
                LAN: http://{localIp}:{lanPort}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isSignedIn && (
              <>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-indigo-300 hover:text-white text-xs sm:text-sm font-semibold rounded-lg border border-indigo-700/50 flex items-center space-x-1.5 transition-colors"
                  title="Share stream access with mobile devices or Smart TVs on local Wi-Fi"
                >
                  <ShareIcon className="w-4 h-4" />
                  <span>Share to TV / Phone</span>
                </button>

                <button
                  onClick={onLogout}
                  className="px-3 sm:px-4 py-1.5 bg-red-900/60 hover:bg-red-800 text-red-200 text-xs sm:text-sm font-semibold rounded-lg border border-red-700/50 transition-colors"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* LAN Sharing Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ShareIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Stream on Phone or Smart TV</h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              Open this link on any mobile phone, tablet, laptop, or Smart TV connected to the same Wi-Fi network. The login token is included so you can start streaming immediately without Google OAuth warnings on the local IP!
            </p>

            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 mb-4">
              <label className="text-[11px] font-medium text-gray-400 block mb-1">
                Local Wi-Fi Stream URL:
              </label>
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-transparent text-emerald-400 text-xs font-mono break-all focus:outline-none select-all"
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all shadow flex items-center space-x-1.5"
              >
                <span>{copied ? '✓ Copied URL!' : 'Copy Wi-Fi Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
