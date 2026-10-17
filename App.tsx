import React, { useState, useEffect, useCallback } from 'react';
import { GoogleDriveFile, TokenClient } from './types';
import { fetchVideosPage } from './services/googleDriveService';
import Header from './components/Header';
import Login from './components/Login';
import VideoGrid from './components/VideoGrid';
import VideoPlayer from './components/VideoPlayer';
import Loader from './components/Loader';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID, SCOPES } from './constants';

declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: TokenClient;
  }
}

const App: React.FC = () => {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [videos, setVideos] = useState<GoogleDriveFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GoogleDriveFile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setConfigError("Configuration error: Google Client ID is missing. Please set GOOGLE_CLIENT_ID in your .env.local file.");
      setIsLoading(false);
      return;
    }
    
    // Check for placeholder values
    if (GOOGLE_CLIENT_ID.includes('YOUR_') || (GOOGLE_API_KEY && GOOGLE_API_KEY.includes('YOUR_'))) {
        setConfigError("Configuration error: Please replace placeholder Client ID with your actual credentials.");
        setIsLoading(false);
        return;
    }

    const scriptGapi = document.createElement('script');
    scriptGapi.src = 'https://apis.google.com/js/api.js';
    scriptGapi.async = true;
    scriptGapi.defer = true;
    scriptGapi.onload = () => {
      window.gapi.load('client', () => {
        const initConfig: { discoveryDocs: string[]; apiKey?: string } = {
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        };
        if (GOOGLE_API_KEY && GOOGLE_API_KEY.trim().length > 0) {
          initConfig.apiKey = GOOGLE_API_KEY.trim();
        }

        window.gapi.client.init(initConfig).then(() => {
          setIsGapiLoaded(true);
        }).catch((err: any) => {
            console.error("Error initializing gapi client:", err);
            const detailMsg = err?.error?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            setError(`Failed to initialize Google API client (${detailMsg}). Ensure Google Drive API is enabled in your Google Cloud Console.`);
            setIsLoading(false);
        });
      });
    };
    scriptGapi.onerror = () => {
        setError("Failed to load Google API script. Please check your network connection and ad-blockers.");
        setIsLoading(false);
    }
    document.body.appendChild(scriptGapi);

    const scriptGsi = document.createElement('script');
    scriptGsi.src = 'https://accounts.google.com/gsi/client';
    scriptGsi.async = true;
    scriptGsi.defer = true;
    scriptGsi.onload = () => {
        setIsGsiLoaded(true);
    };
    scriptGsi.onerror = () => {
        setError("Failed to load Google Sign-In script. Please check your network connection and ad-blockers.");
        setIsLoading(false);
    }
    document.body.appendChild(scriptGsi);

    return () => {
        if (document.body.contains(scriptGapi)) document.body.removeChild(scriptGapi);
        if (document.body.contains(scriptGsi)) document.body.removeChild(scriptGsi);
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


  // Restore persistent login session from URL query param / cookie / localStorage
  useEffect(() => {
    if (isGapiLoaded) {
      // 1. Check for token in URL query parameter (for instant LAN / mobile streaming)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token') || urlParams.get('auth_token');
      if (urlToken) {
        const tokenObj = {
          access_token: urlToken,
          expires_at: Date.now() + 3600 * 1000,
        };
        localStorage.setItem('gdrive_oauth_token', JSON.stringify(tokenObj));
        document.cookie = `gdrive_token=${encodeURIComponent(urlToken)}; max-age=3600; path=/; SameSite=Lax`;
        // Clean URL so token is not exposed in browser address bar
        window.history.replaceState({}, document.title, window.location.pathname);
        window.gapi.client.setToken(tokenObj);
        setIsSignedIn(true);
        fetchUserVideos();
        return;
      }

      // 2. Check localStorage
      const savedTokenStr = localStorage.getItem('gdrive_oauth_token');
      if (savedTokenStr) {
        try {
          const parsed = JSON.parse(savedTokenStr);
          if (parsed?.access_token && parsed?.expires_at && parsed.expires_at > Date.now()) {
            window.gapi.client.setToken(parsed);
            setIsSignedIn(true);
            fetchUserVideos();
            return;
          } else {
            localStorage.removeItem('gdrive_oauth_token');
            document.cookie = 'gdrive_token=; max-age=0; path=/;';
          }
        } catch (e) {
          console.error('Failed to parse saved session token', e);
        }
      }
    }
  }, [isGapiLoaded, fetchUserVideos]);

  useEffect(() => {
    if (isGapiLoaded && isGsiLoaded) {
      try {
        window.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setError(`Google Sign-In Error: ${tokenResponse.error_description || tokenResponse.error}`);
              setIsLoading(false);
              return;
            }
            if (tokenResponse.access_token) {
              window.gapi.client.setToken(tokenResponse);

              // Persist token in localStorage and cookies for seamless session retention
              const expiresIn = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in, 10) : 3600;
              const expiresAt = Date.now() + (expiresIn - 60) * 1000;
              localStorage.setItem(
                'gdrive_oauth_token',
                JSON.stringify({ ...tokenResponse, expires_at: expiresAt })
              );
              document.cookie = `gdrive_token=${encodeURIComponent(tokenResponse.access_token)}; max-age=${expiresIn}; path=/; SameSite=Lax`;

              setIsSignedIn(true);
              await fetchUserVideos();
            }
          },
        });

        // If not restoring an existing token, finished initial loading
        const savedTokenStr = localStorage.getItem('gdrive_oauth_token');
        if (!savedTokenStr) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error initializing token client', err);
        setError('Failed to initialize Google Sign-In. Check your Client ID configuration.');
        setIsLoading(false);
      }
    }
  }, [isGapiLoaded, isGsiLoaded, fetchUserVideos]);

  const handleLogin = () => {
    if (!window.tokenClient) {
      setError('Google Sign-In is not ready yet. Please wait a moment.');
      return;
    }
    setIsLoading(true);
    if (!window.gapi?.client?.getToken()) {
      window.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      window.tokenClient.requestAccessToken({ prompt: '' });
    }
  };

  const handleLogout = () => {
    // Clear cookie and localStorage session
    localStorage.removeItem('gdrive_oauth_token');
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
    setVideos([]);
    setSelectedVideo(null);
    setError(null);
  };

  const handleSelectVideo = (video: GoogleDriveFile) => {
    setSelectedVideo(video);
  };

  const handleClosePlayer = () => {
    setSelectedVideo(null);
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
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex items-center justify-center p-4">
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-6 rounded-lg text-center max-w-lg mx-auto">
                <h2 className="text-2xl font-bold mb-2 text-white">Application Configuration Error</h2>
                <p>{configError}</p>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header
        isSignedIn={isSignedIn}
        onLogout={handleLogout}
        token={window.gapi?.client?.getToken?.()?.access_token || ''}
      />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-md text-center mb-6">{error}</div>}
        
        {!isSignedIn ? (
          <Login onLogin={handleLogin} isLoading={isLoading || !isGapiLoaded || !isGsiLoaded} />
        ) : isLoading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
            <Loader />
            <p className="text-sm text-gray-400">Loading your Google Drive video library...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Library Search & Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-gray-800/60 p-4 rounded-xl border border-gray-700/60 backdrop-blur-sm">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search movies, series, episodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort & Stats */}
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-gray-400 font-medium">
                  {filteredVideos.length} {filteredVideos.length === 1 ? 'video' : 'videos'}
                </span>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="date">Sort: Recently Added</option>
                  <option value="name">Sort: Name (A-Z)</option>
                  <option value="size">Sort: Size (Largest)</option>
                </select>

                <button
                  onClick={fetchUserVideos}
                  title="Refresh library from Google Drive"
                  className="px-3 py-2 bg-gray-700/70 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors flex items-center space-x-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <VideoGrid videos={filteredVideos} onSelectVideo={handleSelectVideo} />

            {/* Infinite Scroll / Lazy Load Trigger */}
            {nextPageToken && (
              <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center space-y-3">
                {isLoadingMore ? (
                  <div className="flex items-center space-x-3 text-indigo-400">
                    <Loader />
                    <span className="text-sm font-medium">Loading more videos...</span>
                  </div>
                ) : (
                  <button
                    onClick={loadMoreVideos}
                    className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-gray-700 transition-colors shadow"
                  >
                    Load More Videos
                  </button>
                )}
              </div>
            )}

            {!nextPageToken && videos.length > 0 && (
              <div className="py-8 text-center text-xs text-gray-500 font-mono">
                ✓ All {videos.length} videos loaded from your Google Drive
              </div>
            )}
          </div>
        )}
      </main>
      {selectedVideo && (
        <VideoPlayer video={selectedVideo} onClose={handleClosePlayer} />
      )}
    </div>
  );
};

export default App;