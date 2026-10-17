import { GoogleDriveFile } from '../types';

export interface FetchVideosResult {
  videos: GoogleDriveFile[];
  nextPageToken?: string;
}

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
