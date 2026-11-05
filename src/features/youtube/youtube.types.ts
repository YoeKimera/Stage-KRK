export interface YouTubeVideoResult {
  id: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl?: string;
}

export interface YouTubePlayerHandle {
  play(): void;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  fadeTo(volume: number, durationMs: number): Promise<void>;
  getCurrentTime(): number;
}

export type YouTubePlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface YouTubeSearchProvider {
  isAvailable(): boolean;
  search(query: string, signal?: AbortSignal): Promise<YouTubeVideoResult[]>;
}

export interface DownloadRequest {
  sourceUrl: string;
  title?: string;
  preferredFormat: 'mp4';
}

export interface DownloadProgress {
  status: 'queued' | 'processing' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

export interface DownloadProvider {
  isAvailable(): Promise<boolean>;
  download(
    request: DownloadRequest,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<Blob>;
}
