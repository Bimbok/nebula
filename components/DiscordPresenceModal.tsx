import React, { useState, useEffect } from 'react';
import { discordPresenceService, DiscordUser, DiscordPresenceStatus } from '../services/discordPresenceService';

interface DiscordPresenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DiscordIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const DiscordPresenceModal: React.FC<DiscordPresenceModalProps> = ({ isOpen, onClose }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Sync state from service
  const [status, setStatus] = useState<DiscordPresenceStatus>(discordPresenceService.getStatus());
  const [user, setUser] = useState<DiscordUser | null>(discordPresenceService.getUser());
  const [isEnabled, setIsEnabled] = useState(discordPresenceService.isEnabled());
  const [isCustomStatus, setIsCustomStatus] = useState(discordPresenceService.isCustomStatusEnabled());

  useEffect(() => {
    const unsub = discordPresenceService.subscribe(() => {
      setStatus(discordPresenceService.getStatus());
      setUser(discordPresenceService.getUser());
      setIsEnabled(discordPresenceService.isEnabled());
      setIsCustomStatus(discordPresenceService.isCustomStatusEnabled());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTokenInput(discordPresenceService.getToken());
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await discordPresenceService.setToken(tokenInput);
    setIsSaving(false);

    if (result.success) {
      setSuccessMsg(tokenInput ? 'Connected successfully to Discord!' : 'Token removed');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(result.error || 'Failed to authenticate with Discord');
    }
  };

  const handleDisconnect = () => {
    discordPresenceService.clearToken();
    setTokenInput('');
    setSuccessMsg('Disconnected from Discord');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user?.id || '0', 10) % 5}.png`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-pop-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0e111a] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top ambient glow in Discord Blurple */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-[#5865F2]/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2] shadow-[0_0_15px_rgba(88,101,242,0.3)]">
              <DiscordIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-white">Discord Rich Presence</h3>
                <span className="text-[10px] font-mono font-semibold bg-[#5865F2]/20 text-[#5865F2] px-2 py-0.5 rounded-full border border-[#5865F2]/30">
                  Gateway
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Broadcast live watching status on Phone, TV, or Desktop
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-gray-400 hover:text-white flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Connection Status Card */}
        {user ? (
          <div className="bg-[#121524] border border-[#5865F2]/30 rounded-2xl p-3.5 mb-5 flex items-center justify-between shadow-inner">
            <div className="flex items-center space-x-3">
              <img
                src={avatarUrl}
                alt={user.username}
                className="w-11 h-11 rounded-full border border-[#5865F2]/50 shadow-md"
              />
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm font-semibold text-white">
                    {user.global_name || user.username}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">@{user.username}</span>
                </div>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'
                    }`}
                  />
                  <span className="text-[11px] font-medium text-emerald-400">
                    {status === 'connected' ? 'Connected to Discord Gateway' : 'Connecting...'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-medium transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 mb-5 flex items-center space-x-2.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
            <span>Connect your Discord account to broadcast your movie or show status to all your friends.</span>
          </div>
        )}

        {/* Live Preview Card */}
        <div className="mb-5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2 block">
            What your profile will show
          </label>
          <div className="bg-[#1e1f29] rounded-2xl p-3.5 border border-white/[0.08] shadow-lg flex items-center space-x-3">
            <div className="relative w-12 h-12 rounded-xl bg-black/40 border border-indigo-500/30 flex items-center justify-center p-1.5 shrink-0 shadow-inner">
              <img src="/mascot.svg" alt="Nebula" className="w-full h-full object-contain" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 border border-black flex items-center justify-center text-[8px] text-white">
                ▶
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Watching a Show
              </div>
              <div className="text-sm font-bold text-white truncate">Nebula Cinema</div>
              <div className="text-xs text-gray-300 truncate">Dark</div>
              <div className="text-[11px] text-gray-400 font-mono">Season 1 • Episode 10 • 32:15 left</div>
            </div>
          </div>
        </div>

        {/* Token Input Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-300">Discord User Token</label>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors underline decoration-dotted"
              >
                {showGuide ? 'Hide guide' : 'How to get token in 10s?'}
              </button>
            </div>

            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your Discord token here"
                className="w-full bg-[#08090e] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-[#5865F2] transition-colors pr-20"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-white/[0.04]"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Guide Dropdown */}
          {showGuide && (
            <div className="bg-[#08090e]/95 border border-indigo-500/30 rounded-2xl p-4 text-xs text-gray-300 space-y-3 animate-pop-in shadow-xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <p className="text-xs text-indigo-300 font-semibold flex items-center space-x-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.743 5.743L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.586a1 1 0 0 1 .293-.707l5.964-5.964A6 6 0 1 1 21 9z" />
                  </svg>
                  <span>How to get your Discord token (Takes 5 seconds)</span>
                </p>
                <span className="text-[10px] text-emerald-400 font-mono font-medium">100% Reliable</span>
              </div>

              <div className="space-y-2">
                <ol className="list-decimal list-inside space-y-2 text-[11px] text-gray-300 leading-relaxed">
                  <li>
                    Open <span className="text-white font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">discord.com/app</span> in Chrome/Firefox.
                  </li>
                  <li>
                    Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white text-[10px] font-mono">Ctrl + Shift + I</kbd> to open Developer Tools.
                  </li>
                  <li>
                    Click the <b className="text-indigo-300">Network</b> tab at the top (next to Console).
                  </li>
                  <li>
                    In the Filter search box at the top, type: <code className="bg-indigo-500/20 text-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">api</code>
                  </li>
                  <li>
                    Click on any friend or channel in Discord, then click on any request in the Network list (e.g. <code className="text-gray-400 font-mono">messages</code>, <code className="text-gray-400 font-mono">science</code>, or <code className="text-gray-400 font-mono">@me</code>).
                  </li>
                  <li>
                    In the right panel under <b>Request Headers</b>, find <code className="text-emerald-400 font-mono font-bold">authorization:</code> and copy the code next to it!
                  </li>
                </ol>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5 text-[10px] text-gray-400 flex items-center space-x-2">
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Your token is saved exclusively in your browser's local storage and is never uploaded anywhere.</span>
              </div>
            </div>
          )}

          {/* Feature Toggles */}
          <div className="bg-[#08090e]/60 rounded-xl p-3 border border-white/[0.05] space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-gray-300">Enable Discord Rich Presence</span>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => discordPresenceService.setEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs text-gray-300">Sync Custom Status Text</span>
                <p className="text-[10px] text-gray-500">e.g. Watching Dark • Season 1 Episode 10</p>
              </div>
              <input
                type="checkbox"
                checked={isCustomStatus}
                onChange={(e) => discordPresenceService.setCustomStatusEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-2 rounded-xl text-xs text-center">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-xl text-xs text-center font-medium">
              {successMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-gray-300 text-xs font-medium transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-semibold transition-all shadow-[0_0_15px_rgba(88,101,242,0.4)] flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <span>Connecting...</span>
              ) : (
                <>
                  <DiscordIcon className="w-4 h-4" />
                  <span>Connect & Save</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiscordPresenceModal;
