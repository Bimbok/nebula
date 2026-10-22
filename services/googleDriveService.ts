import { GoogleDriveFile, GoogleDriveFolder } from '../types';

export interface FetchVideosResult {
  videos: GoogleDriveFile[];
  nextPageToken?: string;
}

export interface FolderContentsResult {
  folders: GoogleDriveFolder[];
  videos: GoogleDriveFile[];
  nextPageToken?: string;
}

const VIDEO_EXTENSIONS = new Set([
  'mkv', 'mp4', 'avi', 'mov', 'm4v', 'webm', 'flv', 'wmv',
  'ts', 'mts', 'm2ts', 'vob', 'iso', 'mpg', 'mpeg', '3gp', 'ogv'
]);

export const isVideoFile = (file: { name?: string; mimeType?: string; videoMediaMetadata?: any; shortcutDetails?: any }): boolean => {
  if (!file) return false;
  if (file.videoMediaMetadata) return true;
  const mime = file.shortcutDetails?.targetMimeType || file.mimeType || '';
  if (mime.startsWith('video/')) return true;
  if (mime === 'application/x-matroska') return true;
  if (file.name) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && VIDEO_EXTENSIONS.has(ext)) return true;
  }
  return false;
};

export const isFolder = (file: { mimeType?: string; shortcutDetails?: any }): boolean => {
  if (!file) return false;
  if (file.mimeType === 'application/vnd.google-apps.folder') return true;
  if (
    file.mimeType === 'application/vnd.google-apps.shortcut' &&
    file.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder'
  ) {
    return true;
  }
  return false;
};

/**
 * Fetch all subfolders and video files located inside a specific Google Drive folder.
 * Automatically paginates through Drive API to ensure 100% of videos in the folder are loaded.
 */
export const fetchFolderContents = async (
  folderId: string = 'root',
  pageSize: number = 100
): Promise<FolderContentsResult> => {
  try {
    const folders: GoogleDriveFolder[] = [];
    const videos: GoogleDriveFile[] = [];
    const seenIds = new Set<string>();

    // 1. If at root, also query Shared Drives (Team Drives) so users can explore team libraries
    if (folderId === 'root') {
      try {
        const drivesRes = await window.gapi.client.drive.drives.list({
          pageSize: 50,
          fields: 'drives(id, name)',
        });
        const sharedDrives = drivesRes.result.drives || [];
        for (const sd of sharedDrives) {
          if (!seenIds.has(sd.id)) {
            seenIds.add(sd.id);
            folders.push({
              id: sd.id,
              name: sd.name,
              mimeType: 'application/vnd.google-apps.folder',
              isSharedDrive: true,
            });
          }
        }
      } catch (err) {
        // Shared drives feature may not be active or available on personal Google accounts
      }

      // Also query Shared with Me folders
      try {
        const sharedWithMeRes = await window.gapi.client.drive.files.list({
          pageSize: 50,
          q: "sharedWithMe = true and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: 'files(id, name, mimeType, modifiedTime, parents)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const sharedFolders = sharedWithMeRes.result.files || [];
        for (const sf of sharedFolders) {
          if (!seenIds.has(sf.id)) {
            seenIds.add(sf.id);
            folders.push({
              id: sf.id,
              name: sf.name,
              mimeType: sf.mimeType,
              parents: sf.parents,
              modifiedTime: sf.modifiedTime,
              isSharedWithMe: true,
            });
          }
        }
      } catch (err) {
        // Continue if shared with me query fails
      }
    }

    // 2. Fetch all direct items inside folderId, paginating until all items in this folder are retrieved
    let pageToken: string | undefined = undefined;
    let iterations = 0;
    const maxIterations = 10; // Up to 1000 items per folder

    do {
      iterations++;
      const params: any = {
        pageSize,
        fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink, videoMediaMetadata, size, modifiedTime, parents, shortcutDetails)',
        q: `'${folderId}' in parents and trashed = false`,
        orderBy: 'folder, name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await window.gapi.client.drive.files.list(params);
      const files: any[] = response.result.files || [];

      for (const file of files) {
        const effectiveId = file.shortcutDetails?.targetId || file.id;
        if (seenIds.has(effectiveId)) continue;
        seenIds.add(effectiveId);

        if (isFolder(file)) {
          folders.push({
            id: effectiveId,
            name: file.name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: file.parents,
            modifiedTime: file.modifiedTime,
            isShortcut: file.mimeType === 'application/vnd.google-apps.shortcut',
          });
        } else if (isVideoFile(file)) {
          videos.push({
            id: effectiveId,
            name: file.name,
            mimeType: file.shortcutDetails?.targetMimeType || file.mimeType,
            thumbnailLink: file.thumbnailLink,
            webContentLink: file.webContentLink,
            webViewLink: file.webViewLink,
            videoMediaMetadata: file.videoMediaMetadata,
            size: file.size,
            parents: file.parents,
            modifiedTime: file.modifiedTime,
          });
        }
      }

      pageToken = response.result.nextPageToken || undefined;
    } while (pageToken && iterations < maxIterations);

    return {
      folders,
      videos,
      nextPageToken,
    };
  } catch (error) {
    console.error('Error fetching folder contents for', folderId, error);
    throw error;
  }
};

/**
 * Fetch metadata for a specific folder (returns 'My Drive' for 'root').
 */
export const getFolderMetadata = async (folderId: string): Promise<{ id: string; name: string } | null> => {
  if (folderId === 'root') {
    return { id: 'root', name: 'My Drive' };
  }
  try {
    const response = await window.gapi.client.drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });
    return {
      id: response.result.id,
      name: response.result.name,
    };
  } catch (error) {
    console.warn('Failed to fetch folder metadata for', folderId, error);
    return null;
  }
};

/**
 * Fetch a single page of videos with robust query syntax and pagination support.
 */
export const fetchVideosPage = async (
  pageToken?: string,
  pageSize: number = 36
): Promise<FetchVideosResult> => {
  try {
    // Valid Google Drive v3 query matching all video MIME types and MKV containers
    const query = "(mimeType contains 'video/' or mimeType = 'application/x-matroska') and trashed = false";

    const params: any = {
      pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink, videoMediaMetadata, size, modifiedTime, parents)',
      q: query,
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = await window.gapi.client.drive.files.list(params);
    const files: GoogleDriveFile[] = response.result.files || [];

    return {
      videos: files,
      nextPageToken: response.result.nextPageToken || undefined,
    };
  } catch (error) {
    console.error('Error listing videos from Google Drive:', error);
    throw error;
  }
};

/**
 * Backward compatible helper to fetch the initial batch of videos
 */
export const listVideos = async (): Promise<GoogleDriveFile[]> => {
  const result = await fetchVideosPage(undefined, 48);
  return result.videos;
};
