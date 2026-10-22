export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
  videoMediaMetadata?: {
    durationMillis?: string;
    width?: number;
    height?: number;
  };
  size?: string;
  parents?: string[];
  modifiedTime?: string;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  isSharedDrive?: boolean;
  isShortcut?: boolean;
  isSharedWithMe?: boolean;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface GapiResponse {
  result: {
    files: GoogleDriveFile[];
  };
}

export interface TokenClient {
  requestAccessToken: (overrideConfig: { prompt: string }) => void;
}

export interface CodeClient {
  requestCode: () => void;
}

export interface AudioTrackInfo {
  id: number;
  streamIndex: number;
  codec: string;
  channels?: number;
  language: string;
  label: string;
}

export interface SubtitleTrackInfo {
  id: number;
  streamIndex: number;
  codec: string;
  language: string;
  label: string;
  isCustom?: boolean;
  blobUrl?: string;
  isBitmap?: boolean;
}

export interface WatchProgress {
  fileId: string;
  name: string;
  currentTime: number;
  duration: number;
  progressPercent: number;
  thumbnailLink?: string;
  videoMediaMetadata?: {
    durationMillis?: string;
    width?: number;
    height?: number;
  };
  size?: string;
  lastWatched: number;
  audioIndex?: string;
  subtitleId?: string;
}

