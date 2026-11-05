import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackController } from '../audio/usePlaybackController';
import { DISPLAY_CHANNEL_PREFIX, type DisplayMessage, type DisplaySnapshot } from './displayChannel';

function createSessionId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useSecondaryDisplay(controller: PlaybackController) {
  const [sessionId] = useState(createSessionId);
  const [opened, setOpened] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const windowRef = useRef<Window | null>(null);
  const backgroundImageRef = useRef<File | undefined>(undefined);
  const backgroundImageIdRef = useRef<string | undefined>(undefined);
  const [backgroundImage, setBackgroundImage] = useState<File>();
  const lastPublishedFileRef = useRef<File | undefined>(undefined);
  const lastPublishedSourceIdRef = useRef<string | undefined>(undefined);
  const snapshotRef = useRef<DisplaySnapshot>({
    type: 'snapshot',
    status: 'idle',
    currentTime: 0,
  });

  snapshotRef.current = {
    type: 'snapshot',
    mediaId: controller.currentVideo?.id,
    sourceId: controller.currentVideoSourceId,
    youtubeVideoId: controller.currentYouTubeVideo?.id,
    title: controller.currentVideo?.name ?? controller.currentYouTubeVideo?.title,
    file: controller.currentVideoFile,
    status: controller.videoStatus,
    currentTime: controller.currentTime,
  };

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel(`${DISPLAY_CHANNEL_PREFIX}${sessionId}`);
    channelRef.current = channel;
    const publishSnapshot = (includeFile: boolean) => {
      try {
        const snapshot = snapshotRef.current;
        channel.postMessage(includeFile ? snapshot : { ...snapshot, file: undefined });
        if (includeFile) {
          lastPublishedFileRef.current = snapshot.file;
          lastPublishedSourceIdRef.current = snapshot.sourceId;
        }
      } catch (postError) {
        setError(postError instanceof Error ? `No se pudo sincronizar la segunda pantalla: ${postError.message}` : 'No se pudo sincronizar la segunda pantalla.');
      }
    };
    const publishBackgroundImage = () => {
      try {
        channel.postMessage({
          type: 'background-image',
          imageId: backgroundImageIdRef.current,
          file: backgroundImageRef.current,
        } satisfies DisplayMessage);
      } catch (postError) {
        setError(postError instanceof Error ? `No se pudo enviar la imagen de fondo: ${postError.message}` : 'No se pudo enviar la imagen de fondo.');
      }
    };
    const handleMessage = (event: MessageEvent<DisplayMessage>) => {
      if (event.data?.type === 'ready') {
        setConnected(true);
        setError('');
        publishBackgroundImage();
        publishSnapshot(true);
      } else if (event.data?.type === 'display-error') {
        setError(event.data.message);
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!channelRef.current) return;
    try {
      channelRef.current.postMessage({
        type: 'background-image',
        imageId: backgroundImageIdRef.current,
        file: backgroundImage,
      } satisfies DisplayMessage);
    } catch (postError) {
      setError(postError instanceof Error ? `No se pudo enviar la imagen de fondo: ${postError.message}` : 'No se pudo enviar la imagen de fondo.');
    }
  }, [backgroundImage]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const hasNewFile = Boolean(snapshotRef.current.file && (
      snapshotRef.current.file !== lastPublishedFileRef.current
      || snapshotRef.current.sourceId !== lastPublishedSourceIdRef.current
    ));
    try {
      channel.postMessage(hasNewFile ? snapshotRef.current : { ...snapshotRef.current, file: undefined });
      if (hasNewFile) {
        lastPublishedFileRef.current = snapshotRef.current.file;
        lastPublishedSourceIdRef.current = snapshotRef.current.sourceId;
      }
    } catch (postError) {
      setError(postError instanceof Error ? `No se pudo sincronizar la segunda pantalla: ${postError.message}` : 'No se pudo sincronizar la segunda pantalla.');
    }
  }, [
    controller.currentVideo?.id,
    controller.currentVideo?.name,
    controller.currentYouTubeVideo?.id,
    controller.currentYouTubeVideo?.title,
    controller.currentVideoFile,
    controller.currentVideoSourceId,
    controller.videoStatus,
    controller.currentTime,
  ]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (windowRef.current?.closed) {
        windowRef.current = null;
        setOpened(false);
        setConnected(false);
      }
    }, 750);
    return () => window.clearInterval(interval);
  }, []);

  const open = useCallback(() => {
    setError('');
    if (!('BroadcastChannel' in window)) {
      setError('Este navegador no ofrece BroadcastChannel. La segunda pantalla no está disponible.');
      return;
    }
    if (windowRef.current && !windowRef.current.closed) {
      windowRef.current.focus();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('display', '1');
    url.searchParams.set('displaySession', sessionId);
    const displayWindow = window.open(url.toString(), `stage-display-${sessionId}`, 'popup,width=1280,height=720');
    if (!displayWindow) {
      setError('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para abrir la segunda pantalla.');
      return;
    }
    windowRef.current = displayWindow;
    setOpened(true);
    setConnected(false);
  }, [sessionId]);

  const chooseBackgroundImage = useCallback((file: File | undefined) => {
    if (file && !file.type.startsWith('image/')) {
      setError('El archivo seleccionado no es una imagen compatible.');
      return;
    }
    if (file && file.size > 20 * 1024 * 1024) {
      setError('La imagen de fondo debe pesar menos de 20 MB.');
      return;
    }
    backgroundImageRef.current = file;
    backgroundImageIdRef.current = file ? `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}` : undefined;
    setBackgroundImage(file);
    setError('');
  }, []);

  return {
    open,
    chooseBackgroundImage,
    backgroundImageName: backgroundImage?.name,
    opened,
    connected,
    error,
    supported: 'BroadcastChannel' in window,
  };
}
