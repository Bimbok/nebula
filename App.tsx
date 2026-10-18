import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleDriveFile, TokenClient } from './types';
import { fetchVideosPage } from './services/googleDriveService';
import Header from './components/Header';
import Login from './components/Login';
import VideoGrid from './components/VideoGrid';
import VideoPlayer from './components/VideoPlayer';
import ContinueWatching from './components/ContinueWatching';
import Loader from './components/Loader';
import MascotLogo from './components/MascotLogo';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID, SCOPES } from './constants';

declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: TokenClient;
  }
}

const hasSavedSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(
      localStorage.getItem('gdrive_oauth_token') ||
      localStorage.getItem('gdrive_logged_in') === 'true' ||
      (document.cookie && document.cookie.includes('gdrive_token=')) ||
      new URLSearchParams(window.location.search).get('token') ||
      new URLSearchParams(window.location.search).get('auth_token')
    );
  } catch {
    return false;
  }
};

const App: React.FC = () => {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [isAuthRestoring, setIsAuthRestoring] = useState<boolean>(hasSavedSession);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [videos, setVideos] = useState<GoogleDriveFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GoogleDriveFile | null>(null);
  const [initialResumeTime, setInitialResumeTime] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(hasSavedSession);
  const [error, setError] = useState<string | null>(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [activeClientId, setActiveClientId] = useState<string>(GOOGLE_CLIENT_ID);
  const [activeApiKey, setActiveApiKey] = useState<string>(GOOGLE_API_KEY);
  const tokenRefreshTimeoutRef = useRef<any>(null);

  // Safety fallback: if auth restoration takes longer than 6 seconds, show login interface
  useEffect(() => {
    if (isAuthRestoring) {
      const timer = setTimeout(() => {
        setIsAuthRestoring(false);
        setIsLoading(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isAuthRestoring]);

  useEffect(() => {
    let scriptGapi: HTMLScriptElement | null = null;
    let scriptGsi: HTMLScriptElement | null = null;

    const initAuthFlow = async () => {
      let clientId = GOOGLE_CLIENT_ID || (window as any).NEBULA_CONFIG?.GOOGLE_CLIENT_ID || (window as any).process?.env?.GOOGLE_CLIENT_ID;
      let apiKey = GOOGLE_API_KEY || (window as any).NEBULA_CONFIG?.GOOGLE_API_KEY || (window as any).process?.env?.GOOGLE_API_KEY;

      // If client ID was not statically baked, dynamically fetch from runtime /api/config
      if (!clientId) {
        try {
          const res = await fetch('/api/config');
          if (res.ok) {
            const data = await res.json();
            if (data.GOOGLE_CLIENT_ID) {
              clientId = data.GOOGLE_CLIENT_ID;
              apiKey = data.GOOGLE_API_KEY || apiKey;
            }
          }
        } catch (e) {}
      }

      if (!clientId) {
        setConfigError("Configuration error: Google Client ID is missing. Please set GOOGLE_CLIENT_ID in your Render environment variables or .env.local file.");
        setIsLoading(false);
        return;
      }

      if (clientId.includes('YOUR_') || (apiKey && apiKey.includes('YOUR_'))) {
        setConfigError("Configuration error: Please replace placeholder Client ID with your actual credentials.");
        setIsLoading(false);
        return;
      }

      setActiveClientId(clientId);
      if (apiKey) setActiveApiKey(apiKey);

      scriptGapi = document.createElement('script');
      scriptGapi.src = 'https://apis.google.com/js/api.js';
      scriptGapi.async = true;
      scriptGapi.defer = true;
      scriptGapi.onload = () => {
        window.gapi.load('client', () => {
          const initConfig: { discoveryDocs: string[]; apiKey?: string } = {
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          };
          if (apiKey && apiKey.trim().length > 0) {
            initConfig.apiKey = apiKey.trim();
          }

          window.gapi.client.init(initConfig).then(() => {
            setIsGapiLoaded(true);
          }).catch((err: any) => {
            console.error("Error initializing gapi client:", err);
            const detailMsg = err?.error?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            setError(`Failed to initialize Google API client (${detailMsg}). Ensure Google Drive API is enabled in your Google Cloud Console.`);
            setIsLoading(false);
            setIsAuthRestoring(false);
          });
        });
      };
      scriptGapi.onerror = () => {
        setError("Failed to load Google API script. Please check your network connection and ad-blockers.");
        setIsLoading(false);
        setIsAuthRestoring(false);
      };
      document.body.appendChild(scriptGapi);

      scriptGsi = document.createElement('script');
      scriptGsi.src = 'https://accounts.google.com/gsi/client';
      scriptGsi.async = true;
      scriptGsi.defer = true;
      scriptGsi.onload = () => {
        setIsGsiLoaded(true);
      };
      scriptGsi.onerror = () => {
        setError("Failed to load Google Sign-In script. Please check your network connection and ad-blockers.");
        setIsLoading(false);
        setIsAuthRestoring(false);
      };
      document.body.appendChild(scriptGsi);
    };

    initAuthFlow();

    return () => {
      if (scriptGapi && document.body.contains(scriptGapi)) document.body.removeChild(scriptGapi);
      if (scriptGsi && document.body.contains(scriptGsi)) document.body.removeChild(scriptGsi);
    };
  }, []);

  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  const fetchUserVideos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchVideosPage(undefined, 36);
      setVideos(result.videos);
      setNextPageToken(result.nextPageToken);
    } catch (err: any) {
      console.error("Error fetching videos:", err);
      // If 401 Unauthorized, automatically request silent token renewal
      if ((err?.status === 401 || err?.result?.error?.code === 401) && window.tokenClient) {
        console.log('[Nebula Auth] Google API 401 detected, attempting silent token renewal...');
        window.tokenClient.requestAccessToken({ prompt: '' });
        return;
      }
      const detail = err?.result?.error?.message || err?.message || 'Failed to fetch videos from Google Drive.';
      setError(`Failed to fetch videos: ${detail}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMoreVideos = useCallback(async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchVideosPage(nextPageToken, 36);
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        const newUnique = result.videos.filter((v) => !seen.has(v.id));
        return [...prev, ...newUnique];
      });
      setNextPageToken(result.nextPageToken);
    } catch (err: any) {
      console.error("Error loading more videos:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextPageToken, isLoadingMore]);

  // Viewport intersection observer for auto-loading next page on scroll
  useEffect(() => {
    if (!loadMoreRef.current || !nextPageToken) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMoreVideos();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [nextPageToken, isLoadingMore, loadMoreVideos]);

  // Token persistence and silent refresh manager
  const persistTokenSession = useCallback((tokenResponse: any) => {
    window.gapi.client.setToken(tokenResponse);
    setIsSignedIn(true);
    setIsAuthRestoring(false);
    setIsSigningIn(false);

    const expiresIn = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in, 10) : 3600;
    const expiresAt = Date.now() + (expiresIn - 60) * 1000;

    // Save token and persistent login flag
    localStorage.setItem('gdrive_logged_in', 'true');
    localStorage.setItem(
      'gdrive_oauth_token',
      JSON.stringify({ ...tokenResponse, expires_at: expiresAt })
    );

    // Save cookie with 30-day persistence (2592000s) for Smart TV & LAN streaming stability
    document.cookie = `gdrive_token=${encodeURIComponent(tokenResponse.access_token)}; max-age=2592000; path=/; SameSite=Lax`;

    // Schedule background auto-refresh 5 minutes before expiration
    if (tokenRefreshTimeoutRef.current) clearTimeout(tokenRefreshTimeoutRef.current);
    const refreshMs = Math.max(60000, (expiresIn - 300) * 1000);
    tokenRefreshTimeoutRef.current = setTimeout(() => {
      if (window.tokenClient) {
        console.log('[Nebula Auth] Background silent token refresh triggered');
        window.tokenClient.requestAccessToken({ prompt: '' });
      }
    }, refreshMs);
  }, []);

  // Restore persistent login session from URL query param / cookie / localStorage
  useEffect(() => {
    if (isGapiLoaded) {
      // 1. Check for token in URL query parameter (for instant LAN / mobile streaming)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token') || urlParams.get('auth_token');
      if (urlToken) {
        const tokenObj = {
          access_token: urlToken,
          expires_at: Date.now() + 30 * 24 * 3600 * 1000, // 30-day persistence for LAN/TV
        };
        localStorage.setItem('gdrive_logged_in', 'true');
        localStorage.setItem('gdrive_oauth_token', JSON.stringify(tokenObj));
        document.cookie = `gdrive_token=${encodeURIComponent(urlToken)}; max-age=2592000; path=/; SameSite=Lax`;
        // Clean URL so token is not exposed in browser address bar
        window.history.replaceState({}, document.title, window.location.pathname);
        window.gapi.client.setToken(tokenObj);
        setIsSignedIn(true);
        setIsAuthRestoring(false);
        fetchUserVideos();
        return;
      }

      // 2. Check localStorage
      const savedTokenStr = localStorage.getItem('gdrive_oauth_token');
      const wasLoggedIn = localStorage.getItem('gdrive_logged_in') === 'true';

      if (savedTokenStr) {
        try {
          const parsed = JSON.parse(savedTokenStr);
          if (parsed?.access_token) {
            window.gapi.client.setToken(parsed);
            setIsSignedIn(true);
            setIsAuthRestoring(false);

            // If token has more than 2 minutes remaining, use immediately
            if (parsed.expires_at && parsed.expires_at > Date.now() + 120000) {
              fetchUserVideos();

              // Schedule background refresh before it expires
              const remainingMs = Math.max(60000, parsed.expires_at - Date.now() - 300000);
              if (tokenRefreshTimeoutRef.current) clearTimeout(tokenRefreshTimeoutRef.current);
              tokenRefreshTimeoutRef.current = setTimeout(() => {
                if (window.tokenClient) {
                  window.tokenClient.requestAccessToken({ prompt: '' });
                }
              }, remainingMs);
              return;
            } else {
              // Token is near or past expiration: load videos and trigger silent renewal as soon as GSI is ready
              fetchUserVideos().catch(() => {});
              if (window.tokenClient) {
                window.tokenClient.requestAccessToken({ prompt: '' });
              }
              return;
            }
          }
        } catch (e) {
          console.error('Failed to parse saved session token', e);
          setIsAuthRestoring(false);
        }
      } else if (wasLoggedIn && window.tokenClient) {
        // Was previously signed in: silent auto-login
        window.tokenClient.requestAccessToken({ prompt: '' });
        return;
      } else if (!wasLoggedIn && !savedTokenStr) {
        setIsAuthRestoring(false);
        setIsLoading(false);
      }
    }
  }, [isGapiLoaded, fetchUserVideos]);

  useEffect(() => {
    if (isGapiLoaded && isGsiLoaded && activeClientId) {
      try {
        window.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: SCOPES,
          callback: async (tokenResponse: any) => {
            setIsSigningIn(false);
            if (tokenResponse.error) {
              console.warn('Google Sign-In notice:', tokenResponse.error);
              if (tokenResponse.error !== 'interaction_required' && tokenResponse.error !== 'immediate_failed') {
                setError(`Google Sign-In Error: ${tokenResponse.error_description || tokenResponse.error}`);
              }
              setIsLoading(false);
              setIsAuthRestoring(false);
              return;
            }
            if (tokenResponse.access_token) {
              persistTokenSession(tokenResponse);
              setIsAuthRestoring(false);
              await fetchUserVideos();
            }
          },
        });

        // Check if we need to perform silent renewal for an existing/past session
        const savedTokenStr = localStorage.getItem('gdrive_oauth_token');
        const wasLoggedIn = localStorage.getItem('gdrive_logged_in') === 'true';

        if (wasLoggedIn) {
          let needsRefresh = true;
          if (savedTokenStr) {
            try {
              const parsed = JSON.parse(savedTokenStr);
              if (parsed?.expires_at && parsed.expires_at > Date.now() + 180000) {
                needsRefresh = false;
              }
            } catch (e) {}
          }
          if (needsRefresh) {
            console.log('[Nebula Auth] Performing silent session renewal on startup');
            window.tokenClient.requestAccessToken({ prompt: '' });
          }
        } else if (!savedTokenStr) {
          setIsLoading(false);
          setIsAuthRestoring(false);
        }
      } catch (err) {
        console.error('Error initializing token client', err);
        setError('Failed to initialize Google Sign-In. Check your Client ID configuration.');
        setIsLoading(false);
        setIsAuthRestoring(false);
        setIsSigningIn(false);
      }
    }
  }, [isGapiLoaded, isGsiLoaded, activeClientId, fetchUserVideos, persistTokenSession]);

  const handleLogin = () => {
    if (!window.tokenClient) {
      setError('Google Sign-In is initializing. Please click again in a moment.');
      return;
    }
    setIsSigningIn(true);
    if (!window.gapi?.client?.getToken()) {
      window.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      window.tokenClient.requestAccessToken({ prompt: '' });
    }
  };

  const handleLogout = () => {
    if (tokenRefreshTimeoutRef.current) clearTimeout(tokenRefreshTimeoutRef.current);
    // Clear cookie and localStorage session
    localStorage.removeItem('gdrive_oauth_token');
    localStorage.removeItem('gdrive_logged_in');
    document.cookie = 'gdrive_token=; max-age=0; path=/;';

    const token = window.gapi?.client?.getToken();
    if (token) {
      try {
        window.google?.accounts?.oauth2?.revoke(token.access_token, () => {});
      } catch (e) {
        console.error('Error revoking token:', e);
      }
      window.gapi.client.setToken(null);
    }
    setIsSignedIn(false);
    setIsAuthRestoring(false);
    setIsSigningIn(false);
    setIsLoading(false);
    setVideos([]);
    setSelectedVideo(null);
    setInitialResumeTime(undefined);
    setError(null);
  };

  const handleSelectVideo = (video: GoogleDriveFile, resumeTime?: number) => {
    setSelectedVideo(video);
    setInitialResumeTime(resumeTime);
  };

  const handleClosePlayer = () => {
    setSelectedVideo(null);
    setInitialResumeTime(undefined);
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');

  const filteredVideos = React.useMemo(() => {
    const list = videos.filter((v) => {
      if (!searchQuery.trim()) return true;
      return v.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    });

    if (sortBy === 'name') {
      return list.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'size') {
      return list.slice().sort((a, b) => {
        const sizeA = parseInt(a.size || '0', 10);
        const sizeB = parseInt(b.size || '0', 10);
        return sizeB - sizeA;
      });
    }
    return list;
  }, [videos, searchQuery, sortBy]);

  if (configError) {
    return (
      <div className="min-h-screen bg-[#07090e] text-gray-100 font-sans flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-6 rounded-2xl text-center max-w-lg mx-auto backdrop-blur-xl shadow-2xl">
          <h2 className="text-xl font-bold mb-2 text-white">Application Configuration Error</h2>
          <p className="text-xs text-red-300 leading-relaxed">{configError}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="min-h-screen bg-[#07090e] text-gray-100 font-sans relative overflow-x-hidden selection:bg-indigo-500/30 selection:text-indigo-200"
    >
      {/* Ambient background glow accents */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-b from-indigo-500/[0.07] to-transparent blur-3xl pointer-events-none -z-10" />

      <Header
        isSignedIn={isSignedIn}
        onLogout={handleLogout}
        token={window.gapi?.client?.getToken?.()?.access_token || ''}
      />

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-2xl text-xs sm:text-sm text-center mb-6 backdrop-blur-md animate-pop-in">
            {error}
          </div>
        )}

        {isAuthRestoring ? (
          <div className="flex flex-col justify-center items-center h-80 space-y-4">
            <MascotLogo size="xl" animated showBadge />
            <div className="flex items-center space-x-2 text-indigo-400">
              <Loader size="sm" />
              <p className="text-xs font-medium text-gray-300 font-mono tracking-wide">
                Connecting to Google Drive...
              </p>
            </div>
          </div>
        ) : !isSignedIn ? (
          <Login onLogin={handleLogin} isLoading={isSigningIn} />
        ) : isLoading ? (
          <div className="flex flex-col justify-center items-center h-80 space-y-4">
            <MascotLogo size="xl" animated showBadge />
            <div className="flex items-center space-x-2 text-indigo-400">
              <Loader size="sm" />
              <p className="text-xs font-medium text-gray-300 font-mono tracking-wide">
                Scanning Google Drive Library...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Search Capsule & Minimalist Toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0d1017]/80 p-3 sm:p-4 rounded-2xl border border-white/[0.06] backdrop-blur-xl shadow-lg">
              {/* Search input capsule */}
              <div className="relative flex-1 max-w-lg">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" strokeWidth="1.75" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search movies, series, anime, episodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 bg-[#08090e] border border-white/[0.06] focus:border-indigo-500/50 rounded-xl text-xs sm:text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white text-xs transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort & Quick Actions */}
              <div className="flex items-center justify-between sm:justify-end space-x-2 text-xs">
                <span className="text-gray-400 font-mono text-[11px] px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  {filteredVideos.length} {filteredVideos.length === 1 ? 'title' : 'titles'}
                </span>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[#08090e] border border-white/[0.06] text-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
                >
                  <option value="date">Recently Added</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="size">File Size (Largest)</option>
                </select>

                <button
                  onClick={fetchUserVideos}
                  title="Refresh library from Google Drive"
                  className="p-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white rounded-xl border border-white/[0.06] transition-all flex items-center justify-center group"
                >
                  <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Continue Watching Carousel (when not filtering) */}
            {!searchQuery.trim() && (
              <ContinueWatching onSelectVideo={handleSelectVideo} />
            )}

            <VideoGrid videos={filteredVideos} onSelectVideo={handleSelectVideo} />

            {/* Infinite Scroll / Lazy Load Trigger */}
            {nextPageToken && (
              <div ref={loadMoreRef} className="py-12 flex flex-col items-center justify-center space-y-3">
                {isLoadingMore ? (
                  <div className="flex items-center space-x-2.5 text-indigo-400">
                    <Loader size="sm" />
                    <span className="text-xs font-mono">Loading more videos...</span>
                  </div>
                ) : (
                  <button
                    onClick={loadMoreVideos}
                    className="px-6 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white rounded-xl text-xs font-medium border border-white/[0.08] transition-all duration-200 shadow-sm"
                  >
                    Load More Videos
                  </button>
                )}
              </div>
            )}

            {!nextPageToken && videos.length > 0 && (
              <div className="py-10 text-center text-[11px] text-gray-400 font-mono">
                All {videos.length} videos loaded from your Google Drive
              </div>
            )}
          </div>
        )}
      </main>

      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          initialSeekTime={initialResumeTime}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
};

export default App;