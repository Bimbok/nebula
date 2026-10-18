import { GoogleDriveFile, WatchProgress } from '../types';

const STORAGE_KEY = 'nebula_watch_progress';
const MAX_ITEMS = 24;

/**
 * Get all stored watch progress items, filtered and sorted by most recently watched.
 */
export const getContinueWatchingList = (): WatchProgress[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: WatchProgress[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    // Filter out items that are almost finished (>= 95%) or barely started (< 5s)
    return list
      .filter((item) => item && item.fileId && item.currentTime >= 5 && item.progressPercent < 95)
      .sort((a, b) => b.lastWatched - a.lastWatched)
      .slice(0, MAX_ITEMS);
  } catch (err) {
    console.error('Failed to load continue watching list from localStorage:', err);
    return [];
  }
};

/**
 * Get watch progress for a single video file.
 */
export const getWatchProgress = (fileId: string): WatchProgress | null => {
  if (typeof window === 'undefined' || !fileId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const list: WatchProgress[] = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const match = list.find((item) => item.fileId === fileId);
    return match || null;
  } catch (err) {
    console.error('Failed to get watch progress for', fileId, err);
    return null;
  }
};

/**
 * Save or update watch progress for a video.
 */
export const saveWatchProgress = (
  video: GoogleDriveFile,
  currentTime: number,
  duration: number,
  extra?: { audioIndex?: string; subtitleId?: string }
): void => {
  if (typeof window === 'undefined' || !video?.id) return;

  // Don't record trivial skips (< 3 seconds)
  if (currentTime < 3) return;

  const validDuration =
    duration > 0
      ? duration
      : video.videoMediaMetadata?.durationMillis
      ? parseInt(video.videoMediaMetadata.durationMillis, 10) / 1000
      : 0;

  const progressPercent = validDuration > 0 ? Math.min(100, Math.max(0, (currentTime / validDuration) * 100)) : 0;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: WatchProgress[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      } catch (e) {
        list = [];
      }
    }

    // Remove existing entry for this video
    list = list.filter((item) => item.fileId !== video.id);

    // If progress is not finished (< 95%), record it
    if (progressPercent < 95) {
      const newItem: WatchProgress = {
        fileId: video.id,
        name: video.name,
        currentTime: Math.floor(currentTime),
        duration: Math.floor(validDuration),
        progressPercent: Math.round(progressPercent * 10) / 10,
        thumbnailLink: video.thumbnailLink,
        videoMediaMetadata: video.videoMediaMetadata,
        size: video.size,
        lastWatched: Date.now(),
        audioIndex: extra?.audioIndex,
        subtitleId: extra?.subtitleId,
      };

      list.unshift(newItem);
    }

    // Keep within storage quota
    list = list.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    // Dispatch update event for reactive UI components
    window.dispatchEvent(new CustomEvent('nebula_watch_progress_updated', { detail: { fileId: video.id } }));
  } catch (err) {
    console.error('Failed to save watch progress to localStorage:', err);
  }
};

/**
 * Remove an item from the continue watching list.
 */
export const removeWatchProgress = (fileId: string): void => {
  if (typeof window === 'undefined' || !fileId) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let list: WatchProgress[] = JSON.parse(raw);
    if (!Array.isArray(list)) return;

    list = list.filter((item) => item.fileId !== fileId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    window.dispatchEvent(new CustomEvent('nebula_watch_progress_updated', { detail: { fileId } }));
  } catch (err) {
    console.error('Failed to remove watch progress:', err);
  }
};

/**
 * Clear all watch progress history.
 */
export const clearAllWatchProgress = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('nebula_watch_progress_updated'));
  } catch (err) {
    console.error('Failed to clear watch progress:', err);
  }
};
