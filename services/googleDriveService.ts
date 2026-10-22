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

/**
 * Fetch subfolders and videos inside a specific Google Drive folder ID ('root' for top-level My Drive).
 */
export const fetchFolderContents = async (
  folderId: string = 'root',
  pageToken?: string,
  pageSize: number = 60
): Promise<FolderContentsResult> => {
  try {
    const query = `'${folderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'video/' or mimeType = 'application/x-matroska') and trashed = false`;

    const params: any = {
      pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink, videoMediaMetadata, size, modifiedTime, parents)',
      q: query,
      orderBy: 'folder, name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = await window.gapi.client.drive.files.list(params);
    const files: any[] = response.result.files || [];

    const folders: GoogleDriveFolder[] = [];
    const videos: GoogleDriveFile[] = [];

    for (const file of files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        folders.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          parents: file.parents,
          modifiedTime: file.modifiedTime,
        });
      } else {
        videos.push(file);
      }
    }

    return {
      folders,
      videos,
      nextPageToken: response.result.nextPageToken || undefined,
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
      fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink, videoMediaMetadata, size, modifiedTime)',
      q: query,
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
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
