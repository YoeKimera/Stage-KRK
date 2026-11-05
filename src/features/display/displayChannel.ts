import type { VideoPlaybackStatus } from '../audio/usePlaybackController';

export const DISPLAY_CHANNEL_PREFIX = 'stage-karaoke-display:';

export interface DisplaySnapshot {
  type: 'snapshot';
  mediaId?: string;
  sourceId?: string;
  youtubeVideoId?: string;
  title?: string;
  file?: File;
  status: VideoPlaybackStatus;
  currentTime: number;
}

export type DisplayMessage = DisplaySnapshot | { type: 'ready' } | { type: 'display-error'; message: string };
