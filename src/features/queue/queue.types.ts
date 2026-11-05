import type { LibraryMediaFile } from '../library/library.types';
import type { YouTubeVideoResult } from '../youtube/youtube.types';

export type QueueTrack =
  | { kind: 'local'; media: LibraryMediaFile }
  | { kind: 'youtube'; video: YouTubeVideoResult };

export interface QueueItem {
  queueId: string;
  track: QueueTrack;
  addedAt: number;
}
