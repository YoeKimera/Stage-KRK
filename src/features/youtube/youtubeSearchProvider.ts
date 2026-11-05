import type { YouTubeSearchProvider, YouTubeVideoResult } from './youtube.types';

const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
const MAX_RESULTS = 10;

interface YouTubeApiResponse {
  items?: Array<{
    id?: { kind?: string; videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      description?: string;
      thumbnails?: {
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  error?: { message?: string; errors?: Array<{ reason?: string }> };
}

export function createYouTubeSearchProvider(apiKey: string): YouTubeSearchProvider {
  const key = apiKey.trim();

  return {
    isAvailable: () => Boolean(key),
    async search(query, signal) {
      const normalizedQuery = query.trim();
      if (!key) throw new Error('Configura VITE_YOUTUBE_API_KEY para habilitar la búsqueda.');
      if (!normalizedQuery) throw new Error('Escribe qué video quieres buscar.');

      const url = new URL(SEARCH_ENDPOINT);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('videoEmbeddable', 'true');
      url.searchParams.set('maxResults', String(MAX_RESULTS));
      url.searchParams.set('q', normalizedQuery);
      url.searchParams.set('key', key);

      let response: Response;
      try {
        response = await fetch(url, { signal });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new Error('No se pudo conectar con YouTube. Comprueba tu conexión e intenta de nuevo.');
      }

      let data: YouTubeApiResponse;
      try {
        data = await response.json() as YouTubeApiResponse;
      } catch {
        throw new Error(`YouTube respondió con datos no válidos (HTTP ${response.status}).`);
      }

      if (!response.ok) {
        const reason = data.error?.errors?.[0]?.reason;
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
          throw new Error('Se agotó la cuota diaria de búsqueda de YouTube. Inténtalo mañana o revisa Google Cloud Console.');
        }
        if (response.status === 403 || reason === 'keyInvalid' || reason === 'accessNotConfigured') {
          throw new Error('La API key de YouTube no es válida, no tiene permisos o no permite este origen. Revisa Google Cloud y las restricciones HTTP referrer.');
        }
        throw new Error(data.error?.message ?? `La búsqueda de YouTube falló (HTTP ${response.status}).`);
      }

      return (data.items ?? []).flatMap((item) => {
        const videoId = item.id?.videoId;
        const snippet = item.snippet;
        if (item.id?.kind !== 'youtube#video' || !videoId || !snippet) return [];
        return [{
          id: videoId,
          title: snippet.title ?? 'Video sin título',
          channelTitle: snippet.channelTitle ?? 'Canal desconocido',
          description: snippet.description ?? '',
          thumbnailUrl: getSafeThumbnailUrl(snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url),
        }];
      });
    },
  };
}

function getSafeThumbnailUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && (url.hostname === 'i.ytimg.com' || url.hostname.endsWith('.ytimg.com'))) {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function getVideoUrl(video: YouTubeVideoResult): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
}
