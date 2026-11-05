import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { YouTubePlayerHandle, YouTubePlaybackStatus } from './youtube.types';

interface YouTubePlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange: (event: { target: YouTubePlayerInstance; data: number }) => void;
        onError: (event: { data: number }) => void;
        onAutoplayBlocked?: () => void;
      };
    },
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | undefined;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      apiPromise = undefined;
      reject(new Error('YouTube tardó demasiado en cargar el reproductor. Comprueba tu conexión o las restricciones de red.'));
    }, 20_000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else {
        apiPromise = undefined;
        reject(new Error('La API de reproducción de YouTube no se inicializó correctamente.'));
      }
      previousCallback?.();
    };

    if (!document.querySelector('script[data-stage-youtube-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.stageYoutubeApi = 'true';
      script.onerror = () => {
        window.clearTimeout(timeout);
        apiPromise = undefined;
        reject(new Error('No se pudo cargar el reproductor oficial de YouTube.'));
      };
      document.head.append(script);
    }
  });
  return apiPromise;
}

interface YouTubeEmbedProps {
  videoId: string;
  active: boolean;
  volume?: number;
  muted?: boolean;
  mirrorStatus?: YouTubePlaybackStatus;
  mirrorTime?: number;
  onPlayer?: (player: YouTubePlayerHandle | null) => void;
  onStatus?: (status: YouTubePlaybackStatus) => void;
  onTime?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
  onAutoplayBlocked?: () => void;
}

export function YouTubeEmbed({
  videoId,
  active,
  volume = 1,
  muted = false,
  mirrorStatus,
  mirrorTime = 0,
  onPlayer,
  onStatus,
  onTime,
  onEnded,
  onError,
  onAutoplayBlocked,
}: YouTubeEmbedProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const fadeRef = useRef<{ timer: number; resolve: () => void } | undefined>(undefined);
  const callbacksRef = useRef({ onPlayer, onStatus, onTime, onEnded, onError, onAutoplayBlocked });
  callbacksRef.current = { onPlayer, onStatus, onTime, onEnded, onError, onAutoplayBlocked };
  const initialVolume = useRef(volume);
  const initialMuted = useRef(muted);

  useEffect(() => {
    if (!active || !hostRef.current) return;
    let disposed = false;
    let player: YouTubePlayerInstance | undefined;
    let pollTimer = 0;

    void loadYouTubeApi().then((api) => {
      if (disposed || !hostRef.current) return;
      player = new api.Player(hostRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          enablejsapi: 1,
          fs: 1,
          playsinline: 1,
          origin: window.location.origin,
          rel: 0,
        },
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            playerRef.current = target;
            target.setVolume(Math.round(initialVolume.current * 100));
            if (initialMuted.current) target.mute();
            callbacksRef.current.onPlayer?.(createPlayerHandle(target, fadeRef));
            if (mirrorStatus) {
              synchronizeMirror(target, mirrorStatus, mirrorTime);
            } else {
              target.playVideo();
            }
          },
          onStateChange: ({ target, data }) => {
            const status = data === 1 ? 'playing' : data === 2 ? 'paused' : data === 0 ? 'idle' : 'loading';
            callbacksRef.current.onStatus?.(status);
            if (data === 0) callbacksRef.current.onEnded?.();
            if (data === 1 || data === 2 || data === 5) {
              callbacksRef.current.onTime?.(target.getCurrentTime(), target.getDuration());
            }
          },
          onError: ({ data }) => callbacksRef.current.onError?.(describeYouTubeError(data)),
          onAutoplayBlocked: () => callbacksRef.current.onAutoplayBlocked?.(),
        },
      });

      pollTimer = window.setInterval(() => {
        if (!player) return;
        callbacksRef.current.onTime?.(player.getCurrentTime(), player.getDuration());
      }, 500);
    }).catch((error: unknown) => {
      if (!disposed) callbacksRef.current.onError?.(error instanceof Error ? error.message : 'No se pudo iniciar el reproductor de YouTube.');
    });

    return () => {
      disposed = true;
      window.clearInterval(pollTimer);
      if (fadeRef.current) {
        window.clearInterval(fadeRef.current.timer);
        fadeRef.current.resolve();
        fadeRef.current = undefined;
      }
      callbacksRef.current.onPlayer?.(null);
      playerRef.current = null;
      player?.destroy();
    };
  }, [active, videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (muted) player.mute();
    else player.setVolume(Math.round(volume * 100));
  }, [muted, volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !mirrorStatus) return;
    synchronizeMirror(player, mirrorStatus, mirrorTime);
  }, [mirrorStatus, mirrorTime]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}

function createPlayerHandle(
  player: YouTubePlayerInstance,
  fadeRef: RefObject<{ timer: number; resolve: () => void } | undefined>,
): YouTubePlayerHandle {
  const setVolume = (volume: number) => player.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100));
  return {
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    seek: (time) => player.seekTo(Math.max(0, time), true),
    setVolume,
    getCurrentTime: () => player.getCurrentTime(),
    fadeTo(volume, durationMs) {
      if (fadeRef.current) {
        window.clearInterval(fadeRef.current.timer);
        fadeRef.current.resolve();
      }
      const target = Math.round(Math.max(0, Math.min(1, volume)) * 100);
      const start = player.getVolume();
      const duration = Math.max(0, durationMs);
      if (duration === 0 || start === target) {
        player.setVolume(target);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const startedAt = performance.now();
        const timer = window.setInterval(() => {
          const progress = Math.min(1, (performance.now() - startedAt) / duration);
          player.setVolume(Math.round(start + (target - start) * progress));
          if (progress === 1) {
            window.clearInterval(timer);
            fadeRef.current = undefined;
            resolve();
          }
        }, 40);
        fadeRef.current = { timer, resolve };
      });
    },
  };
}

function synchronizeMirror(player: YouTubePlayerInstance, status: YouTubePlaybackStatus, time: number): void {
  if (Number.isFinite(time) && Math.abs(player.getCurrentTime() - time) > 2) player.seekTo(Math.max(0, time), true);
  if (status === 'playing' && player.getPlayerState() !== 1) player.playVideo();
  if (status === 'paused' && player.getPlayerState() !== 2) player.pauseVideo();
}

function describeYouTubeError(code: number): string {
  if (code === 2) return 'El identificador del video de YouTube no es válido.';
  if (code === 5) return 'El video no se pudo reproducir en el reproductor HTML5.';
  if (code === 100) return 'El video ya no está disponible o es privado.';
  if (code === 101 || code === 150) return 'El propietario no permite reproducir este video en un reproductor incrustado.';
  if (code === 153) return 'YouTube rechazó el reproductor porque no recibió una identificación válida del origen.';
  return `El reproductor de YouTube informó un error (${code}).`;
}
