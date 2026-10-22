import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleDriveFile, GoogleDriveFolder, BreadcrumbItem } from '../types';
import { fetchFolderContents, getFolderMetadata } from '../services/googleDriveService';
import VideoItem from './VideoItem';
import Loader from './Loader';
import MascotLogo from './MascotLogo';

interface FolderExplorerProps {
  onSelectVideo: (video: GoogleDriveFile) => void;
  initialFolderId?: string;
  initialBreadcrumbs?: BreadcrumbItem[];
}

const Icons = {
  Folder: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-1.5V9a3 3 0 0 0-3-3h-3.379a3 3 0 0 1-2.121-.879L8.379 3.879A3 3 0 0 0 6.257 3H4.5A3 3 0 0 0 1.5 6v12a3 3 0 0 0 3 3h15Z" />
    </svg>
  ),
  FolderOpen: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M2 10h20" />
    </svg>
  ),
  Drive: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2L2 19.5h20L12 2Z" />
      <path d="M6.5 14h11" />
    </svg>
  ),
  ArrowUp: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Search: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Refresh: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  ),
  Video: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2.18" />
      <path d="m10 9 5 3-5 3V9z" />
    </svg>
  ),
};

const FolderExplorer: React.FC<FolderExplorerProps> = ({
  onSelectVideo,
  initialFolderId = 'root',
  initialBreadcrumbs = [{ id: 'root', name: 'My Drive' }],
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('folder');
      if (p) return p;
    }
    return initialFolderId;
  });

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('nebula_folder_breadcrumbs');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return initialBreadcrumbs;
  });

  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [videos, setVideos] = useState<GoogleDriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');

  // In-memory cache for fast back/forward folder navigation without API calls
  const folderCacheRef = useRef<Map<string, { folders: GoogleDriveFolder[]; videos: GoogleDriveFile[]; nextPageToken?: string }>>(new Map());

  // Save current folder to URL and sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('nebula_folder_id', currentFolderId);
      sessionStorage.setItem('nebula_folder_breadcrumbs', JSON.stringify(breadcrumbs));
      const url = new URL(window.location.href);
      if (currentFolderId === 'root') {
        url.searchParams.delete('folder');
      } else {
        url.searchParams.set('folder', currentFolderId);
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [currentFolderId, breadcrumbs]);

  // Load folder contents
  const loadFolder = useCallback(async (folderId: string, forceRefresh = false) => {
    if (!forceRefresh && folderCacheRef.current.has(folderId)) {
      const cached = folderCacheRef.current.get(folderId)!;
      setFolders(cached.folders);
      setVideos(cached.videos);
      setNextPageToken(cached.nextPageToken);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchFolderContents(folderId);
      setFolders(res.folders);
      setVideos(res.videos);
      setNextPageToken(res.nextPageToken);

      // Cache the result
      folderCacheRef.current.set(folderId, {
        folders: res.folders,
        videos: res.videos,
        nextPageToken: res.nextPageToken,
      });
    } catch (err: any) {
      console.error('[FolderExplorer] Failed to load folder contents:', err);
      const msg = err?.result?.error?.message || err?.message || 'Failed to open folder. Please check your network and permissions.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId, loadFolder]);

  // Handle navigating into a subfolder
  const handleOpenFolder = (folder: GoogleDriveFolder) => {
    setSearchQuery('');
    setBreadcrumbs((prev) => {
      // Avoid duplicate crumb
      const filtered = prev.filter((b) => b.id !== folder.id);
      return [...filtered, { id: folder.id, name: folder.name }];
    });
    setCurrentFolderId(folder.id);
  };

  // Handle clicking a specific breadcrumb
  const handleNavigateToBreadcrumb = (crumb: BreadcrumbItem, index: number) => {
    if (crumb.id === currentFolderId) return;
    setSearchQuery('');
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(crumb.id);
  };

  // Handle going up one level
  const handleNavigateUp = () => {
    if (breadcrumbs.length <= 1) return;
    setSearchQuery('');
    const newCrumbs = breadcrumbs.slice(0, breadcrumbs.length - 1);
    setBreadcrumbs(newCrumbs);
    const parent = newCrumbs[newCrumbs.length - 1];
    setCurrentFolderId(parent ? parent.id : 'root');
  };

  // Handle refreshing current folder
  const handleRefresh = () => {
    folderCacheRef.current.delete(currentFolderId);
    loadFolder(currentFolderId, true);
  };

  // Filtered and sorted folders
  const filteredFolders = useMemo(() => {
    let list = folders;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [folders, searchQuery]);

  // Filtered and sorted videos
  const filteredVideos = useMemo(() => {
    let list = videos;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((v) => v.name.toLowerCase().includes(q));
    }

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
    if (sortBy === 'date') {
      return list.slice().sort((a, b) => {
        const timeA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
        const timeB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
        return timeB - timeA;
      });
    }
    return list;
  }, [videos, searchQuery, sortBy]);

  const isRoot = currentFolderId === 'root';
  const totalItems = folders.length + videos.length;

  return (
    <div className="space-y-5 animate-pop-in">
      {/* Navigation Capsule: Breadcrumbs & Actions */}
      <div className="glass-panel p-3 sm:p-4 rounded-3xl border border-white/10 shadow-2xl space-y-3">
        {/* Top Row: Breadcrumb Path and Quick Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Breadcrumbs Trail */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
            {/* Up Button */}
            {!isRoot && (
              <button
                onClick={handleNavigateUp}
                className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-gray-300 hover:text-white border border-white/[0.08] flex items-center justify-center transition-all shrink-0 mr-1 shadow-sm"
                title="Up one folder"
              >
                <Icons.ArrowUp className="w-4 h-4 text-indigo-400" />
              </button>
            )}

            {/* Breadcrumb segments */}
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const isCrumbRoot = crumb.id === 'root';
              return (
                <React.Fragment key={crumb.id}>
                  {index > 0 && (
                    <Icons.ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  )}
                  <button
                    onClick={() => handleNavigateToBreadcrumb(crumb, index)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 shrink-0 font-medium ${
                      isLast
                        ? 'bg-gradient-to-r from-indigo-600/30 to-indigo-500/20 text-white border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {isCrumbRoot ? (
                      <Icons.Drive className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    ) : (
                      <Icons.FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                    <span className="truncate max-w-[140px] sm:max-w-[200px]">{crumb.name}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Right Action Tools: Item Counter, Sorter & Refresh */}
          <div className="flex items-center justify-between sm:justify-end space-x-2 shrink-0">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/[0.035] border border-white/[0.06] text-gray-400 font-mono text-[11px]">
              <span className="text-gray-200 font-semibold">{folders.length}</span>
              <span>folders</span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-200 font-semibold">{videos.length}</span>
              <span>videos</span>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#07090f]/90 border border-white/[0.08] text-gray-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
            >
              <option value="name">Name (A-Z)</option>
              <option value="date">Recently Modified</option>
              <option value="size">File Size (Largest)</option>
            </select>

            <button
              onClick={handleRefresh}
              title="Refresh this folder"
              className="p-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white rounded-xl border border-white/[0.08] transition-all flex items-center justify-center group"
            >
              <Icons.Refresh className="w-3.5 h-3.5 transition-transform group-hover:rotate-180 duration-500" />
            </button>
          </div>
        </div>

        {/* Search Bar for current folder */}
        {totalItems > 4 && (
          <div className="relative pt-1 border-t border-white/[0.04]">
            <span className="absolute inset-y-0 left-0 pl-3 pt-1 flex items-center pointer-events-none text-indigo-400">
              <Icons.Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder={`Filter items in ${breadcrumbs[breadcrumbs.length - 1]?.name || 'current folder'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#07090f]/80 border border-white/[0.06] focus:border-indigo-500/60 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 pt-1 flex items-center text-gray-500 hover:text-white text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-2xl text-xs text-center backdrop-blur-md animate-pop-in">
          {error}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading ? (
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <MascotLogo size="lg" animated showBadge />
          <div className="flex items-center space-x-2 text-indigo-400">
            <Loader size="sm" />
            <span className="text-xs font-mono text-gray-300">Reading Google Drive folder...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subfolders Section */}
          {filteredFolders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 px-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <Icons.FolderOpen className="w-4 h-4 text-indigo-400" />
                <span>Folders ({filteredFolders.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleOpenFolder(folder)}
                    className="w-full text-left glass-card hover:bg-white/[0.08] border border-white/[0.08] hover:border-indigo-500/50 rounded-2xl p-3 sm:p-3.5 transition-all duration-200 cursor-pointer group flex items-center justify-between shadow-md hover:shadow-[0_0_20px_rgba(99,102,241,0.22)] hover:scale-[1.01]"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-indigo-400/60 transition-transform">
                        <Icons.Folder className="w-5 h-5 text-indigo-400 group-hover:text-cyan-300 transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-gray-200 group-hover:text-white truncate" title={folder.name}>
                          {folder.name}
                        </p>
                        <span className="text-[10px] text-gray-500 font-mono">Folder</span>
                      </div>
                    </div>
                    <Icons.ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Videos in Current Folder */}
          {filteredVideos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 px-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <Icons.Video className="w-4 h-4 text-emerald-400" />
                <span>Videos ({filteredVideos.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
                {filteredVideos.map((video) => (
                  <VideoItem key={video.id} video={video} onSelect={onSelectVideo} />
                ))}
              </div>
            </div>
          )}

          {/* Empty Folder State */}
          {filteredFolders.length === 0 && filteredVideos.length === 0 && (
            <div className="text-center py-20 px-4">
              <div className="max-w-md mx-auto glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />
                <div className="mb-4 flex justify-center transform hover:scale-105 transition-transform duration-300">
                  <MascotLogo size="lg" animated showBadge />
                </div>
                <h3 className="text-base font-bold text-white mb-1.5 tracking-tight">
                  {searchQuery ? 'No Matching Items' : 'This Folder is Empty'}
                </h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed mb-5">
                  {searchQuery
                    ? `No folders or videos matched "${searchQuery}" in this directory.`
                    : 'There are no subfolders or playable video files in this folder.'}
                </p>
                {!isRoot && (
                  <button
                    onClick={handleNavigateUp}
                    className="px-5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-xs font-medium text-white transition-all inline-flex items-center space-x-2 shadow-lg"
                  >
                    <Icons.ArrowUp className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Back to Parent Folder</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FolderExplorer;
