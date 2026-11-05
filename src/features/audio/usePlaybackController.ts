import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibraryMediaFile } from '../library/library.types';
import type { QueueItem, QueueTrack } from '../queue/queue.types';
import { AudioEngine } from './AudioEngine';
import type { YouTubePlayerHandle, YouTubeVideoResult } from '../youtube/youtube.types';

export type VideoPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused';
export type BackgroundPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused';

function describePlaybackError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'El navegador bloqueó la reproducción automática. Pulsa reproducir para continuar.';
  }
  if (error instanceof DOMException && error.name === 'NotSupportedError') {
    return 'Este archivo o sus códecs no son compatibles con el navegador.';
  }
  if (error instanceof Error) return error.message;
  return 'No se pudo iniciar la reproducción del archivo.';
}

async function getMediaFile(media: LibraryMediaFile): Promise<File> {
  if (media.file) return media.file;
  if (media.fileHandle) return media.fileHandle.getFile();
  throw new Error('El archivo ya no está disponible. Vuelve a seleccionar la carpeta.');
}

function makeQueueItem(track: QueueTrack): QueueItem {
  return {
    queueId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    track,
    addedAt: Date.now(),
  };
}

export function usePlaybackController() {
  const videoElement = useRef<HTMLVideoElement>(null);
  const audioElement = useRef<HTMLAudioElement>(null);
  const youtubePlayer = useRef<YouTubePlayerHandle | null>(null);
  const audioEngine = useRef<AudioEngine | undefined>(undefined);
  const videoUrl = useRef<string | undefined>(undefined);
  const audioUrl = useRef<string | undefined>(undefined);
  const videoRequest = useRef(0);
  const audioRequest = useRef(0);
  const handledEndedUrl = useRef<string | undefined>(undefined);
  const queueRef = useRef<QueueItem[]>([]);
  const backgroundPlaylistRef = useRef<LibraryMediaFile[]>([]);
  const backgroundIndexRef = useRef(-1);
  const backgroundRequestMediaId = useRef<string | undefined>(undefined);
  const currentVideoRef = useRef<LibraryMediaFile | undefined>(undefined);
  const currentYouTubeRef = useRef<YouTubeVideoResult | undefined>(undefined);
  const currentTrackRef = useRef<QueueTrack | undefined>(undefined);
  const videoHistoryRef = useRef<QueueTrack[]>([]);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [fadeOutDuration, setFadeOutDuration] = useState(1200);
  const [fadeInDuration, setFadeInDuration] = useState(1800);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [backgroundPlaylist, setBackgroundPlaylist] = useState<LibraryMediaFile[]>([]);
  const [currentVideo, setCurrentVideo] = useState<LibraryMediaFile>();
  const [currentYouTubeVideo, setCurrentYouTubeVideo] = useState<YouTubeVideoResult>();
  const [currentVideoFile, setCurrentVideoFile] = useState<File>();
  const [currentVideoSourceId, setCurrentVideoSourceId] = useState<string>();
  const [currentBackground, setCurrentBackground] = useState<LibraryMediaFile>();
  const [historyLength, setHistoryLength] = useState(0);
  const [videoStatus, setVideoStatus] = useState<VideoPlaybackStatus>('idle');
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundPlaybackStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [backgroundLoop, setBackgroundLoop] = useState(true);
  const [videoVolume, setVideoVolume] = useState(1);
  const [backgroundVolume, setBackgroundVolume] = useState(0.35);
  const [error, setError] = useState('');

  const getAudioEngine = useCallback(() => {
    if (audioEngine.current) return audioEngine.current;
    const audio = audioElement.current;
    const video = videoElement.current;
    if (!audio || !video || !window.AudioContext) return undefined;
    try {
      const engine = new AudioEngine(audio, video);
      engine.setVolume('background', backgroundVolume);
      engine.setVolume('karaoke', videoVolume);
      engine.setMasterVolume(masterVolume);
      audioEngine.current = engine;
      return engine;
    } catch (engineError: unknown) {
      setError(`No se pudo inicializar la mezcla Web Audio: ${describePlaybackError(engineError)} Se continuará sin fades.`);
      return undefined;
    }
  }, [backgroundVolume, masterVolume, videoVolume]);

  const updateQueue = useCallback((next: QueueItem[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const updateBackgroundPlaylist = useCallback((next: LibraryMediaFile[]) => {
    backgroundPlaylistRef.current = next;
    setBackgroundPlaylist(next);
  }, []);

  const releaseVideoUrl = useCallback(() => {
    const element = videoElement.current;
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
    videoUrl.current = undefined;
  }, []);

  const releaseAudioUrl = useCallback(() => {
    const element = audioElement.current;
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = undefined;
  }, []);

  const startBackgroundMedia = useCallback(async (media: LibraryMediaFile, index: number) => {
    const element = audioElement.current;
    if (!element) return;

    const requestId = ++audioRequest.current;
    setError('');
    const engine = getAudioEngine();
    backgroundRequestMediaId.current = media.id;
    setBackgroundStatus('loading');
    try {
      await engine?.resume();
      const file = await getMediaFile(media);
      if (requestId !== audioRequest.current) return;
      if (currentTrackRef.current) {
        setBackgroundStatus('paused');
        return;
      }
      releaseAudioUrl();
      const url = URL.createObjectURL(file);
      audioUrl.current = url;
      backgroundIndexRef.current = index;
      const firstBackgroundTrack = !currentBackground;
      setCurrentBackground(media);
      element.volume = engine ? 1 : backgroundVolume;
      if (engine && firstBackgroundTrack) engine.setFadeLevel('background', 0);
      element.src = url;
      element.load();
      await element.play();
      if (requestId !== audioRequest.current || currentTrackRef.current) {
        if (element.src === url) element.pause();
        return;
      }
      setBackgroundStatus('playing');
      if (engine && firstBackgroundTrack) {
        await engine.fadeTo('background', 1, fadeInDuration);
      }
    } catch (playbackError: unknown) {
      if (requestId !== audioRequest.current) return;
      setBackgroundStatus('paused');
      setError(`No se pudo reproducir la música de fondo: ${describePlaybackError(playbackError)}`);
    }
  }, [backgroundVolume, currentBackground, fadeInDuration, getAudioEngine, releaseAudioUrl]);

  const resumeBackground = useCallback(async (requestId?: number) => {
    const element = audioElement.current;
    if (!element || currentTrackRef.current) return;
    if (!currentBackground && backgroundPlaylistRef.current.length > 0) {
      const index = Math.max(0, Math.min(backgroundIndexRef.current, backgroundPlaylistRef.current.length - 1));
      void startBackgroundMedia(backgroundPlaylistRef.current[index], index);
      return;
    }
    if (!currentBackground || !element.src) return;
    const engine = getAudioEngine();
    const source = element.src;
    try {
      await engine?.resume();
      if (requestId !== undefined && requestId !== videoRequest.current) return;
      if (currentTrackRef.current) return;
      await element.play();
      if (requestId !== undefined && requestId !== videoRequest.current) return;
      if (currentTrackRef.current) {
        if (element.src === source) element.pause();
        return;
      }
      setBackgroundStatus('playing');
      if (engine) await engine.fadeTo('background', 1, fadeInDuration);
    } catch (playbackError: unknown) {
      if (requestId !== undefined && requestId !== videoRequest.current) return;
      setBackgroundStatus('paused');
      setError(`No se pudo reanudar la música de fondo: ${describePlaybackError(playbackError)}`);
    }
  }, [currentBackground, fadeInDuration, getAudioEngine, startBackgroundMedia]);

  const startVideo = useCallback(async (media: LibraryMediaFile, recordCurrent = true, continuous = false) => {
    const element = videoElement.current;
    if (!element) {
      setError('El reproductor de video no está disponible en esta vista.');
      return;
    }

    const requestId = ++videoRequest.current;
    const previousTrack = currentTrackRef.current;
    const previousVideo = currentVideoRef.current;
    const previousVideoUrl = videoUrl.current;
    const previousVideoFile = currentVideoFile;
    const previousVideoSourceId = currentVideoSourceId;
    const hadVideo = Boolean(previousTrack);
    setError('');
    const engine = getAudioEngine();
    const backgroundWasPlaying = Boolean(!previousTrack && currentBackground && audioElement.current?.src && !audioElement.current.paused);
    if (recordCurrent && previousTrack && !(previousTrack.kind === 'local' && previousTrack.media.id === media.id)) {
      videoHistoryRef.current = [...videoHistoryRef.current.slice(-49), previousTrack];
      setHistoryLength(videoHistoryRef.current.length);
    }
    currentTrackRef.current = { kind: 'local', media };
    currentVideoRef.current = media;
    currentYouTubeRef.current = undefined;
    audioRequest.current += 1;
    handledEndedUrl.current = undefined;
    setCurrentVideo(media);
    setCurrentYouTubeVideo(undefined);
    setCurrentVideoFile(undefined);
    setCurrentVideoSourceId(undefined);
    setCurrentTime(0);
    setDuration(0);
    setVideoStatus('loading');
    if (hadVideo) element.pause();

    try {
      await engine?.resume();
      const file = await getMediaFile(media);
      if (requestId !== videoRequest.current) return;
      const backgroundFade = backgroundWasPlaying && engine
        ? engine.fadeTo('background', 0, fadeOutDuration)
        : Promise.resolve(true);
      if (!continuous && !hadVideo) engine?.setFadeLevel('karaoke', 0);
      const fadeCompleted = await backgroundFade;
      if (requestId !== videoRequest.current || !fadeCompleted) return;
      if (audioElement.current) {
        audioElement.current.pause();
        if (currentBackground || backgroundStatus === 'loading' || backgroundStatus === 'playing') {
          setBackgroundStatus('paused');
        }
      }
      releaseVideoUrl();
      const url = URL.createObjectURL(file);
      videoUrl.current = url;
      setCurrentVideoFile(file);
      setCurrentVideoSourceId(`${media.id}:${requestId}`);
      element.volume = engine ? 1 : videoVolume;
      element.src = url;
      element.load();
      await element.play();
      if (requestId === videoRequest.current) {
        setVideoStatus('playing');
        if (engine && ((!continuous && !hadVideo) || previousTrack?.kind === 'youtube')) {
          await engine.fadeTo('karaoke', 1, fadeInDuration);
        }
      }
    } catch (playbackError: unknown) {
      if (requestId !== videoRequest.current) return;
      engine?.setFadeLevel('karaoke', 0);
      setError(`No se pudo reproducir “${media.name}”: ${describePlaybackError(playbackError)}`);
      if (previousVideo && videoUrl.current === previousVideoUrl) {
        currentTrackRef.current = previousTrack;
        currentVideoRef.current = previousVideo;
        setCurrentVideo(previousVideo);
        setCurrentVideoFile(previousVideoFile);
        setCurrentVideoSourceId(previousVideoSourceId);
        setVideoStatus('paused');
      } else if (previousTrack?.kind === 'youtube') {
        currentTrackRef.current = previousTrack;
        currentVideoRef.current = undefined;
        currentYouTubeRef.current = previousTrack.video;
        setCurrentVideo(undefined);
        setCurrentVideoFile(undefined);
        setCurrentYouTubeVideo(previousTrack.video);
        setCurrentVideoSourceId(previousVideoSourceId);
        setVideoStatus('loading');
      } else {
        currentTrackRef.current = undefined;
        currentVideoRef.current = undefined;
        currentYouTubeRef.current = undefined;
        setCurrentVideo(undefined);
        setCurrentVideoFile(undefined);
        setCurrentYouTubeVideo(undefined);
        setCurrentVideoSourceId(undefined);
        setVideoStatus('idle');
        void resumeBackground(requestId);
      }
    }
  }, [backgroundStatus, currentBackground, currentVideoFile, currentVideoSourceId, fadeInDuration, fadeOutDuration, getAudioEngine, releaseVideoUrl, resumeBackground]);

  const startYouTube = useCallback(async (video: YouTubeVideoResult, recordCurrent = true) => {
    const requestId = ++videoRequest.current;
    const previousTrack = currentTrackRef.current;
    const engine = getAudioEngine();
    const backgroundWasPlaying = Boolean(!previousTrack && currentBackground && audioElement.current?.src && !audioElement.current.paused);
    if (recordCurrent && previousTrack && !(previousTrack.kind === 'youtube' && previousTrack.video.id === video.id)) {
      videoHistoryRef.current = [...videoHistoryRef.current.slice(-49), previousTrack];
      setHistoryLength(videoHistoryRef.current.length);
    }
    if (previousTrack?.kind === 'local') {
      videoElement.current?.pause();
      engine?.setFadeLevel('karaoke', 0);
    }

    currentTrackRef.current = { kind: 'youtube', video };
    currentVideoRef.current = undefined;
    currentYouTubeRef.current = video;
    handledEndedUrl.current = undefined;
    audioRequest.current += 1;
    setError('');
    setCurrentVideo(undefined);
    setCurrentVideoFile(undefined);
    setCurrentYouTubeVideo(video);
    setCurrentTime(0);
    setDuration(0);
    setCurrentVideoSourceId(`${video.id}:${requestId}`);
    setVideoStatus('loading');

    try {
      await engine?.resume();
      if (requestId !== videoRequest.current) return;
      const backgroundFade = backgroundWasPlaying && engine
        ? engine.fadeTo('background', 0, fadeOutDuration)
        : Promise.resolve(true);
      if (!previousTrack) engine?.setFadeLevel('karaoke', 0);
      const fadeCompleted = await backgroundFade;
      if (requestId !== videoRequest.current || !fadeCompleted) return;
      if (audioElement.current) {
        audioElement.current.pause();
        if (currentBackground || backgroundStatus === 'loading' || backgroundStatus === 'playing') {
          setBackgroundStatus('paused');
        }
      }
      releaseVideoUrl();
      youtubePlayer.current?.setVolume(0);
    } catch (playbackError: unknown) {
      if (requestId !== videoRequest.current) return;
      setVideoStatus('paused');
      setError(`No se pudo preparar “${video.title}”: ${describePlaybackError(playbackError)}`);
    }
  }, [backgroundStatus, currentBackground, fadeOutDuration, getAudioEngine, releaseVideoUrl]);

  const playPrevious = useCallback(() => {
    const previous = videoHistoryRef.current.at(-1);
    if (!previous) return;
    videoHistoryRef.current = videoHistoryRef.current.slice(0, -1);
    setHistoryLength(videoHistoryRef.current.length);
    if (previous.kind === 'youtube') void startYouTube(previous.video, false);
    else void startVideo(previous.media, false);
  }, [startVideo, startYouTube]);

  const playNow = useCallback((media: LibraryMediaFile) => {
    void startVideo(media);
  }, [startVideo]);

  const addToQueue = useCallback((media: LibraryMediaFile) => {
    updateQueue([...queueRef.current, makeQueueItem({ kind: 'local', media })]);
    setError('');
  }, [updateQueue]);

  const addYouTubeToQueue = useCallback((video: YouTubeVideoResult) => {
    updateQueue([...queueRef.current, makeQueueItem({ kind: 'youtube', video })]);
    setError('');
  }, [updateQueue]);

  const playYouTubeNow = useCallback((video: YouTubeVideoResult) => {
    void startYouTube(video);
  }, [startYouTube]);

  const addToBackground = useCallback((media: LibraryMediaFile) => {
    const existing = backgroundPlaylistRef.current.some((item) => item.id === media.id);
    if (existing) {
      setError(`“${media.name}” ya está en la playlist de ambiente.`);
      return;
    }
    const next = [...backgroundPlaylistRef.current, media];
    updateBackgroundPlaylist(next);
    setError('');
    if (!currentTrackRef.current && next.length === 1) {
      void startBackgroundMedia(media, 0);
    }
  }, [startBackgroundMedia, updateBackgroundPlaylist]);

  const playNext = useCallback(async () => {
    const [next, ...remaining] = queueRef.current;
    if (next) {
      updateQueue(remaining);
      if (next.track.kind === 'youtube') await startYouTube(next.track.video);
      else await startVideo(next.track.media, true, true);
      return;
    }
    if (!currentTrackRef.current) return;
    const requestId = ++videoRequest.current;
    const youtube = currentYouTubeRef.current;
    const fadeCompleted = youtube
      ? await (youtubePlayer.current?.fadeTo(0, fadeOutDuration) ?? Promise.resolve(true))
      : await (getAudioEngine()?.fadeTo('karaoke', 0, fadeOutDuration) ?? Promise.resolve(true));
    if (!fadeCompleted || requestId !== videoRequest.current) return;
    currentTrackRef.current = undefined;
    currentVideoRef.current = undefined;
    currentYouTubeRef.current = undefined;
    releaseVideoUrl();
    setCurrentVideo(undefined);
    setCurrentVideoFile(undefined);
    setCurrentYouTubeVideo(undefined);
    setCurrentVideoSourceId(undefined);
    setVideoStatus('idle');
    setCurrentTime(0);
    setDuration(0);
    void resumeBackground(requestId);
  }, [fadeOutDuration, getAudioEngine, releaseVideoUrl, resumeBackground, startVideo, startYouTube, updateQueue]);

  const handleVideoEnded = useCallback(() => {
    const source = videoUrl.current;
    if (!source || handledEndedUrl.current === source) return;
    handledEndedUrl.current = source;
    void playNext();
  }, [playNext]);

  const handleYouTubeEnded = useCallback(() => {
    const source = `${currentYouTubeRef.current?.id}:${videoRequest.current}`;
    if (!currentYouTubeRef.current || handledEndedUrl.current === source) return;
    handledEndedUrl.current = source;
    void playNext();
  }, [playNext]);

  const handleYouTubeStatus = useCallback((status: 'idle' | 'loading' | 'playing' | 'paused') => {
    if (!currentYouTubeRef.current) return;
    if (status === 'idle') {
      handleYouTubeEnded();
      return;
    }
    setVideoStatus(status);
    if (status === 'playing') {
      setError('');
      void youtubePlayer.current?.fadeTo(videoVolume * masterVolume, fadeInDuration);
    }
  }, [fadeInDuration, handleYouTubeEnded, masterVolume, videoVolume]);

  const handleYouTubePlayer = useCallback((player: YouTubePlayerHandle | null) => {
    youtubePlayer.current = player;
    if (player && currentYouTubeRef.current) player.setVolume(0);
  }, []);

  const handleYouTubeError = useCallback((message: string) => {
    if (!currentYouTubeRef.current) return;
    setVideoStatus('paused');
    setError(message);
  }, []);

  const handleYouTubeAutoplayBlocked = useCallback(() => {
    if (!currentYouTubeRef.current) return;
    setVideoStatus('paused');
    setError('YouTube bloqueó el inicio automático. Pulsa reproducir para comenzar.');
  }, []);

  const handleBackgroundEnded = useCallback(() => {
    const playlist = backgroundPlaylistRef.current;
    if (playlist.length === 0) {
      setBackgroundStatus('idle');
      return;
    }
    if (!backgroundLoop && backgroundIndexRef.current >= playlist.length - 1) {
      setBackgroundStatus('idle');
      return;
    }
    const nextIndex = (backgroundIndexRef.current + 1) % playlist.length;
    void startBackgroundMedia(playlist[nextIndex], nextIndex);
  }, [backgroundLoop, startBackgroundMedia]);

  const toggleVideoPlayback = useCallback(() => {
    const element = videoElement.current;
    if (currentYouTubeRef.current) {
      setError('');
      if (videoStatus === 'playing') {
        youtubePlayer.current?.pause();
        setVideoStatus('paused');
      } else {
        youtubePlayer.current?.play();
      }
      return;
    }
    if (!element || !videoUrl.current) return;
    setError('');
    if (element.paused) {
      const engine = getAudioEngine();
      void (async () => {
        try {
          await engine?.resume();
          await element.play();
          setVideoStatus('playing');
          if (engine) await engine.fadeTo('karaoke', 1, fadeInDuration);
        } catch (playbackError: unknown) {
          setVideoStatus('paused');
          setError(`No se pudo reanudar el video: ${describePlaybackError(playbackError)}`);
        }
      })();
    } else {
      element.pause();
      setVideoStatus('paused');
    }
  }, [fadeInDuration, getAudioEngine, videoStatus]);

  const toggleBackgroundPlayback = useCallback(() => {
    const element = audioElement.current;
    if (!element) return;
    if (currentTrackRef.current) {
      setError('La música de fondo se reanuda al terminar el karaoke.');
      return;
    }
    setError('');
    if (!currentBackground || !element.src) {
      const index = Math.max(0, backgroundIndexRef.current);
      const media = backgroundPlaylistRef.current[index];
      if (media) void startBackgroundMedia(media, index);
      return;
    }
    if (element.paused) {
      const engine = getAudioEngine();
      void (async () => {
        try {
          await engine?.resume();
          await element.play();
          setBackgroundStatus('playing');
          if (engine) await engine.fadeTo('background', 1, fadeInDuration);
        } catch (playbackError: unknown) {
          setBackgroundStatus('paused');
          setError(`No se pudo reanudar la música de fondo: ${describePlaybackError(playbackError)}`);
        }
      })();
    } else {
      element.pause();
      setBackgroundStatus('paused');
    }
  }, [currentBackground, fadeInDuration, getAudioEngine, startBackgroundMedia]);

  const stopVideo = useCallback(async () => {
    const requestId = ++videoRequest.current;
    const youtube = currentYouTubeRef.current;
    const fadeCompleted = youtube
      ? await (youtubePlayer.current?.fadeTo(0, fadeOutDuration) ?? Promise.resolve(true))
      : await (getAudioEngine()?.fadeTo('karaoke', 0, fadeOutDuration) ?? Promise.resolve(true));
    if (!fadeCompleted || requestId !== videoRequest.current) return;
    currentTrackRef.current = undefined;
    releaseVideoUrl();
    currentVideoRef.current = undefined;
    currentYouTubeRef.current = undefined;
    setCurrentVideo(undefined);
    setCurrentVideoFile(undefined);
    setCurrentYouTubeVideo(undefined);
    setCurrentVideoSourceId(undefined);
    youtubePlayer.current?.pause();
    setVideoStatus('idle');
    setCurrentTime(0);
    setDuration(0);
    setError('');
    void resumeBackground(requestId);
  }, [fadeOutDuration, getAudioEngine, releaseVideoUrl, resumeBackground]);

  const removeFromQueue = useCallback((queueId: string) => {
    updateQueue(queueRef.current.filter((item) => item.queueId !== queueId));
  }, [updateQueue]);

  const clearQueue = useCallback(() => updateQueue([]), [updateQueue]);

  const moveQueueItem = useCallback((queueId: string, direction: -1 | 1) => {
    const current = queueRef.current;
    const index = current.findIndex((item) => item.queueId === queueId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    updateQueue(next);
  }, [updateQueue]);

  const removeBackgroundItem = useCallback((mediaId: string) => {
    const previous = backgroundPlaylistRef.current;
    const removedIndex = previous.findIndex((item) => item.id === mediaId);
    const next = previous.filter((item) => item.id !== mediaId);
    updateBackgroundPlaylist(next);
    if (removedIndex < 0) return;
    if (backgroundRequestMediaId.current === mediaId && currentBackground?.id !== mediaId) {
      audioRequest.current += 1;
      releaseAudioUrl();
      backgroundRequestMediaId.current = undefined;
      setCurrentBackground(undefined);
      setBackgroundStatus('idle');
      return;
    }
    if (currentBackground?.id === mediaId) {
      audioRequest.current += 1;
      releaseAudioUrl();
      backgroundRequestMediaId.current = undefined;
      setCurrentBackground(undefined);
      setBackgroundStatus('idle');
      if (!currentTrackRef.current && next.length > 0) {
        const nextIndex = Math.min(removedIndex, next.length - 1);
        void startBackgroundMedia(next[nextIndex], nextIndex);
      }
    } else if (removedIndex < backgroundIndexRef.current) {
      backgroundIndexRef.current -= 1;
    }
  }, [currentBackground, releaseAudioUrl, startBackgroundMedia, updateBackgroundPlaylist]);

  const seekVideo = useCallback((time: number) => {
    if (currentYouTubeRef.current) {
      if (!Number.isFinite(time)) return;
      youtubePlayer.current?.seek(time);
      setCurrentTime(time);
      return;
    }
    const element = videoElement.current;
    if (!element || !Number.isFinite(time)) return;
    element.currentTime = Math.max(0, Math.min(time, element.duration || 0));
    setCurrentTime(element.currentTime);
  }, []);

  const updateVideoTime = useCallback((time: number) => {
    if (Number.isFinite(time)) setCurrentTime(time);
  }, []);

  const updateVideoDuration = useCallback((time: number) => {
    if (Number.isFinite(time)) setDuration(time);
  }, []);

  const setVideoLevel = useCallback((value: number) => {
    const level = Math.max(0, Math.min(1, value));
    setVideoVolume(level);
    if (videoElement.current) videoElement.current.volume = audioEngine.current ? 1 : level;
    audioEngine.current?.setVolume('karaoke', level);
    youtubePlayer.current?.setVolume(level * masterVolume);
  }, [masterVolume]);

  const setBackgroundLevel = useCallback((value: number) => {
    const level = Math.max(0, Math.min(1, value));
    setBackgroundVolume(level);
    if (audioElement.current) audioElement.current.volume = audioEngine.current ? 1 : level;
    audioEngine.current?.setVolume('background', level);
  }, []);

  const setMasterLevel = useCallback((value: number) => {
    const level = Math.max(0, Math.min(1, value));
    setMasterVolume(level);
    audioEngine.current?.setMasterVolume(level);
    youtubePlayer.current?.setVolume(level * videoVolume);
  }, [videoVolume]);

  useEffect(() => {
    const video = videoElement.current;
    const audio = audioElement.current;
    return () => {
      video?.pause();
      audio?.pause();
      if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      void audioEngine.current?.dispose();
    };
  }, []);

  return {
    videoElement,
    audioElement,
    queue,
    backgroundPlaylist,
    currentVideo,
    currentVideoFile,
    currentVideoSourceId,
    historyLength,
    currentBackground,
    videoStatus,
    backgroundStatus,
    currentTime,
    duration,
    backgroundLoop,
    videoVolume,
    backgroundVolume,
    masterVolume,
    fadeOutDuration,
    fadeInDuration,
    error,
    setError,
    setBackgroundLoop,
    setVideoLevel,
    currentYouTubeVideo,
    youtubePlayer,
    handleYouTubePlayer,
    handleYouTubeStatus,
    handleYouTubeError,
    handleYouTubeAutoplayBlocked,
    handleYouTubeEnded,
    addYouTubeToQueue,
    playYouTubeNow,
    updateVideoTime,
    updateVideoDuration,
    setBackgroundLevel,
    setMasterLevel,
    setFadeOutDuration,
    setFadeInDuration,
    playNow,
    addToQueue,
    addToBackground,
    playNext,
    playPrevious,
    handleVideoEnded,
    handleBackgroundEnded,
    toggleVideoPlayback,
    toggleBackgroundPlayback,
    stopVideo,
    removeFromQueue,
    clearQueue,
    moveQueueItem,
    removeBackgroundItem,
    seekVideo,
  };
}

export type PlaybackController = ReturnType<typeof usePlaybackController>;
